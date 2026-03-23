/**
 * Structured error class for provider-related errors.
 * Provides error codes and optional metadata (status code, retryable flag, etc.)
 * for better error handling by consumers.
 *
 * @example
 * throw new ProviderError('GitHub API error: 403', 'API_ERROR', { statusCode: 403, retryable: false });
 *
 * @example
 * try { ... } catch (e) {
 *   if (e instanceof ProviderError && e.code === 'NO_PROVIDER') { ... }
 * }
 */
export class ProviderError extends Error {
	/**
	 * @param {string} message - Human-readable error message
	 * @param {string} code - Machine-readable error code (e.g., 'API_ERROR', 'NO_PROVIDER', 'PARSE_ERROR', 'UNKNOWN_PROVIDER')
	 * @param {Object} [details={}] - Optional metadata
	 * @param {number} [details.statusCode] - HTTP status code (for API errors)
	 * @param {boolean} [details.retryable] - Whether the operation can be retried
	 * @param {string} [details.provider] - Provider name that generated the error
	 */
	constructor(message, code, details = {}) {
		super(message);
		this.name = 'ProviderError';
		this.code = code;
		this.details = details;
	}

	/**
	 * Whether this error is safe to retry
	 * @returns {boolean}
	 */
	get retryable() {
		return this.details.retryable === true;
	}

	/**
	 * HTTP status code, if applicable
	 * @returns {number|undefined}
	 */
	get statusCode() {
		return this.details.statusCode;
	}
}
