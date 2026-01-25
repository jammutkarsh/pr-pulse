import { GitHubProvider } from './providers/github-provider.js';

/**
 * Provider Manager
 * Orchestrates provider(s) and aggregates PR data.
 * Currently supports single provider (v1), designed for future multi-provider support.
 */
export class ProviderManager {
	constructor() {
		this.provider = null;
	}

	/**
	 * Create and set provider based on type
	 * @param {string} type - Provider type ('github', 'gitlab', 'bitbucket')
	 * @param {Object} config - Provider configuration
	 * @returns {BaseProvider}
	 */
	createProvider(type, config) {
		switch (type) {
			case 'github':
				return new GitHubProvider(config);
			// Future: case 'gitlab': return new GitLabProvider(config);
			// Future: case 'bitbucket': return new BitbucketProvider(config);
			default:
				throw new Error(`Unknown provider type: ${type}`);
		}
	}

	/**
	 * Set the active provider
	 * @param {BaseProvider} provider
	 */
	setProvider(provider) {
		this.provider = provider;
	}

	/**
	 * Get the active provider
	 * @returns {BaseProvider|null}
	 */
	getProvider() {
		return this.provider;
	}

	/**
	 * Check if a provider is configured
	 * @returns {boolean}
	 */
	hasProvider() {
		return this.provider !== null;
	}

	/**
	 * Authenticate with the current provider
	 * @returns {Promise<User>}
	 */
	async authenticate() {
		if (!this.provider) {
			throw new Error('No provider configured');
		}
		return this.provider.authenticate();
	}

	/**
	 * Get current user info
	 * @returns {Promise<User>}
	 */
	async getUser() {
		if (!this.provider) {
			throw new Error('No provider configured');
		}
		return this.provider.getUser();
	}

	/**
	 * Get all my PRs
	 * @returns {Promise<PullRequest[]>}
	 */
	async getMyPullRequests() {
		if (!this.provider) {
			throw new Error('No provider configured');
		}
		return this.provider.getMyPullRequests();
	}

	/**
	 * Get all review requests
	 * @returns {Promise<PullRequest[]>}
	 */
	async getReviewRequests() {
		if (!this.provider) {
			throw new Error('No provider configured');
		}
		return this.provider.getReviewRequests();
	}

	/**
	 * Fetch all PR data (both my PRs and review requests)
	 * @returns {Promise<{myPRs: PullRequest[], reviewRequests: PullRequest[]}>}
	 */
	async fetchAllPullRequests() {
		const [myPRs, reviewRequests] = await Promise.all([
			this.getMyPullRequests(),
			this.getReviewRequests(),
		]);
		return { myPRs, reviewRequests };
	}
}

// Singleton instance
export const providerManager = new ProviderManager();
