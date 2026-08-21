export async function copyToClipboard(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
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

export function formatPrAge(date: string | number | Date): string {
	if (!date) return '';
	const now = new Date();
	const then = new Date(date);
	const diffMs = now.getTime() - then.getTime();
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffDays === 0) return 'today';
	if (diffDays === 1) return '1 day ago';
	if (diffDays < 7) return `${diffDays} days ago`;

	const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
	if (now.getFullYear() !== then.getFullYear()) {
		options.year = 'numeric';
	}
	return then.toLocaleDateString(undefined, options);
}

export function formatLocalDateTime(date: string | number | Date): string {
	if (!date) return '';

	const value = new Date(date);
	if (Number.isNaN(value.getTime())) {
		return '';
	}

	return value.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
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
