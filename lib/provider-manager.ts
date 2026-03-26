import { ProviderError } from './errors';
import { GitHubProvider } from './providers/github-provider';
import type { BaseProvider } from './providers/base-provider';
import type { ProviderConfig, PullRequestData, ProviderType, User, PullRequest } from './types';

type ProviderClass = new (config?: ProviderConfig) => BaseProvider;

export class ProviderManager {
	#registry = new Map<ProviderType, ProviderClass>();
	provider: BaseProvider | null = null;

	constructor() {
		this.registerProvider('github', GitHubProvider);
	}

	registerProvider(type: ProviderType, ProviderClass: ProviderClass): void {
		this.#registry.set(type, ProviderClass);
	}

	getRegisteredTypes(): ProviderType[] {
		return Array.from(this.#registry.keys());
	}

	createProvider(type: ProviderType, config: ProviderConfig): BaseProvider {
		const ProviderClass = this.#registry.get(type);
		if (!ProviderClass) {
			throw new ProviderError(
				`Unknown provider type: ${type}. Registered types: ${this.getRegisteredTypes().join(', ')}`,
				'UNKNOWN_PROVIDER'
			);
		}

		return new ProviderClass(config);
	}

	setProvider(provider: BaseProvider): void {
		this.provider = provider;
	}

	getProvider(): BaseProvider | null {
		return this.provider;
	}

	hasProvider(): boolean {
		return this.provider !== null;
	}

	#ensureProvider(): BaseProvider {
		if (!this.provider) {
			throw new ProviderError('No provider configured', 'NO_PROVIDER');
		}

		return this.provider;
	}

	authenticate(): Promise<User> {
		return this.#ensureProvider().authenticate();
	}

	getUser(): Promise<User> {
		return this.#ensureProvider().getUser();
	}

	getMyPullRequests(): Promise<PullRequest[]> {
		return this.#ensureProvider().getMyPullRequests();
	}

	getReviewRequests(): Promise<PullRequest[]> {
		return this.#ensureProvider().getReviewRequests();
	}

	async fetchAllPullRequests(): Promise<PullRequestData> {
		const [myPRs, reviewRequests] = await Promise.all([
			this.getMyPullRequests(),
			this.getReviewRequests(),
		]);

		return {
			myPRs,
			reviewRequests,
			lastFetched: null,
		};
	}
}

export const providerManager = new ProviderManager();