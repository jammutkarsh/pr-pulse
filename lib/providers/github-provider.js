import { BaseProvider } from './base-provider.js';

/**
 * GitHub Provider Implementation
 * Implements the BaseProvider interface for GitHub API
 */
export class GitHubProvider extends BaseProvider {
	constructor(config = {}) {
		super(config);
		this.name = 'github';
		this.displayName = 'GitHub';
		this.baseUrl = config.baseUrl || 'https://api.github.com';
	}

	/**
	 * Make an authenticated API request to GitHub
	 * @param {string} endpoint - API endpoint (relative to baseUrl)
	 * @param {Object} options - Fetch options
	 * @returns {Promise<Object>}
	 */
	async #request(endpoint, options = {}) {
		const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

		const response = await fetch(url, {
			...options,
			headers: {
				'Accept': 'application/vnd.github.v3+json',
				'Authorization': `Bearer ${this.token}`,
				...options.headers,
			},
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error.message || `GitHub API error: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Validate the token and return user info
	 * @returns {Promise<User>}
	 */
	async authenticate() {
		return this.getUser();
	}

	/**
	 * Get current authenticated user info
	 * @returns {Promise<User>}
	 */
	async getUser() {
		const data = await this.#request('/user');
		return {
			login: data.login,
			avatarUrl: data.avatar_url,
			name: data.name || data.login,
		};
	}

	/**
	 * Transform GitHub PR data to standard PullRequest format
	 * @param {Object} issue - GitHub issue/PR from search API
	 * @param {Object} prDetails - Optional PR details
	 * @returns {PullRequest}
	 */
	#transformPullRequest(issue, prDetails = null) {
		// Extract owner/repo from repository_url
		const repoMatch = issue.repository_url?.match(/repos\/(.+)$/);
		const repoFullName = repoMatch ? repoMatch[1] : '';

		return {
			id: `github-${issue.id}`,
			provider: 'github',
			title: issue.title,
			url: issue.html_url,
			repoFullName,
			branchName: prDetails?.head?.ref || '',
			author: {
				login: issue.user?.login || '',
				avatarUrl: issue.user?.avatar_url || '',
				name: issue.user?.login || '',
			},
			state: issue.state,
			changes: {
				additions: prDetails?.additions || 0,
				deletions: prDetails?.deletions || 0,
				filesChanged: prDetails?.changed_files || 0,
			},
			checks: {
				status: 'unknown',
				details: [],
			},
			reviews: {
				status: 'pending',
				reviewers: [],
			},
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			// Store for later fetching details
			_prNumber: issue.number,
			_repoFullName: repoFullName,
		};
	}

	/**
	 * Get PRs created by the authenticated user
	 * @returns {Promise<PullRequest[]>}
	 */
	async getMyPullRequests() {
		const data = await this.#request('/search/issues?q=author:@me+type:pr+state:open&sort=updated&order=desc');

		// Get detailed info for each PR
		const prs = await Promise.all(
			data.items.map(async (issue) => {
				const repoMatch = issue.repository_url?.match(/repos\/(.+)$/);
				const repoFullName = repoMatch ? repoMatch[1] : '';

				try {
					// Fetch PR details first to get requestedReviewers
					const prDetails = await this.getPullRequestDetails(repoFullName, issue.number);

					// Then fetch checks and reviews in parallel, passing requestedReviewers
					const [checks, reviews] = await Promise.all([
						this.getCheckStatus(repoFullName, issue.number).catch(() => ({ status: 'unknown', details: [] })),
						this.getReviewStatus(repoFullName, issue.number, prDetails.requestedReviewers).catch(() => ({ status: 'pending', reviewers: [] })),
					]);

					return {
						...this.#transformPullRequest(issue, prDetails),
						branchName: prDetails.branchName,
						changes: prDetails.changes,
						checks,
						reviews,
					};
				} catch (error) {
					console.warn(`Failed to get details for PR #${issue.number}:`, error);
					return this.#transformPullRequest(issue);
				}
			})
		);

		return prs;
	}

	/**
	 * Get PRs where user is requested as reviewer
	 * @returns {Promise<PullRequest[]>}
	 */
	async getReviewRequests() {
		const data = await this.#request('/search/issues?q=review-requested:@me+type:pr+state:open&sort=updated&order=desc');

		// Get detailed info for each PR
		const prs = await Promise.all(
			data.items.map(async (issue) => {
				const repoMatch = issue.repository_url?.match(/repos\/(.+)$/);
				const repoFullName = repoMatch ? repoMatch[1] : '';

				try {
					// Fetch PR details first to get requestedReviewers
					const prDetails = await this.getPullRequestDetails(repoFullName, issue.number);

					// Then fetch checks and reviews in parallel, passing requestedReviewers
					const [checks, reviews] = await Promise.all([
						this.getCheckStatus(repoFullName, issue.number).catch(() => ({ status: 'unknown', details: [] })),
						this.getReviewStatus(repoFullName, issue.number, prDetails.requestedReviewers).catch(() => ({ status: 'pending', reviewers: [] })),
					]);

					return {
						...this.#transformPullRequest(issue, prDetails),
						branchName: prDetails.branchName,
						changes: prDetails.changes,
						checks,
						reviews,
					};
				} catch (error) {
					console.warn(`Failed to get details for PR #${issue.number}:`, error);
					return this.#transformPullRequest(issue);
				}
			})
		);

		return prs;
	}

	/**
	 * Get detailed info for a specific PR
	 * @param {string} repoFullName - 'owner/repo' format
	 * @param {number} prNumber - PR number
	 * @returns {Promise<Object>}
	 */
	async getPullRequestDetails(repoFullName, prNumber) {
		const data = await this.#request(`/repos/${repoFullName}/pulls/${prNumber}`);

		return {
			branchName: data.head?.ref || '',
			changes: {
				additions: data.additions || 0,
				deletions: data.deletions || 0,
				filesChanged: data.changed_files || 0,
			},
			// Track who has been (re-)requested for review
			requestedReviewers: (data.requested_reviewers || []).map(r => r.login),
			_raw: data,
		};
	}

	/**
	 * Get CI/CD check status for a PR
	 * @param {string} repoFullName - 'owner/repo' format
	 * @param {number} prNumber - PR number
	 * @returns {Promise<Object>}
	 */
	async getCheckStatus(repoFullName, prNumber) {
		// First get the PR to get the head SHA
		const pr = await this.#request(`/repos/${repoFullName}/pulls/${prNumber}`);
		const sha = pr.head?.sha;

		if (!sha) {
			return { status: 'unknown', details: [] };
		}

		// Get check runs for commit
		const data = await this.#request(`/repos/${repoFullName}/commits/${sha}/check-runs?per_page=100`);

		const details = (data.check_runs || []).map(run => ({
			name: run.name,
			status: run.status,
			conclusion: run.conclusion,
		}));

		// Determine overall status
		// If no checks exist, return 'unknown' (displays as "No Checks")
		if (details.length === 0) {
			return { status: 'unknown', details: [] };
		}

		// Check for failures first - if any check failed, the status is failure
		// even if others are still running
		// Include timed_out and cancelled as failures
		const failureConclusions = ['failure', 'timed_out', 'cancelled', 'startup_failure', 'action_required'];
		const anyFailure = details.some(d => failureConclusions.includes(d.conclusion));

		if (anyFailure) {
			return { status: 'failure', details };
		}

		let status = 'pending';
		const allComplete = details.every(d => d.status === 'completed');
		if (allComplete) {
			// If all are completed, valid states for success include success, skipped, neutral
			const successConclusions = ['success', 'skipped', 'neutral'];
			const allSuccess = details.every(d => successConclusions.includes(d.conclusion));
			status = allSuccess ? 'success' : 'pending';
		}

		return { status, details };
	}

	/**
	 * Get review status for a PR
	 * @param {string} repoFullName - 'owner/repo' format
	 * @param {number} prNumber - PR number
	 * @param {string[]} requestedReviewers - Logins of users who have been (re-)requested for review
	 * @returns {Promise<Object>}
	 */
	async getReviewStatus(repoFullName, prNumber, requestedReviewers = []) {
		const data = await this.#request(`/repos/${repoFullName}/pulls/${prNumber}/reviews`);

		// Create a set of users who have been re-requested for review
		// Their previous review should be ignored since new review is pending
		const reRequestedSet = new Set(requestedReviewers);

		// Get latest review from each reviewer
		const reviewerMap = new Map();
		for (const review of data) {
			if (review.state !== 'PENDING' && review.state !== 'COMMENTED') {
				const login = review.user.login;

				// If this reviewer has been re-requested, skip their previous review
				if (reRequestedSet.has(login)) {
					continue;
				}

				reviewerMap.set(login, {
					login: login,
					avatarUrl: review.user.avatar_url,
					state: review.state,
				});
			}
		}

		const reviewers = Array.from(reviewerMap.values());

		// Determine overall status
		// - If there are pending re-requested reviewers, show as pending
		// - If any reviewer (not re-requested) has CHANGES_REQUESTED, show as changes_requested
		// - If all reviewers (not re-requested) have APPROVED and no pending re-requests, show as approved
		let status = 'pending';

		if (requestedReviewers.length > 0) {
			// There are pending review requests, so overall status is pending
			// unless there are also unaddressed changes requested from other reviewers
			const hasChangesRequested = reviewers.some(r => r.state === 'CHANGES_REQUESTED');
			status = hasChangesRequested ? 'changes_requested' : 'pending';
		} else if (reviewers.length > 0) {
			const hasChangesRequested = reviewers.some(r => r.state === 'CHANGES_REQUESTED');
			const allApproved = reviewers.every(r => r.state === 'APPROVED');
			status = hasChangesRequested ? 'changes_requested' : allApproved ? 'approved' : 'pending';
		}

		return { status, reviewers, pendingReviewers: requestedReviewers };
	}
}
