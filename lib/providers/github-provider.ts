import { ProviderError } from '../errors';
import type { PullRequest, PullRequestCheckDetail, PullRequestChecks, PullRequestReviews, ProviderConfig, User } from '../types';
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
};

type PullRequestDetails = {
	branchName: string;
	changes: PullRequest['changes'];
	requestedReviewers: string[];
	_raw: { head?: { sha?: string } } & Record<string, unknown>;
};

export class GitHubProvider extends BaseProvider {
	constructor(config: ProviderConfig = {}) {
		super(config);
		this.name = 'github';
		this.displayName = 'GitHub';
		this.baseUrl = config.baseUrl || 'https://api.github.com';
	}

	async #request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const response = await fetch(url, {
			...options,
			headers: {
				Accept: 'application/vnd.github.v3+json',
				Authorization: `Bearer ${this.token}`,
				...options.headers,
			},
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({} as { message?: string }));
			const statusCode = response.status;
			const retryable = statusCode === 429 || statusCode >= 500;
			throw new ProviderError(error.message || `GitHub API error: ${statusCode}`, 'API_ERROR', {
				statusCode,
				retryable,
				provider: 'github',
			});
		}

		try {
			return await response.json() as T;
		} catch (error) {
			throw new ProviderError(`Failed to parse GitHub API response: ${(error as Error).message}`, 'PARSE_ERROR', {
				provider: 'github',
			});
		}
	}

	authenticate(): Promise<User> {
		return this.getUser();
	}

	async getUser(): Promise<User> {
		const data = await this.#request<{ login: string; avatar_url: string; name?: string }>('/user');
		return {
			login: data.login,
			avatarUrl: data.avatar_url,
			name: data.name || data.login,
		};
	}

	#transformPullRequest(issue: GitHubSearchIssue, prDetails: PullRequestDetails | null = null): PullRequest {
		const repoMatch = issue.repository_url?.match(/repos\/(.+)$/);
		const repoFullName = repoMatch ? repoMatch[1] : '';

		return {
			id: `github-${issue.id}`,
			provider: 'github',
			title: issue.title,
			url: issue.html_url,
			repoFullName,
			branchName: prDetails?.branchName || '',
			author: {
				login: issue.user?.login || '',
				avatarUrl: issue.user?.avatar_url || '',
				name: issue.user?.login || '',
			},
			state: issue.state,
			changes: prDetails?.changes || { additions: 0, deletions: 0, filesChanged: 0 },
			checks: { status: 'unknown', details: [] },
			reviews: { status: 'pending', reviewers: [] },
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			_prNumber: issue.number,
			_repoFullName: repoFullName,
		};
	}

	async #fetchPRsWithQuery(query: string): Promise<PullRequest[]> {
		const data = await this.#request<{ items?: GitHubSearchIssue[] }>(`/search/issues?q=${query}&sort=updated&order=desc`);
		const items = data.items || [];

		return Promise.all(
			items.map(async (issue) => {
				const repoMatch = issue.repository_url?.match(/repos\/(.+)$/);
				const repoFullName = repoMatch ? repoMatch[1] : '';

				try {
					const prDetails = await this.getPullRequestDetails(repoFullName, issue.number);
					const sha = prDetails._raw?.head?.sha || '';
					const [checks, reviews] = await Promise.all([
						this.getCheckStatus(repoFullName, sha).catch((): PullRequestChecks => ({ status: 'unknown', details: [] })),
						this.getReviewStatus(repoFullName, issue.number, prDetails.requestedReviewers).catch((): PullRequestReviews => ({ status: 'pending', reviewers: [] })),
					]);

					return {
						...this.#transformPullRequest(issue, prDetails),
						checks,
						reviews,
					};
				} catch (error) {
					console.warn(`Failed to get details for PR #${issue.number}:`, error);
					return this.#transformPullRequest(issue);
				}
			})
		);
	}

	getMyPullRequests(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('author:@me+type:pr+state:open');
	}

	getReviewRequests(): Promise<PullRequest[]> {
		return this.#fetchPRsWithQuery('review-requested:@me+type:pr+state:open');
	}

	async getPullRequestDetails(repoFullName: string, prNumber: number): Promise<PullRequestDetails> {
		const data = await this.#request<{
			head?: { ref?: string; sha?: string };
			additions?: number;
			deletions?: number;
			changed_files?: number;
			requested_reviewers?: Array<{ login: string }>;
		}>(`/repos/${repoFullName}/pulls/${prNumber}`);

		return {
			branchName: data.head?.ref || '',
			changes: {
				additions: data.additions || 0,
				deletions: data.deletions || 0,
				filesChanged: data.changed_files || 0,
			},
			requestedReviewers: (data.requested_reviewers || []).map((reviewer) => reviewer.login),
			_raw: data,
		};
	}

	async getCheckStatus(repoFullName: string, sha: string): Promise<PullRequestChecks> {
		if (!sha) {
			return { status: 'unknown', details: [] };
		}

		const data = await this.#request<{ check_runs?: PullRequestCheckDetail[] }>(`/repos/${repoFullName}/commits/${sha}/check-runs?per_page=100`);
		const details = (data.check_runs || []).map((run) => ({
			name: run.name,
			status: run.status,
			conclusion: run.conclusion,
		}));

		if (details.length === 0) {
			return { status: 'unknown', details: [] };
		}

		const failureConclusions = ['failure', 'timed_out', 'cancelled', 'startup_failure', 'action_required'];
		if (details.some((detail) => failureConclusions.includes(detail.conclusion || ''))) {
			return { status: 'failure', details };
		}

		const allComplete = details.every((detail) => detail.status === 'completed');
		if (allComplete) {
			const successConclusions = ['success', 'skipped', 'neutral'];
			const allSuccess = details.every((detail) => successConclusions.includes(detail.conclusion || ''));
			return { status: allSuccess ? 'success' : 'pending', details };
		}

		return { status: 'pending', details };
	}

	async getReviewStatus(repoFullName: string, prNumber: number, requestedReviewers: string[] = []): Promise<PullRequestReviews> {
		const data = await this.#request<Array<{ state: string; user: { login: string; avatar_url: string } }>>(`/repos/${repoFullName}/pulls/${prNumber}/reviews`);
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
		let status: PullRequestReviews['status'] = 'pending';

		if (requestedReviewers.length > 0) {
			status = reviewers.some((reviewer) => reviewer.state === 'CHANGES_REQUESTED') ? 'changes_requested' : 'pending';
		} else if (reviewers.length > 0) {
			const hasChangesRequested = reviewers.some((reviewer) => reviewer.state === 'CHANGES_REQUESTED');
			const allApproved = reviewers.every((reviewer) => reviewer.state === 'APPROVED');
			status = hasChangesRequested ? 'changes_requested' : allApproved ? 'approved' : 'pending';
		}

		return { status, reviewers, pendingReviewers: requestedReviewers };
	}
}