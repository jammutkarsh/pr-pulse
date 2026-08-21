import type { ProviderErrorDetails } from './types';

export const AUTH_ERROR_CODE = 'AUTH_ERROR';

export class ProviderError extends Error {
	code: string;
	details: ProviderErrorDetails;

	constructor(message: string, code: string, details: ProviderErrorDetails = {}) {
		super(message);
		this.name = 'ProviderError';
		this.code = code;
		this.details = details;
	}
}

/**
 * The one place "this token is dead" is decided. Callers used to re-derive it from a status code and a
 * substring of the message, three times over — which meant the provider's HTTP status was part of its
 * interface by accident. Structural check, not `instanceof`: an error that crossed a runtime message
 * boundary is a plain object by the time anyone inspects it.
 */
export function isAuthError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const candidate = error as { code?: string; details?: ProviderErrorDetails };
	return candidate.code === AUTH_ERROR_CODE || candidate.details?.statusCode === 401;
}
