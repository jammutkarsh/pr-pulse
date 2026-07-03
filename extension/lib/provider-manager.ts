import { ProviderError } from './errors';
import { GitHubProvider } from './providers/github-provider';
import type { BaseProvider } from './providers/base-provider';
import type { ProviderConfig, PullRequestData, ProviderType } from './types';

type ProviderClass = new (config?: ProviderConfig) => BaseProvider;

class ProviderManager {
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
				'UNKNOWN_PROVIDER',
			);
		}

		return new ProviderClass(config);
	}

	setProvider(provider: BaseProvider): void {
		this.provider = provider;
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

	async fetchAllPullRequests(): Promise<PullRequestData> {
		const provider = this.#ensureProvider();

		// ponytail: 3 parallel queries — the 3rd (reviewed-by) adds one extra GitHub search call per refresh.
		// Gate behind a flag if rate limits ever matter.
		const [myPRs, reviewRequests, reviewedPRs] = await Promise.all([
			provider.getMyPullRequests(),
			provider.getReviewRequests(),
			provider.getReviewedPRs(),
		]);

		const seen = new Set(reviewRequests.map((pr) => pr.id));
		const mergedReviewRequests = [...reviewRequests];
		for (const pr of reviewedPRs) {
			if (!seen.has(pr.id)) {
				seen.add(pr.id);
				mergedReviewRequests.push(pr);
			}
		}

		return {
			myPRs,
			reviewRequests: mergedReviewRequests,
			lastFetched: null,
		};
	}
}

export const providerManager = new ProviderManager();
