import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PullRequest } from '@lib/types';
import {
	extractJiraTicket,
	sanitizeJiraUrl,
	getJiraUrl,
	getReviewStatusDisplay,
	getCheckStatusDisplay,
	formatRelativeTime,
	formatPrAge,
	formatLocalDateTime,
	isValidHttpUrl,
	isValidTokenFormat,
	filterPullRequests,
	safeParseInt,
} from '@lib/utils';

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
	return {
		id: 'pr-1',
		provider: 'github',
		title: 'Test PR',
		url: 'https://github.com/owner/repo/pull/1',
		repoFullName: 'owner/repo',
		repoOwner: { login: 'owner', type: 'org' },
		branchName: 'feature/PROJ-123-add-tests',
		author: { login: 'alice', avatarUrl: 'https://example.com/avatar.png', name: 'Alice' },
		state: 'open',
		changes: { additions: 10, deletions: 5, filesChanged: 3 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'approved', reviewers: [] },
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-02T00:00:00Z',
		isDraft: false,
		...overrides,
	};
}

// ── extractJiraTicket ──────────────────────────────────────────────

describe('extractJiraTicket', () => {
	it('extracts ticket from standard branch name', () => {
		expect(extractJiraTicket('feature/PROJ-123-add-tests')).toBe('PROJ-123');
	});

	it('extracts ticket from branch with just ticket id', () => {
		expect(extractJiraTicket('PROJ-456')).toBe('PROJ-456');
	});

	it('uppercases lowercase tickets', () => {
		expect(extractJiraTicket('feature/proj-789-something')).toBe('PROJ-789');
	});

	it('returns null when no ticket found', () => {
		expect(extractJiraTicket('feature/add-tests')).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(extractJiraTicket('')).toBeNull();
	});

	it('extracts first ticket from branch with multiple matches', () => {
		expect(extractJiraTicket('PROJ-1-fix-PROJ-2')).toBe('PROJ-1');
	});
});

// ── sanitizeJiraUrl ────────────────────────────────────────────────

describe('sanitizeJiraUrl', () => {
	it('returns origin from full URL', () => {
		expect(sanitizeJiraUrl('https://company.atlassian.net/browse/PROJ-123')).toBe('https://company.atlassian.net');
	});

	it('strips trailing slash', () => {
		expect(sanitizeJiraUrl('https://company.atlassian.net/')).toBe('https://company.atlassian.net');
	});

	it('prepends https:// when missing', () => {
		expect(sanitizeJiraUrl('company.atlassian.net')).toBe('https://company.atlassian.net');
	});

	it('returns empty string for empty input', () => {
		expect(sanitizeJiraUrl('')).toBe('');
	});

	it('preserves http protocol', () => {
		expect(sanitizeJiraUrl('http://jira.local')).toBe('http://jira.local');
	});

	it('returns empty string for invalid URL', () => {
		expect(sanitizeJiraUrl('not a url at all !@#$')).toBe('');
	});
});

// ── getJiraUrl ─────────────────────────────────────────────────────

describe('getJiraUrl', () => {
	it('combines ticket and base URL', () => {
		expect(getJiraUrl('PROJ-123', 'https://company.atlassian.net')).toBe('https://company.atlassian.net/browse/PROJ-123');
	});

	it('returns empty string when ticketId is empty', () => {
		expect(getJiraUrl('', 'https://company.atlassian.net')).toBe('');
	});

	it('returns empty string when baseUrl is empty', () => {
		expect(getJiraUrl('PROJ-123', '')).toBe('');
	});
});

// ── getReviewStatusDisplay ─────────────────────────────────────────

describe('getReviewStatusDisplay', () => {
	it('returns approved display', () => {
		const result = getReviewStatusDisplay('approved');
		expect(result.label).toBe('Approved');
		expect(result.className).toBe('status-approved');
	});

	it('returns changes requested display', () => {
		const result = getReviewStatusDisplay('changes_requested');
		expect(result.label).toBe('Changes Requested');
		expect(result.className).toBe('status-changes');
	});

	it('includes thread count in changes requested label', () => {
		const result = getReviewStatusDisplay('changes_requested', 3);
		expect(result.label).toBe('Changes Requested (3)');
	});

	it('returns pending for unknown status', () => {
		const result = getReviewStatusDisplay('anything_else');
		expect(result.label).toBe('Review Pending');
		expect(result.className).toBe('status-pending');
	});

	it('returns pending for explicit pending', () => {
		const result = getReviewStatusDisplay('pending');
		expect(result.className).toBe('status-pending');
	});
});

// ── getCheckStatusDisplay ──────────────────────────────────────────

describe('getCheckStatusDisplay', () => {
	it.each([
		['success', 'Checks Passing', 'checks-success'],
		['failure', 'Checks Failing', 'checks-failure'],
		['pending', 'Checks Running', 'checks-pending'],
		['unknown', 'No Checks', 'checks-unknown'],
	])('status "%s" → label "%s", className "%s"', (status, label, className) => {
		const result = getCheckStatusDisplay(status);
		expect(result.label).toBe(label);
		expect(result.className).toBe(className);
	});

	it('defaults to "No Checks" for unrecognized status', () => {
		expect(getCheckStatusDisplay('something_random').label).toBe('No Checks');
	});
});

// ── formatRelativeTime ─────────────────────────────────────────────

describe('formatRelativeTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns "just now" for very recent dates', () => {
		expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('just now');
	});

	it('returns minutes ago', () => {
		expect(formatRelativeTime('2025-06-15T11:45:00Z')).toBe('15m ago');
	});

	it('returns hours ago', () => {
		expect(formatRelativeTime('2025-06-15T09:00:00Z')).toBe('3h ago');
	});

	it('returns days ago', () => {
		expect(formatRelativeTime('2025-06-13T12:00:00Z')).toBe('2d ago');
	});

	it('returns localized date for older than a week', () => {
		const result = formatRelativeTime('2025-05-01T12:00:00Z');
		// toLocaleDateString output varies by locale, just verify it's not a relative time
		expect(result).not.toContain('ago');
		expect(result).not.toBe('just now');
	});
});

// ── formatPrAge ────────────────────────────────────────────────────

describe('formatPrAge', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns "today" for same-day PRs', () => {
		expect(formatPrAge('2025-06-15T01:00:00Z')).toBe('today');
	});

	it('returns "1 day ago"', () => {
		expect(formatPrAge('2025-06-14T10:00:00Z')).toBe('1 day ago');
	});

	it('returns "N days ago" for under a week', () => {
		expect(formatPrAge('2025-06-12T10:00:00Z')).toBe('3 days ago');
	});

	it('returns formatted date for older PRs', () => {
		const result = formatPrAge('2025-01-01T00:00:00Z');
		expect(result).not.toContain('days ago');
	});

	it('returns empty string for falsy input', () => {
		expect(formatPrAge(null as unknown as string)).toBe('');
		expect(formatPrAge('')).toBe('');
	});
});

// ── formatLocalDateTime ────────────────────────────────────────────

describe('formatLocalDateTime', () => {
	it('formats a valid date', () => {
		const result = formatLocalDateTime('2025-06-15T12:30:00Z');
		expect(result).toBeTruthy();
		expect(typeof result).toBe('string');
	});

	it('returns empty string for empty input', () => {
		expect(formatLocalDateTime('')).toBe('');
	});

	it('returns empty string for invalid date', () => {
		expect(formatLocalDateTime('not-a-date')).toBe('');
	});

	it('returns empty string for falsy input', () => {
		expect(formatLocalDateTime(null as unknown as string)).toBe('');
	});
});

// ── isValidHttpUrl ─────────────────────────────────────────────────

describe('isValidHttpUrl', () => {
	it('accepts https URLs', () => {
		expect(isValidHttpUrl('https://github.com')).toBe(true);
	});

	it('accepts http URLs', () => {
		expect(isValidHttpUrl('http://localhost:3000')).toBe(true);
	});

	it('rejects ftp URLs', () => {
		expect(isValidHttpUrl('ftp://files.example.com')).toBe(false);
	});

	it('rejects plain strings', () => {
		expect(isValidHttpUrl('not a url')).toBe(false);
	});

	it('rejects empty string', () => {
		expect(isValidHttpUrl('')).toBe(false);
	});

	it('rejects null/undefined', () => {
		expect(isValidHttpUrl(null as unknown as string)).toBe(false);
		expect(isValidHttpUrl(undefined as unknown as string)).toBe(false);
	});
});

// ── isValidTokenFormat ─────────────────────────────────────────────

describe('isValidTokenFormat', () => {
	it('accepts classic token (ghp_)', () => {
		expect(isValidTokenFormat('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')).toBe(true);
	});

	it('accepts fine-grained token (github_pat_)', () => {
		expect(isValidTokenFormat('github_pat_ABCDEFGHIJKLMNOPQRSTUV1234567890ab')).toBe(true);
	});

	it('rejects too-short tokens', () => {
		expect(isValidTokenFormat('ghp_short')).toBe(false);
	});

	it('rejects empty string', () => {
		expect(isValidTokenFormat('')).toBe(false);
	});

	it('rejects null/undefined', () => {
		expect(isValidTokenFormat(null as unknown as string)).toBe(false);
	});

	it('rejects arbitrary string', () => {
		expect(isValidTokenFormat('my-secret-token')).toBe(false);
	});
});

// ── safeParseInt ───────────────────────────────────────────────────

describe('safeParseInt', () => {
	it('parses valid integer string', () => {
		expect(safeParseInt('42')).toBe(42);
	});

	it('parses number value', () => {
		expect(safeParseInt(10)).toBe(10);
	});

	it('returns default for NaN', () => {
		expect(safeParseInt('not-a-number', 99)).toBe(99);
	});

	it('returns 0 as default when not specified', () => {
		expect(safeParseInt(null)).toBe(0);
	});

	it('returns default for undefined', () => {
		expect(safeParseInt(undefined, 5)).toBe(5);
	});

	it('truncates floats', () => {
		expect(safeParseInt('3.14')).toBe(3);
	});
});

// ── filterPullRequests ─────────────────────────────────────────────

describe('filterPullRequests', () => {
	const prs = [
		makePR({ id: '1', isDraft: false, author: { login: 'alice', avatarUrl: '', name: 'Alice' }, repoFullName: 'org/repo-a', repoOwner: { login: 'org', type: 'org' }, reviews: { status: 'approved', reviewers: [] } }),
		makePR({ id: '2', isDraft: true, author: { login: 'bob', avatarUrl: '', name: 'Bob' }, repoFullName: 'org/repo-b', repoOwner: { login: 'org', type: 'org' }, reviews: { status: 'pending', reviewers: [] } }),
		makePR({ id: '3', isDraft: false, author: { login: 'charlie', avatarUrl: '', name: 'Charlie' }, repoFullName: 'user/repo-c', repoOwner: { login: 'user', type: 'user' }, reviews: { status: 'changes_requested', reviewers: [] } }),
	];

	it('excludes drafts by default filter', () => {
		const result = filterPullRequests(prs, { drafts: 'exclude' });
		expect(result).toHaveLength(2);
		expect(result.every(pr => !pr.isDraft)).toBe(true);
	});

	it('shows only drafts', () => {
		const result = filterPullRequests(prs, { drafts: 'only' });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('2');
	});

	it('includes drafts', () => {
		const result = filterPullRequests(prs, { drafts: 'include' });
		expect(result).toHaveLength(3);
	});

	it('filters by author', () => {
		const result = filterPullRequests(prs, { authors: ['alice'] });
		expect(result).toHaveLength(1);
		expect(result[0].author.login).toBe('alice');
	});

	it('filters by repo', () => {
		const result = filterPullRequests(prs, { repos: ['org/repo-a'] });
		expect(result).toHaveLength(1);
	});

	it('filters by owner', () => {
		const result = filterPullRequests(prs, { owners: ['org'] });
		expect(result).toHaveLength(2);
	});

	it('filters out approved when showReviewed is false', () => {
		const result = filterPullRequests(prs, { showReviewed: false });
		expect(result).toHaveLength(2);
		expect(result.every(pr => pr.reviews.status !== 'approved')).toBe(true);
	});

	it('returns all when filters are empty', () => {
		const result = filterPullRequests(prs, {});
		expect(result).toHaveLength(3);
	});

	it('combines multiple filters', () => {
		const result = filterPullRequests(prs, { drafts: 'exclude', owners: ['org'] });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('1');
	});
});
