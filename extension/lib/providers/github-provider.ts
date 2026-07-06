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

type GitHubSearchIssue = {
	id: number;
	number: number;
	title: string;
	html_url: string;
	repository_url?: string;
	user?: { login?: string; avatar_url?: string };
	state: string;
	created_at: string;
	updated_at: string;
	draft?: boolean;
};

type PullRequestDetails = {
	branchName: string;
	changes: PullRequest['changes'];
	repoOwner: PullRequest['repoOwner'];
	requestedReviewers: string[];
	isDraft: boolean;
	_raw: { head?: { sha?: string }; draft?: boolean } & Record<string, unknown>;
};

export class GitHubProvider extends BaseProvider {
	#etagCache = new Map<string, { etag: string; data: unknown }>();
	#repoOwnerCache = new Map<string, PullRequest['repoOwner']>();

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

	#cacheAndReturn<T>(url: string, response: Response, data: T): T {
		const etag = response.headers.get('etag');
		if (etag) {
			this.#etagCache.set(url, { etag, data });
		}
		return data;
	}

	async #request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const cached = this.#etagCache.get(url);
		const headers: Record<string, string> = {
			Accept: 'application/vnd.github.v3+json',
			Authorization: `Bearer ${this.token}`,
			...(options.headers as Record<string, string>),
		};
		if (cached?.etag) {
			headers['If-None-Match'] = cached.etag;
		}

		const response = await fetch(url, { ...options, headers });

		if (response.status === 304 && cached) {
			return cached.data as T;
		}

		if (!response.ok) {
			return this.#throwApiError(response);
		}

		try {
			const data = (await response.json()) as T;
			return this.#cacheAndReturn(url, response, data);
		} catch (error) {
			throw new ProviderError(`Failed to parse GitHub API response: ${(error as Error).message}`, 'PARSE_ERROR', {
				provider: 'github',
			});
		}
	}

	override authenticate(): Promise<User> {
		return this.getUser();
	}

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

	#extractRepoFullName(repositoryUrl: string | undefined): string {
		const match = repositoryUrl?.match(/repos\/(.+)$/);
		return match ? match[1] : '';
	}

	#buildAuthor(issue: GitHubSearchIssue, authorName?: string): PullRequest['author'] {
		const login = issue.user?.login || '';
		return {
			login,
			avatarUrl: issue.user?.avatar_url || '',
			name: authorName || login,
		};
	}

	#transformPullRequest(issue: GitHubSearchIssue, prDetails: PullRequestDetails | null = null, authorName?: string): PullRequest {
		const repoFullName = this.#extractRepoFullName(issue.repository_url);
		const fallbackOwnerLogin = repoFullName.split('/')[0] || '';

		return {
			id: `github-${issue.id}`,
			provider: 'github',
			title: issue.title,
			url: issue.html_url,
			repoFullName,
			repoOwner: prDetails?.repoOwner || { login: fallbackOwnerLogin, type: 'unknown' },
			branchName: prDetails?.branchName || '',
			author: this.#buildAuthor(issue, authorName),
			state: issue.state,
			changes: prDetails?.changes || { additions: 0, deletions: 0, filesChanged: 0 },
			checks: { status: 'unknown', details: [] },
			reviews: { status: 'pending', reviewers: [] },
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			isDraft: prDetails ? prDetails.isDraft : !!issue.draft,
			_prNumber: issue.number,
			_repoFullName: repoFullName,
		};
	}

	async getRepoOwner(repoFullName: string): Promise<PullRequest['repoOwner']> {
		if (!repoFullName) {
			return { login: '', type: 'unknown' };
		}

		const cached = this.#repoOwnerCache.get(repoFullName);
		if (cached) {
			return cached;
		}

		const data = await this.#request<{
			owner?: {
				login?: string;
				type?: string;
			};
		}>(`/repos/${repoFullName}`);

		const repoOwner: PullRequestRepoOwner = {
			login: data.owner?.login || repoFullName.split('/')[0] || '',
			type: this.#resolveOwnerType(data.owner?.type),
		};

		this.#repoOwnerCache.set(repoFullName, repoOwner);
		return repoOwner;
	}

	async #fetchPRsWithQuery(query: string): Promise<PullRequest[]> {
		const data = await this.#request<{ items?: GitHubSearchIssue[] }>(`/search/issues?q=${query}&sort=updated&order=desc`);
		const items = data.items || [];

		return Promise.all(
			items.map(async (issue) => {
				const repoMatch = issue.repository_url?.match(/repos\/(.+)$/);
				const repoFullName = repoMatch ? repoMatch[1] : '';
				const authorLogin = issue.user?.login || '';

				try {
					const prDetails = await this.getPullRequestDetails(repoFullName, issue.number);
					const sha = prDetails._raw?.head?.sha || '';
					const [checks, reviews] = await Promise.all([
						this.getCheckStatus(repoFullName, sha).catch((): PullRequestChecks => ({ status: 'unknown', details: [] })),
						this.getReviewStatus(repoFullName, issue.number, prDetails.requestedReviewers).catch((): PullRequestReviews => ({
							status: 'pending',
							reviewers: [],
						})),
					]);

					return {
						...this.#transformPullRequest(issue, prDetails, authorLogin),
						checks,
						reviews,
					};
				} catch (error) {
					console.warn(`Failed to get details for PR #${issue.number}:`, error);
					const fallbackPullRequest = this.#transformPullRequest(issue, null, authorLogin);
					const repoOwner = await this.getRepoOwner(repoFullName).catch(() => fallbackPullRequest.repoOwner);
					return {
						...fallbackPullRequest,
						repoOwner,
					};
				}
			}),
		);
	}

	override getMyPullRequests(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('author:@me+type:pr+state:open');
	}

	override getReviewRequests(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('review-requested:@me+type:pr+state:open');
	}

	override getReviewedPRs(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('reviewed-by:@me+-author:@me+type:pr+state:open');
	}

	override async getPullRequestDetails(repoFullName: string, prNumber: number): Promise<PullRequestDetails> {
		const data = await this.#request<{
			head?: { ref?: string; sha?: string };
			base?: {
				repo?: {
					owner?: {
						login?: string;
						type?: string;
					};
				};
			};
			additions?: number;
			deletions?: number;
			changed_files?: number;
			requested_reviewers?: Array<{ login: string }>;
			draft?: boolean;
		}>(`/repos/${repoFullName}/pulls/${prNumber}`);

		const repoOwnerLogin = data.base?.repo?.owner?.login || repoFullName.split('/')[0] || '';
		const repoOwner: PullRequestRepoOwner = {
			login: repoOwnerLogin,
			type: this.#resolveOwnerType(data.base?.repo?.owner?.type),
		};

		this.#repoOwnerCache.set(repoFullName, repoOwner);

		return {
			branchName: data.head?.ref || '',
			changes: {
				additions: data.additions || 0,
				deletions: data.deletions || 0,
				filesChanged: data.changed_files || 0,
			},
			repoOwner: repoOwner,
			requestedReviewers: (data.requested_reviewers || []).map((reviewer) => reviewer.login),
			isDraft: !!data.draft,
			_raw: data,
		};
	}

	#resolveCheckVerdict(details: PullRequestCheckDetail[]): PullRequestChecks['status'] {
		const failureConclusions = ['failure', 'timed_out', 'cancelled', 'startup_failure', 'action_required'];
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

	override async getCheckStatus(repoFullName: string, sha: string): Promise<PullRequestChecks> {
		if (!sha) {
			return { status: 'unknown', details: [] };
		}

		const data = await this.#request<{ check_runs?: PullRequestCheckDetail[] }>(
			`/repos/${repoFullName}/commits/${sha}/check-runs?per_page=100`,
		);
		const details = (data.check_runs || []).map((run) => ({
			name: run.name,
			status: run.status,
			conclusion: run.conclusion,
		}));

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

	override async getReviewStatus(repoFullName: string, prNumber: number, requestedReviewers: string[] = []): Promise<PullRequestReviews> {
		const data = await this.#request<Array<{ id: number; state: string; user: { login: string; avatar_url: string } }>>(
			`/repos/${repoFullName}/pulls/${prNumber}/reviews`,
		);
		const reRequestedSet = new Set(requestedReviewers);
		const reviewerMap = new Map<string, { login: string; avatarUrl: string; state: string }>();

		for (const review of data) {
			if (review.state === 'PENDING' || review.state === 'COMMENTED') {
				continue;
			}

			if (reRequestedSet.has(review.user.login)) {
				continue;
			}

			reviewerMap.set(review.user.login, {
				login: review.user.login,
				avatarUrl: review.user.avatar_url,
				state: review.state,
			});
		}

		const reviewers = Array.from(reviewerMap.values());
		const status = this.#resolveReviewVerdict(reviewers, requestedReviewers.length > 0);

		// Capture the most recent changes-requested review ID for deep-linking
		let changesRequestedReviewId: number | undefined;
		let openThreadCount: number | undefined;
		if (status === 'changes_requested') {
			const changesRequestedReviews = data.filter((r) => r.state === 'CHANGES_REQUESTED');
			if (changesRequestedReviews.length > 0) {
				changesRequestedReviewId = changesRequestedReviews[changesRequestedReviews.length - 1].id;
				console.debug(
					`PR #${prNumber}: found ${changesRequestedReviews.length} CHANGES_REQUESTED review(s), latest ID=${changesRequestedReviewId}`,
				);
			} else {
				console.warn(
					`PR #${prNumber}: status=changes_requested but no CHANGES_REQUESTED reviews in data. Review states:`,
					data.map((r) => `${r.id}:${r.state}`),
				);
			}

			try {
				// REST API doesn't expose resolved/unresolved, so we count top-level review comments as a proxy for open threads
				const comments = await this.#request<Array<{ in_reply_to_id?: number }>>(
					`/repos/${repoFullName}/pulls/${prNumber}/comments?per_page=100&sort=created&direction=desc`,
				);
				openThreadCount = comments.filter((c) => !c.in_reply_to_id).length;
			} catch (error) {
				console.warn(`Failed to count open threads for PR #${prNumber}:`, error);
			}
		}

		return { status, reviewers, pendingReviewers: requestedReviewers, openThreadCount, changesRequestedReviewId };
	}
}
