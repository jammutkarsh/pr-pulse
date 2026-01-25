/**
 * Base Provider Interface
 * All git platform providers must implement this interface.
 * 
 * @typedef {Object} User
 * @property {string} login - Username
 * @property {string} avatarUrl - Avatar URL
 * @property {string} name - Display name
 * 
 * @typedef {Object} PullRequest
 * @property {string} id - Unique identifier (provider-prefixed, e.g., 'github-123')
 * @property {string} provider - 'github' | 'gitlab' | 'bitbucket'
 * @property {string} title - PR title
 * @property {string} url - Web URL to the PR
 * @property {string} repoFullName - 'owner/repo' format
 * @property {string} branchName - Source branch name
 * @property {Object} author - { login, avatarUrl, name }
 * @property {string} state - 'open' | 'merged' | 'closed'
 * @property {Object} changes - { additions, deletions, filesChanged }
 * @property {Object} checks - { status: 'success'|'failure'|'pending'|'unknown', details: [] }
 * @property {Object} reviews - { status: 'approved'|'changes_requested'|'pending', reviewers: [] }
 * @property {string} createdAt - ISO date string
 * @property {string} updatedAt - ISO date string
 */

export class BaseProvider {
	constructor(config = {}) {
		this.name = 'base';
		this.displayName = 'Base Provider';
		this.baseUrl = '';
		this.token = config.token || '';
	}

	/**
	 * Validate the token and return user info
	 * @returns {Promise<User>}
	 */
	async authenticate() {
		throw new Error('authenticate() not implemented');
	}

	/**
	 * Get current authenticated user info
	 * @returns {Promise<User>}
	 */
	async getUser() {
		throw new Error('getUser() not implemented');
	}

	/**
	 * Get PRs created by the authenticated user
	 * @returns {Promise<PullRequest[]>}
	 */
	async getMyPullRequests() {
		throw new Error('getMyPullRequests() not implemented');
	}

	/**
	 * Get PRs where user is requested as reviewer
	 * @returns {Promise<PullRequest[]>}
	 */
	async getReviewRequests() {
		throw new Error('getReviewRequests() not implemented');
	}

	/**
	 * Get detailed info for a specific PR
	 * @param {string} repoFullName - 'owner/repo' format
	 * @param {number} prNumber - PR number
	 * @returns {Promise<PullRequest>}
	 */
	async getPullRequestDetails(repoFullName, prNumber) {
		throw new Error('getPullRequestDetails() not implemented');
	}

	/**
	 * Get CI/CD check status for a PR
	 * @param {string} repoFullName - 'owner/repo' format
	 * @param {string} commitSha - Commit SHA
	 * @returns {Promise<Object>}
	 */
	async getCheckStatus(repoFullName, commitSha) {
		throw new Error('getCheckStatus() not implemented');
	}

	/**
	 * Get review status for a PR
	 * @param {string} repoFullName - 'owner/repo' format
	 * @param {number} prNumber - PR number
	 * @returns {Promise<Object>}
	 */
	async getReviewStatus(repoFullName, prNumber) {
		throw new Error('getReviewStatus() not implemented');
	}
}
