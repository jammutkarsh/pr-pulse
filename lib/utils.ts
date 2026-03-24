export function extractJiraTicket(branchName: string): string | null {
	if (!branchName) return null;
	const match = branchName.match(/([A-Z]+-\d+)/i);
	return match ? match[1].toUpperCase() : null;
}

export function sanitizeJiraUrl(url: string): string {
	if (!url) return '';
	let cleanUrl = url.trim();

	if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
		cleanUrl = `https://${cleanUrl}`;
	}

	try {
		const urlObject = new URL(cleanUrl);
		if (urlObject.protocol !== 'https:' && urlObject.protocol !== 'http:') {
			return '';
		}

		return urlObject.origin;
	} catch {
		return '';
	}
}

export function getJiraUrl(ticketId: string, baseUrl: string): string {
	if (!ticketId || !baseUrl) return '';
	return `${sanitizeJiraUrl(baseUrl)}/browse/${ticketId}`;
}

export function formatLinesChanged(additions: number, deletions: number): string {
	return `+${additions} -${deletions}`;
}

export function getReviewStatusDisplay(status: string) {
	switch (status) {
		case 'approved':
			return { label: 'Approved', icon: '✓', className: 'status-approved' };
		case 'changes_requested':
			return { label: 'Changes Requested', icon: '✗', className: 'status-changes' };
		case 'pending':
		default:
			return { label: 'Review Pending', icon: '⏳', className: 'status-pending' };
	}
}

export function getCheckStatusDisplay(status: string) {
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

export function truncate(text: string, maxLength = 50): string {
	if (!text || text.length <= maxLength) return text;
	return `${text.substring(0, maxLength - 3)}...`;
}

export async function copyToClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
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

export function formatRelativeTime(date: string | number | Date): string {
	const now = new Date();
	const then = new Date(date);
	const diffMs = now.getTime() - then.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return 'just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return then.toLocaleDateString();
}

export function debounce<TArgs extends unknown[]>(func: (...args: TArgs) => void, wait: number) {
	let timeout: number | undefined;
	return function executedFunction(...args: TArgs) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};

		clearTimeout(timeout);
		timeout = window.setTimeout(later, wait);
	};
}

export function isValidHttpUrl(url: string): boolean {
	if (!url || typeof url !== 'string') return false;
	try {
		const urlObject = new URL(url);
		return urlObject.protocol === 'https:' || urlObject.protocol === 'http:';
	} catch {
		return false;
	}
}

export function isValidTokenFormat(token: string): boolean {
	if (!token || typeof token !== 'string') return false;
	const classicPattern = /^ghp_[a-zA-Z0-9]{36}$/;
	const fineGrainedPattern = /^github_pat_[a-zA-Z0-9_]{22,}$/;
	return classicPattern.test(token) || fineGrainedPattern.test(token);
}

export function safeParseInt(value: unknown, defaultValue = 0): number {
	if (value === null || value === undefined) return defaultValue;
	const parsed = Number.parseInt(String(value), 10);
	return Number.isNaN(parsed) ? defaultValue : parsed;
}