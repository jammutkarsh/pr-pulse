import { ProviderError } from '../errors';
import type {
	PullRequest,
	PullRequestCheckDetail,
	PullRequestChecks,
	PullRequestRepoOwner,
	PullRequestReviews,
	ProviderConfig,
	User,
} from '../types';
import { BaseProvider } from './base-provider';

type GraphQLCheckContext =
	| { __typename: 'CheckRun'; name: string; status: string; conclusion: string | null }
	| { __typename: 'StatusContext'; context: string; state: string };

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
	commits: { nodes: Array<{ commit: { statusCheckRollup: { contexts: { nodes: GraphQLCheckContext[] } } | null } }> };
	reviews: { nodes: GraphQLReview[] };
	reviewRequests: { nodes: Array<{ requestedReviewer: { login?: string } | null }> };
	reviewThreads: { nodes: Array<{ isResolved: boolean; isOutdated: boolean }> };
};

type SearchResponse = {
	rateLimit: { cost: number; remaining: number } | null;
	search: { nodes: Array<GraphQLPullRequest | null> };
};

// One query per view replaces the old 1 + 3N REST fan-out. Connection page sizes drive
// the GraphQL point cost (cost ~= total nodes / 100), so keep them as small as the UI allows.
const SEARCH_QUERY = `query($q: String!) {
	rateLimit { cost remaining }
	search(query: $q, type: ISSUE, first: 30) {
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
				commits(last: 1) {
					nodes {
						commit {
							statusCheckRollup {
								contexts(first: 20) {
									nodes {
										__typename
										... on CheckRun { name status conclusion }
										... on StatusContext { context state }
									}
								}
							}
						}
					}
				}
				reviews(first: 50) { nodes { databaseId state author { login avatarUrl } } }
				reviewRequests(first: 20) { nodes { requestedReviewer { ... on User { login } } } }
				reviewThreads(first: 100) { nodes { isResolved isOutdated } }
			}
		}
	}
}`;

export class GitHubProvider extends BaseProvider {
	constructor(config: ProviderConfig = {}) {
		super(config);
		this.name = 'github';
		this.displayName = 'GitHub';
		this.baseUrl = config.baseUrl || 'https://api.github.com';
	}

	#resolveOwnerType(rawType: string | undefined): PullRequestRepoOwner['type'] {
		const normalized = (rawType || '').toLowerCase();
		if (normalized === 'organization') return 'org';
		if (normalized === 'user') return 'user';
		return 'unknown';
	}

	async #throwApiError(response: Response): Promise<never> {
		const error = await response.json().catch(() => ({}) as { message?: string });
		const statusCode = response.status;
		const retryable = statusCode === 429 || statusCode >= 500;
		throw new ProviderError(error.message || `GitHub API error: ${statusCode}`, 'API_ERROR', {
			statusCode,
			retryable,
			provider: 'github',
		});
	}

	async #graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
		// GHES exposes GraphQL at /api/graphql while REST lives at /api/v3
		const url = this.baseUrl.endsWith('/api/v3') ? `${this.baseUrl.slice(0, -3)}/graphql` : `${this.baseUrl}/graphql`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			return this.#throwApiError(response);
		}

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

	override authenticate(): Promise<User> {
		return this.getUser();
	}

	// Stays on REST: the token expiry date is only exposed as a response header, and GraphQL has no
	// equivalent field. Not on the refresh path, so it costs nothing per poll.
	override async getUser(): Promise<User> {
		const url = `${this.baseUrl}/user`;
		const response = await fetch(url, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
				Authorization: `Bearer ${this.token}`,
			},
		});

		if (!response.ok) {
			return this.#throwApiError(response);
		}

		const data = await response.json();
		const expirationDate = response.headers.get('github-authentication-token-expiration');

		return {
			login: data.login,
			avatarUrl: data.avatar_url,
			name: data.name || data.login,
			tokenExpiration: expirationDate || null,
		};
	}

	#resolveCheckVerdict(details: PullRequestCheckDetail[]): PullRequestChecks['status'] {
		const failureConclusions = ['failure', 'error', 'timed_out', 'cancelled', 'startup_failure', 'action_required'];
		if (details.some((detail) => failureConclusions.includes(detail.conclusion || ''))) {
			return 'failure';
		}

		const allComplete = details.every((detail) => detail.status === 'completed');
		if (!allComplete) {
			return 'pending';
		}

		const successConclusions = ['success', 'skipped', 'neutral'];
		const allSuccess = details.every((detail) => successConclusions.includes(detail.conclusion || ''));
		return allSuccess ? 'success' : 'pending';
	}

	#buildChecks(pr: GraphQLPullRequest): PullRequestChecks {
		const contexts = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes || [];
		// GraphQL enums are uppercase; the verdict helper compares against REST's lowercase values.
		const details: PullRequestCheckDetail[] = contexts.map((context) =>
			context.__typename === 'CheckRun'
				? {
						name: context.name,
						status: context.status.toLowerCase(),
						conclusion: context.conclusion ? context.conclusion.toLowerCase() : null,
					}
				: { name: context.context, status: 'completed', conclusion: context.state.toLowerCase() },
		);

		if (details.length === 0) {
			return { status: 'unknown', details: [] };
		}

		return { status: this.#resolveCheckVerdict(details), details };
	}

	#resolveReviewVerdict(
		reviewers: Array<{ login: string; avatarUrl: string; state: string }>,
		hasPendingReviewers: boolean,
	): PullRequestReviews['status'] {
		const hasChangesRequested = reviewers.some((r) => r.state === 'CHANGES_REQUESTED');
		if (hasChangesRequested) return 'changes_requested';
		if (hasPendingReviewers) return 'pending';
		if (reviewers.length === 0) return 'pending';

		const allApproved = reviewers.every((r) => r.state === 'APPROVED');
		return allApproved ? 'approved' : 'pending';
	}

	#buildReviews(pr: GraphQLPullRequest): PullRequestReviews {
		const requestedReviewers = (pr.reviewRequests?.nodes || [])
			.map((node) => node.requestedReviewer?.login)
			.filter((login): login is string => !!login);
		const reRequestedSet = new Set(requestedReviewers);
		const reviews = pr.reviews?.nodes || [];
		const reviewerMap = new Map<string, { login: string; avatarUrl: string; state: string }>();

		for (const review of reviews) {
			if (!review.author || review.state === 'PENDING' || review.state === 'COMMENTED') {
				continue;
			}

			if (reRequestedSet.has(review.author.login)) {
				continue;
			}

			reviewerMap.set(review.author.login, {
				login: review.author.login,
				avatarUrl: review.author.avatarUrl,
				state: review.state,
			});
		}

		const reviewers = Array.from(reviewerMap.values());
		const status = this.#resolveReviewVerdict(reviewers, requestedReviewers.length > 0);

		let changesRequestedReviewId: number | undefined;
		let openThreadCount: number | undefined;
		if (status === 'changes_requested') {
			// Reviews come back oldest-first; the last one is the most recent, for deep-linking.
			const changesRequested = reviews.filter((r) => r.state === 'CHANGES_REQUESTED');
			changesRequestedReviewId = changesRequested[changesRequested.length - 1]?.databaseId ?? undefined;

			// Only GraphQL exposes thread resolution state; REST review comments have no
			// isResolved/isOutdated, which is why resolved threads used to be counted as open.
			const threads = pr.reviewThreads?.nodes || [];
			openThreadCount = threads.filter((thread) => !thread.isResolved && !thread.isOutdated).length;
		}

		return { status, reviewers, pendingReviewers: requestedReviewers, openThreadCount, changesRequestedReviewId };
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
				type: this.#resolveOwnerType(pr.repository?.owner?.__typename?.toLowerCase()),
			},
			branchName: pr.headRefName || '',
			author: {
				login: authorLogin,
				avatarUrl: pr.author?.avatarUrl || '',
				name: pr.author?.name || authorLogin,
			},
			state: pr.state.toLowerCase(),
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
			_prNumber: pr.number,
			_repoFullName: repoFullName,
		};
	}

	async #fetchPRsWithQuery(query: string): Promise<PullRequest[]> {
		const data = await this.#graphql<SearchResponse>(SEARCH_QUERY, { q: `${query} sort:updated-desc` });

		if (data.rateLimit) {
			console.debug(`GitHub GraphQL: cost=${data.rateLimit.cost}, remaining=${data.rateLimit.remaining}`);
		}

		return (data.search?.nodes || [])
			.filter((node): node is GraphQLPullRequest => !!node?.id)
			.map((node) => this.#transformPullRequest(node));
	}

	override getMyPullRequests(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('author:@me type:pr state:open');
	}

	override getReviewRequests(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('review-requested:@me type:pr state:open');
	}

	override getReviewedPRs(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('reviewed-by:@me -author:@me type:pr state:open');
	}
}
