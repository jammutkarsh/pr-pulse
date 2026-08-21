// Turning a branch name into a Jira link is one job. The ticket extraction, the base-URL
// sanitising and the URL assembly are steps in it, not things a caller should reassemble.

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

export interface JiraLink {
	ticket: string;
	url: string;
}

export function jiraLinkFor(branchName: string, baseUrl: string): JiraLink | null {
	if (!branchName || !baseUrl) return null;

	const ticket = branchName.match(/([A-Z]+-\d+)/i)?.[1]?.toUpperCase();
	const origin = sanitizeJiraUrl(baseUrl);
	if (!ticket || !origin) return null;

	return { ticket, url: `${origin}/browse/${ticket}` };
}
