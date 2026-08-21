// Turning a branch name into a Jira link is one job. The ticket extraction, the base-URL
// sanitising and the URL assembly are steps in it, not things a caller should reassemble.

/** Jira project keys are letters, the issue number digits. Case-insensitive: branches use both. */
const TICKET_PATTERN = /([A-Z]+-\d+)/i;

function parseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

export function sanitizeJiraUrl(url: string): string {
	if (!url) return '';
	const trimmed = url.trim();
	if (!trimmed) return '';

	// Only a real `scheme://` prefix counts as already-schemed. Prepending https:// to everything
	// turned `ftp://x.com` into the host `ftp` — a clean parse that reached the origin below and made
	// the protocol check unreachable. A bare `host:8080` still has to take the prefix, so the test is
	// on `://`, not on the colon.
	const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
	const parsed = parseUrl(hasScheme ? trimmed : `https://${trimmed}`);
	if (!parsed) return '';

	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		return '';
	}

	return parsed.origin;
}

/** The branch-name ticket rule, shared with the popup's search index so the two cannot disagree. */
export function jiraTicketFor(branchName: string): string {
	return branchName?.match(TICKET_PATTERN)?.[1]?.toUpperCase() || '';
}

export interface JiraLink {
	ticket: string;
	url: string;
}

export function jiraLinkFor(branchName: string, baseUrl: string): JiraLink | null {
	if (!branchName || !baseUrl) return null;

	const ticket = jiraTicketFor(branchName);
	const origin = sanitizeJiraUrl(baseUrl);
	if (!ticket || !origin) return null;

	return { ticket, url: `${origin}/browse/${ticket}` };
}
