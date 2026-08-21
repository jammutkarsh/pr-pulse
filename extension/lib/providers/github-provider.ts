import { ProviderError } from '../errors';
import type {
	ProviderPullRequests,
	PullRequest,
	PullRequestChecks,
	PullRequestRepoOwner,
	PullRequestReviewer,
	PullRequestReviews,
	ProviderConfig,
	User,
} from '../types';
import { BaseProvider } from './base-provider';

type GraphQLReview = {
	databaseId: number | null;
	state: string;
	author: { login: string; avatarUrl: string } | null;
};

type GraphQLPullRequest = {
	id: string;
	number: number;
	title: string;
	url: string;
	state: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	additions: number;
	deletions: number;
	changedFiles: number;
	headRefName: string;
	author: { login: string; avatarUrl: string; name?: string | null } | null;
	repository: { nameWithOwner: string; owner: { login: string; __typename: string } } | null;
	commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> };
	reviews: { nodes: GraphQLReview[] };
	reviewRequests: { nodes: Array<{ requestedReviewer: { login?: string } | null }> };
	reviewThreads: { nodes: Array<{ isResolved: boolean; isOutdated: boolean }> };
};

type RateLimit = { cost: number; remaining: number };

type CountResponse = {
	rateLimit: RateLimit | null;
	myPRs: { issueCount: number } | null;
	reviewRequests: { issueCount: number } | null;
	reviewedPRs: { issueCount: number } | null;
};

type SearchResponse = {
	rateLimit: RateLimit | null;
	search: {
		pageInfo: { hasNextPage: boolean; endCursor: string | null };
		nodes: Array<GraphQLPullRequest | null>;
	} | null;
};

// GraphQL point cost is charged on the nodes a query *requests*, not the ones it returns, and nested
// connections multiply by their parent's page size. So each PR node here costs roughly
// 1 + REVIEWS + REVIEW_REQUESTS + REVIEW_THREADS nodes, and the search page size multiplies all of it.
const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 3;
const REVIEWS_PAGE_SIZE = 50;
const REVIEW_REQUESTS_PAGE_SIZE = 20;
const REVIEW_THREADS_PAGE_SIZE = 25;

const SEARCH_QUERIES = {
	myPRs: 'author:@me type:pr state:open sort:updated-desc',
	reviewRequests: 'review-requested:@me type:pr state:open sort:updated-desc',
	reviewedPRs: 'reviewed-by:@me -author:@me type:pr state:open sort:updated-desc',
};

type SearchView = keyof typeof SEARCH_QUERIES;

// issueCount is a scalar on the connection, so this whole probe costs 3 nodes — one point. Sizing the
// real queries to the answer beats a fixed first: 100, which bills a 7-PR user the same as a 100-PR one.
const COUNT_QUERY = `query($myPRs: String!, $reviewRequests: String!, $reviewedPRs: String!) {
	rateLimit { cost remaining }
	myPRs: search(query: $myPRs, type: ISSUE, first: 1) { issueCount }
	reviewRequests: search(query: $reviewRequests, type: ISSUE, first: 1) { issueCount }
	reviewedPRs: search(query: $reviewedPRs, type: ISSUE, first: 1) { issueCount }
}`;

const SEARCH_QUERY = `query($q: String!, $first: Int!, $after: String) {
	rateLimit { cost remaining }
	search(query: $q, type: ISSUE, first: $first, after: $after) {
		pageInfo { hasNextPage endCursor }
		nodes {
			... on PullRequest {
				id
				number
				title
				url
				state
				isDraft
				createdAt
				updatedAt
				additions
				deletions
				changedFiles
				headRefName
				author { login avatarUrl ... on User { name } }
				repository { nameWithOwner owner { login __typename } }
				commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
				reviews(last: ${REVIEWS_PAGE_SIZE}) { nodes { databaseId state author { login avatarUrl } } }
				reviewRequests(first: ${REVIEW_REQUESTS_PAGE_SIZE}) { nodes { requestedReviewer { ... on User { login } } } }
				reviewThreads(first: ${REVIEW_THREADS_PAGE_SIZE}) { nodes { isResolved isOutdated } }
			}
		}
	}
}`;

// GraphQL enums are uppercase and closed sets. Map them explicitly so an enum GitHub adds later shows up
// as a warning rather than silently lowercasing into a value nothing downstream handles.
const CHECK_STATUS_BY_ROLLUP: Record<string, PullRequestChecks['status']> = {
	SUCCESS: 'success',
	FAILURE: 'failure',
	ERROR: 'failure',
	PENDING: 'pending',
	EXPECTED: 'pending',
};

const PULL_REQUEST_STATE: Record<string, string> = {
	OPEN: 'open',
	CLOSED: 'closed',
	MERGED: 'merged',
};

const OWNER_TYPE: Record<string, PullRequestRepoOwner['type']> = {
	Organization: 'org',
	User: 'user',
};

const REVIEW_STATE = {
	approved: 'APPROVED',
	changesRequested: 'CHANGES_REQUESTED',
	dismissed: 'DISMISSED',
	commented: 'COMMENTED',
	pending: 'PENDING',
} as const;

const KNOWN_REVIEW_STATES: ReadonlySet<string> = new Set(Object.values(REVIEW_STATE));

function mapEnum<T>(map: Record<string, T>, value: string | null | undefined, fallback: T, label: string): T {
	if (value && value in map) {
		return map[value];
	}

	if (value) {
		console.warn(`GitHub GraphQL: unrecognized ${label} "${value}", falling back to "${fallback}"`);
	}

	return fallback;
}

/**
 * Page size for the next request: whatever the count probe says is left, clamped to GitHub's max.
 * Floors at 1 because GraphQL rejects `first: 0`, and the loop only gets here when more is expected.
 */
export function nextPageSize(issueCount: number, alreadySeen: number): number {
	return Math.min(Math.max(issueCount - alreadySeen, 1), MAX_PAGE_SIZE);
}

export class GitHubProvider extends BaseProvider {
	constructor(config: ProviderConfig = {}) {
		super(config);
		this.name = 'github';
		this.displayName = 'GitHub';
		this.baseUrl = config.baseUrl || 'https://api.github.com';
	}

	async #request(url: string, init: RequestInit = {}): Promise<Response> {
		const response = await fetch(url, {
			...init,
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${this.token}`,
				...init.headers,
			},
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}) as { message?: string });
			const statusCode = response.status;
			throw new ProviderError(error.message || `GitHub API error: ${statusCode}`, 'API_ERROR', {
				statusCode,
				retryable: statusCode === 429 || statusCode >= 500,
				provider: 'github',
			});
		}

		return response;
	}

	async #graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
		// GHES exposes GraphQL at /api/graphql while REST lives at /api/v3
		const url = this.baseUrl.endsWith('/api/v3') ? `${this.baseUrl.slice(0, -3)}/graphql` : `${this.baseUrl}/graphql`;
		const response = await this.#request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, variables }),
		});

		const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };

		// A single unreadable repo returns null for that node plus an error entry. Keep the rest
		// of the refresh alive instead of failing every PR because of one.
		if (body.errors?.length) {
			if (!body.data) {
				throw new ProviderError(body.errors[0].message, 'API_ERROR', { provider: 'github' });
			}
			console.warn(
				'GitHub GraphQL returned partial data:',
				body.errors.map((e) => e.message),
			);
		}

		if (!body.data) {
			throw new ProviderError('GitHub GraphQL response missing data', 'PARSE_ERROR', { provider: 'github' });
		}

		return body.data;
	}

	#logCost(label: string, rateLimit: RateLimit | null): void {
		if (rateLimit) {
			console.debug(`GitHub GraphQL ${label}: cost=${rateLimit.cost}, remaining=${rateLimit.remaining}`);
		}
	}

	override authenticate(): Promise<User> {
		return this.getUser();
	}

	// Stays on REST: the token expiry date is only exposed as a response header, and GraphQL has no
	// equivalent field. Not on the refresh path, so it costs nothing per poll.
	override async getUser(): Promise<User> {
		const response = await this.#request(`${this.baseUrl}/user`, {
			headers: { Accept: 'application/vnd.github.v3+json' },
		});

		const data = await response.json();

		return {
			login: data.login,
			avatarUrl: data.avatar_url,
			name: data.name || data.login,
			tokenExpiration: response.headers.get('github-authentication-token-expiration') || null,
		};
	}

	#buildChecks(pr: GraphQLPullRequest): PullRequestChecks {
		// GitHub's own rollup verdict. Reading it instead of folding over a contexts connection means a PR
		// with more checks than the page size can't report green by hiding the failing one past the cap.
		const state = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state;
		if (!state) {
			return { status: 'unknown' };
		}

		return { status: mapEnum(CHECK_STATUS_BY_ROLLUP, state, 'unknown', 'statusCheckRollup state') };
	}

	#buildReviews(pr: GraphQLPullRequest): PullRequestReviews {
		const pendingReviewers = (pr.reviewRequests?.nodes || [])
			.map((node) => node.requestedReviewer?.login)
			.filter((login): login is string => !!login);
		const reRequested = new Set(pendingReviewers);
		const reviews = pr.reviews?.nodes || [];
		const reviewerMap = new Map<string, PullRequestReviewer>();

		for (const review of reviews) {
			if (!review.author) {
				continue;
			}

			if (!KNOWN_REVIEW_STATES.has(review.state)) {
				console.warn(`GitHub GraphQL: unrecognized review state "${review.state}", ignoring review`);
				continue;
			}

			// PENDING and COMMENTED carry no verdict, and a re-requested reviewer's old verdict is stale.
			if (review.state === REVIEW_STATE.pending || review.state === REVIEW_STATE.commented) {
				continue;
			}

			if (reRequested.has(review.author.login)) {
				continue;
			}

			reviewerMap.set(review.author.login, {
				login: review.author.login,
				avatarUrl: review.author.avatarUrl,
				state: review.state,
			});
		}

		const reviewers = Array.from(reviewerMap.values());

		let status: PullRequestReviews['status'];
		if (reviewers.some((reviewer) => reviewer.state === REVIEW_STATE.changesRequested)) {
			status = 'changes_requested';
		} else if (pendingReviewers.length > 0 || reviewers.length === 0) {
			status = 'pending';
		} else {
			status = reviewers.every((reviewer) => reviewer.state === REVIEW_STATE.approved) ? 'approved' : 'pending';
		}

		let changesRequestedReviewId: number | undefined;
		let openThreadCount: number | undefined;
		if (status === 'changes_requested') {
			// Reviews come back oldest-first; the last one is the most recent, for deep-linking.
			const changesRequested = reviews.filter((review) => review.state === REVIEW_STATE.changesRequested);
			changesRequestedReviewId = changesRequested[changesRequested.length - 1]?.databaseId ?? undefined;

			// Only GraphQL exposes thread resolution state; REST review comments have no
			// isResolved/isOutdated, which is why resolved threads used to be counted as open.
			// Caps at REVIEW_THREADS_PAGE_SIZE — a busier PR under-reports rather than costing every PR more.
			const threads = pr.reviewThreads?.nodes || [];
			openThreadCount = threads.filter((thread) => !thread.isResolved && !thread.isOutdated).length;
		}

		return { status, reviewers, pendingReviewers, openThreadCount, changesRequestedReviewId };
	}

	#transformPullRequest(pr: GraphQLPullRequest): PullRequest {
		const repoFullName = pr.repository?.nameWithOwner || '';
		const authorLogin = pr.author?.login || '';

		return {
			id: `github-${pr.id}`,
			provider: 'github',
			title: pr.title,
			url: pr.url,
			repoFullName,
			repoOwner: {
				login: pr.repository?.owner?.login || repoFullName.split('/')[0] || '',
				type: mapEnum(OWNER_TYPE, pr.repository?.owner?.__typename, 'unknown', 'repository owner type'),
			},
			branchName: pr.headRefName || '',
			author: {
				login: authorLogin,
				avatarUrl: pr.author?.avatarUrl || '',
				name: pr.author?.name || authorLogin,
			},
			state: mapEnum(PULL_REQUEST_STATE, pr.state, 'open', 'pull request state'),
			changes: {
				additions: pr.additions,
				deletions: pr.deletions,
				filesChanged: pr.changedFiles,
			},
			checks: this.#buildChecks(pr),
			reviews: this.#buildReviews(pr),
			createdAt: pr.createdAt,
			updatedAt: pr.updatedAt,
			isDraft: pr.isDraft,
		};
	}

	async #fetchView(view: SearchView, issueCount: number): Promise<PullRequest[]> {
		const pullRequests: PullRequest[] = [];
		let cursor: string | null = null;
		let dropped = 0;

		for (let page = 1; page <= MAX_PAGES; page++) {
			const first = nextPageSize(issueCount, pullRequests.length + dropped);
			const data = await this.#graphql<SearchResponse>(SEARCH_QUERY, { q: SEARCH_QUERIES[view], first, after: cursor });
			this.#logCost(`${view} page ${page} (first: ${first})`, data.rateLimit);

			for (const node of data.search?.nodes || []) {
				if (!node?.id) {
					dropped++;
					continue;
				}

				pullRequests.push(this.#transformPullRequest(node));
			}

			// issueCount is a snapshot from the probe, so hasNextPage — not the count — ends the loop.
			// A PR opened between the probe and this request still gets picked up.
			if (!data.search?.pageInfo?.hasNextPage) {
				break;
			}

			cursor = data.search.pageInfo.endCursor;

			if (page === MAX_PAGES) {
				console.warn(
					`GitHub GraphQL ${view}: stopped at the ${MAX_PAGES}-page cap with ${pullRequests.length} PRs; more are available`,
				);
			}
		}

		if (dropped > 0) {
			// Null nodes are PRs in repos the token can't read — SSO-restricted, archived, or since deleted.
			// They are dropped from the view, so say so rather than letting them vanish silently.
			console.warn(`GitHub GraphQL ${view}: dropped ${dropped} unreadable PR node(s); they will not appear in the dashboard`);
		}

		return pullRequests;
	}

	override async getAllPullRequests(): Promise<ProviderPullRequests> {
		const counts = await this.#graphql<CountResponse>(COUNT_QUERY, SEARCH_QUERIES);
		this.#logCost('count probe', counts.rateLimit);

		const [myPRs, reviewRequests, reviewedPRs] = await Promise.all(
			(['myPRs', 'reviewRequests', 'reviewedPRs'] as const).map((view) => {
				const issueCount = counts[view]?.issueCount ?? 0;
				// Nothing to fetch: skip the request entirely rather than paying for an empty page.
				return issueCount === 0 ? Promise.resolve([]) : this.#fetchView(view, issueCount);
			}),
		);

		return { myPRs, reviewRequests, reviewedPRs };
	}
}
