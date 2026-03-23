import { GitHubProvider } from './providers/github-provider.js';
import { ProviderError } from './errors.js';

/**
 * Provider Manager
 * Orchestrates provider(s) and aggregates PR data.
 * Uses a registry pattern for extensible provider support.
 */
export class ProviderManager {
	/** @type {Map<string, typeof BaseProvider>} */
	#registry = new Map();

	constructor() {
		this.provider = null;

		// Register built-in providers
		this.registerProvider('github', GitHubProvider);
	}

	/**
	 * Register a provider class for a given type.
	 * Use this to add new providers (e.g., GitLab, Bitbucket) without modifying this file.
	 * @param {string} type - Provider type identifier (e.g., 'github', 'gitlab')
	 * @param {typeof BaseProvider} ProviderClass - The provider class to register
	 */
	registerProvider(type, ProviderClass) {
		this.#registry.set(type, ProviderClass);
	}

	/**
	 * Get all registered provider types
	 * @returns {string[]}
	 */
	getRegisteredTypes() {
		return Array.from(this.#registry.keys());
	}

	/**
	 * Create a provider instance based on type
	 * @param {string} type - Provider type ('github', 'gitlab', 'bitbucket')
	 * @param {Object} config - Provider configuration
	 * @returns {BaseProvider}
	 */
	createProvider(type, config) {
		const ProviderClass = this.#registry.get(type);
		if (!ProviderClass) {
			throw new ProviderError(
				`Unknown provider type: ${type}. Registered types: ${this.getRegisteredTypes().join(', ')}`,
				'UNKNOWN_PROVIDER'
			);
		}
		return new ProviderClass(config);
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
	 * Ensure a provider is configured, throw if not
	 * @returns {BaseProvider}
	 * @throws {ProviderError}
	 */
	#ensureProvider() {
		if (!this.provider) {
			throw new ProviderError('No provider configured', 'NO_PROVIDER');
		}
		return this.provider;
	}

	/**
	 * Authenticate with the current provider
	 * @returns {Promise<User>}
	 */
	async authenticate() {
		return this.#ensureProvider().authenticate();
	}

	/**
	 * Get current user info
	 * @returns {Promise<User>}
	 */
	async getUser() {
		return this.#ensureProvider().getUser();
	}

	/**
	 * Get all my PRs
	 * @returns {Promise<PullRequest[]>}
	 */
	async getMyPullRequests() {
		return this.#ensureProvider().getMyPullRequests();
	}

	/**
	 * Get all review requests
	 * @returns {Promise<PullRequest[]>}
	 */
	async getReviewRequests() {
		return this.#ensureProvider().getReviewRequests();
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
