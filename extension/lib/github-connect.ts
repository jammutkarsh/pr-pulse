import { GitHubProvider } from './providers/github-provider';
import type { StoredProviderConfig } from './types';

/**
 * Token in, stored provider config out. Callers need to know none of: which provider class to load,
 * how to construct it, which call validates a token, the API base URL, or the config shape.
 * Persisting stays with the caller — onboarding only commits once the whole flow completes.
 */
export async function connectGithubToken(token: string): Promise<StoredProviderConfig> {
	const provider = new GitHubProvider({ token });
	const user = await provider.getUser();

	return { type: 'github', token, baseUrl: provider.baseUrl, user };
}
