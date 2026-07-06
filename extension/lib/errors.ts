import type { ProviderErrorDetails } from './types';

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
