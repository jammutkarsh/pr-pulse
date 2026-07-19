import { describe, it, expect } from 'vitest';
import { ProviderError } from '@lib/errors';

describe('ProviderError', () => {
	it('constructs with message, code, and details', () => {
		const error = new ProviderError('something broke', 'AUTH_FAILED', { statusCode: 401, retryable: false });
		expect(error.message).toBe('something broke');
		expect(error.code).toBe('AUTH_FAILED');
		expect(error.details).toEqual({ statusCode: 401, retryable: false });
	});

	it('is an instance of Error', () => {
		const error = new ProviderError('test', 'TEST');
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(ProviderError);
	});

	it('has name set to ProviderError', () => {
		const error = new ProviderError('test', 'TEST');
		expect(error.name).toBe('ProviderError');
	});

	it('defaults details to empty object', () => {
		const error = new ProviderError('test', 'TEST');
		expect(error.details).toEqual({});
	});

	it('has a stack trace', () => {
		const error = new ProviderError('test', 'TEST');
		expect(error.stack).toBeDefined();
	});
});
