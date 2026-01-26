/**
 * Utility Functions
 */

/**
 * Extract Jira ticket ID from branch name
 * Supports patterns like:
 * - feat/JIRA-1234/description
 * - PROJ-123-fix-something
 * - bugfix/ABC-99/details
 * 
 * @param {string} branchName - Git branch name
 * @returns {string|null} - Jira ticket ID or null
 */
export function extractJiraTicket(branchName) {
	if (!branchName) return null;

	// Match pattern: letters followed by hyphen and numbers (e.g., JIRA-1234, PROJ-99)
	const match = branchName.match(/([A-Z]+-\d+)/i);
	return match ? match[1].toUpperCase() : null;
}

/**
 * Sanitize Jira URL to extract the origin (protocol + host)
 * Handles various input formats and returns just the origin:
 * - https://company.atlassian.net/browse/PROJ-123 → https://company.atlassian.net
 * - https://company.atlassian.net/browse → https://company.atlassian.net
 * - https://company.atlassian.net → https://company.atlassian.net
 * - company.atlassian.net/browse/PROJ-123 → https://company.atlassian.net
 * 
 * @param {string} url - User-provided Jira URL
 * @returns {string} - Sanitized origin URL (e.g., https://company.atlassian.net)
 */
export function sanitizeJiraUrl(url) {
	if (!url) return '';

	let cleanUrl = url.trim();

	// Add https:// if no protocol
	if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
		cleanUrl = 'https://' + cleanUrl;
	}

	try {
		const urlObj = new URL(cleanUrl);
		
		// Security: Only allow http/https protocols to prevent javascript:/data: attacks
		if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
			return '';
		}
		
		// Return just the origin (e.g., https://advergame.atlassian.net)
		return urlObj.origin;
	} catch (e) {
		// If URL parsing fails, return empty string for security
		// Don't attempt partial extraction as it could be malicious
		return '';
	}
}

/**
 * Construct Jira URL from ticket ID and base URL
 * @param {string} ticketId - Jira ticket ID (e.g., JIRA-1234)
 * @param {string} baseUrl - Jira base URL (e.g., https://company.atlassian.net/browse)
 * @returns {string} - Full Jira URL
 */
export function getJiraUrl(ticketId, baseUrl) {
	if (!ticketId || !baseUrl) return '';

	// Sanitize the base URL first (this returns origin e.g. https://company.atlassian.net)
	const cleanBaseUrl = sanitizeJiraUrl(baseUrl);
	return `${cleanBaseUrl}/browse/${ticketId}`;
}

/**
 * Format lines changed as "+additions -deletions"
 * @param {number} additions - Lines added
 * @param {number} deletions - Lines deleted
 * @returns {string} - Formatted string (e.g., "+125 -42")
 */
export function formatLinesChanged(additions, deletions) {
	return `+${additions} -${deletions}`;
}

/**
 * Get human-readable review status label
 * @param {string} status - Review status ('approved', 'changes_requested', 'pending')
 * @returns {Object} - { label, icon, className }
 */
export function getReviewStatusDisplay(status) {
	switch (status) {
		case 'approved':
			return { label: 'Approved', icon: '✓', className: 'status-approved' };
		case 'changes_requested':
			return { label: 'Changes Requested', icon: '✗', className: 'status-changes' };
		case 'pending':
		default:
			return { label: 'Pending Review', icon: '⏳', className: 'status-pending' };
	}
}

/**
 * Get human-readable check status display
 * @param {string} status - Check status ('success', 'failure', 'pending', 'unknown')
 * @returns {Object} - { label, icon, className }
 */
export function getCheckStatusDisplay(status) {
	switch (status) {
		case 'success':
			return { label: 'Checks Passing', icon: '✓', className: 'checks-success' };
		case 'failure':
			return { label: 'Checks Failing', icon: '✗', className: 'checks-failure' };
		case 'pending':
			return { label: 'Checks Running', icon: '⏳', className: 'checks-pending' };
		case 'unknown':
		default:
			return { label: 'No Checks', icon: '○', className: 'checks-unknown' };
	}
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength = 50) {
	if (!text || text.length <= maxLength) return text;
	return text.substring(0, maxLength - 3) + '...';
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(text);
	} catch (err) {
		// Fallback for older browsers
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-9999px';
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
	}
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} - Relative time string
 */
export function formatRelativeTime(date) {
	const now = new Date();
	const then = new Date(date);
	const diffMs = now - then;
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return 'just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return then.toLocaleDateString();
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Validate that a URL is safe to open (https:// or http://)
 * Prevents javascript:, data:, and other dangerous protocols
 * @param {string} url - URL to validate
 * @returns {boolean} - True if URL is safe
 */
export function isValidHttpUrl(url) {
	if (!url || typeof url !== 'string') return false;
	
	try {
		const urlObj = new URL(url);
		return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
	} catch (e) {
		return false;
	}
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeHtml(str) {
	if (!str || typeof str !== 'string') return '';
	
	const htmlEscapes = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	};
	
	return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Validate GitHub token format
 * GitHub PATs have specific formats:
 * - Classic tokens: ghp_ followed by 36 alphanumeric characters
 * - Fine-grained tokens: github_pat_ followed by alphanumeric characters
 * @param {string} token - Token to validate
 * @returns {boolean} - True if token format is valid
 */
export function isValidTokenFormat(token) {
	if (!token || typeof token !== 'string') return false;
	
	// Classic PAT: ghp_ followed by 36 alphanumeric chars
	// Format based on GitHub classic PAT documentation and commonly observed tokens.
	// See: https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
	// Last verified against GitHub documentation: 2026-01
	const classicPattern = /^ghp_[a-zA-Z0-9]{36}$/;
	// Fine-grained PAT: github_pat_ followed by alphanumeric chars and underscores
	// Format based on GitHub fine-grained PAT documentation and commonly observed tokens.
	// See: https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
	// Last verified against GitHub documentation: 2026-01
	const fineGrainedPattern = /^github_pat_[a-zA-Z0-9_]{22,}$/;
	
	return classicPattern.test(token) || fineGrainedPattern.test(token);
}

/**
 * Safely parse an integer value, returning a default if invalid
 * @param {any} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} - Parsed integer or default
 */
export function safeParseInt(value, defaultValue = 0) {
	if (value === null || value === undefined) return defaultValue;
	const parsed = parseInt(String(value), 10);
	return Number.isNaN(parsed) ? defaultValue : parsed;
}
