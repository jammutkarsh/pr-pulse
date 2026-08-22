import { GitHubProvider } from './providers/github-provider';
import { isAuthError } from './errors';
import { runtimeSendMessage } from './extension-api';
import { storage } from './storage';
import { isValidTokenFormat } from './utils';
import type { StoredProviderConfig } from './types';

/**
 * Everything between "the user typed a token" and "the extension is connected". Onboarding and
 * settings both walk that path; they used to walk it separately, with their own format check, their
 * own error wording and their own commit order, and had already drifted apart on the last one.
 */
export type TokenIntake =
	| { status: 'connected'; provider: StoredProviderConfig }
	/** `tokenInvalid` is the "reconnect" signal — a network blip is a failure but not a dead token. */
	| { status: 'rejected'; error: string; tokenInvalid: boolean };

const CONNECT_FAILED = 'Failed to connect. Check your token and try again.';

/** Token in, connected provider config out. Nothing is written: the caller decides when to commit. */
export async function connectGithubToken(rawToken: string): Promise<TokenIntake> {
	const token = rawToken.trim();

	if (!token) {
		return { status: 'rejected', error: 'Please enter a personal access token.', tokenInvalid: true };
	}

	if (!isValidTokenFormat(token)) {
		return { status: 'rejected', error: 'Invalid token format. Use a valid GitHub personal access token.', tokenInvalid: true };
	}

	try {
		const provider = new GitHubProvider({ token });
		const user = await provider.getUser();
		return { status: 'connected', provider: { type: 'github', token, baseUrl: provider.baseUrl, user } };
	} catch (error) {
		console.error('Failed to authenticate token:', error);
		return {
			status: 'rejected',
			error: error instanceof Error ? error.message : CONNECT_FAILED,
			tokenInvalid: isAuthError(error),
		};
	}
}

/** Store the provider and tell the worker to start polling. One call, so the order cannot drift. */
export async function commitProvider(provider: StoredProviderConfig): Promise<StoredProviderConfig> {
	const stored: StoredProviderConfig = { ...provider, isTokenInvalid: false };
	await storage.setProvider(stored);
	await runtimeSendMessage({ type: 'PROVIDER_CONFIGURED' });
	return stored;
}

export interface TokenExpirationRefresh {
	/** `unreachable` is not `invalid`: a network blip must not clear a token the worker flagged as dead. */
	status: 'valid' | 'invalid' | 'unreachable';
	/** The stored provider, carrying the expiry GitHub just reported. */
	provider: StoredProviderConfig;
}

/**
 * Re-reads the token's expiry, which only the REST user endpoint reports. Its own name because it is
 * a different job from intake — settings used to call the intake path for this and patch the stored
 * user in place, which meant a failed refresh looked like a failed connection.
 */
export async function refreshTokenExpiration(provider: StoredProviderConfig): Promise<TokenExpirationRefresh> {
	const result = await connectGithubToken(provider.token ?? '');

	if (result.status === 'rejected') {
		return { status: result.tokenInvalid ? 'invalid' : 'unreachable', provider };
	}

	const tokenExpiration = result.provider.user?.tokenExpiration;
	if (!provider.user || tokenExpiration === undefined || provider.user.tokenExpiration === tokenExpiration) {
		return { status: 'valid', provider };
	}

	const refreshed: StoredProviderConfig = {
		...provider,
		isTokenInvalid: false,
		user: { ...provider.user, tokenExpiration },
	};
	await storage.setProvider(refreshed);
	return { status: 'valid', provider: refreshed };
}
