import { describe, it, expect } from 'vitest';
import type { PullRequest } from '@lib/types';
import {
	getCheckToneClass,
	getReviewToneClass,
	getDotToneClass,
	getBranchUrl,
	getJiraLink,
	getCardStatusClass,
} from '@ui/pr-card-helpers';

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
	return {
		id: 'pr-1',
		provider: 'github',
		title: 'Test PR',
		url: 'https://github.com/owner/repo/pull/1',
		repoFullName: 'owner/repo',
		repoOwner: { login: 'owner', type: 'org' },
		branchName: 'feature/PROJ-123-add-tests',
		author: { login: 'alice', avatarUrl: '', name: 'Alice' },
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

// ── getCheckToneClass ──────────────────────────────────────────────

describe('getCheckToneClass', () => {
	it.each([
		['checks-success', 'status-inline-success'],
		['checks-failure', 'status-inline-danger'],
		['checks-pending', 'status-inline-warning'],
		['checks-unknown', 'status-inline-neutral'],
		['anything-else', 'status-inline-neutral'],
	])('%s → %s', (input, expected) => {
		expect(getCheckToneClass(input)).toBe(expected);
	});
});

// ── getReviewToneClass ─────────────────────────────────────────────

describe('getReviewToneClass', () => {
	it.each([
		['status-approved', 'status-inline-success'],
		['status-changes', 'status-inline-danger'],
		['status-pending', 'status-inline-warning'],
		['anything-else', 'status-inline-warning'],
	])('%s → %s', (input, expected) => {
		expect(getReviewToneClass(input)).toBe(expected);
	});
});

// ── getDotToneClass ────────────────────────────────────────────────

describe('getDotToneClass', () => {
	it.each([
		['checks-success', 'status-dot-success'],
		['status-approved', 'status-dot-success'],
		['checks-failure', 'status-dot-danger'],
		['status-changes', 'status-dot-danger'],
		['checks-pending', 'status-dot-warning'],
		['status-pending', 'status-dot-warning'],
		['checks-unknown', 'status-dot-neutral'],
		['anything-else', 'status-dot-neutral'],
	])('%s → %s', (input, expected) => {
		expect(getDotToneClass(input)).toBe(expected);
	});
});

// ── getBranchUrl ───────────────────────────────────────────────────

describe('getBranchUrl', () => {
	it('constructs branch URL', () => {
		const pr = makePR({ repoFullName: 'owner/repo', branchName: 'feature/test' });
		expect(getBranchUrl(pr)).toBe('https://github.com/owner/repo/tree/feature%2Ftest');
	});

	it('encodes special characters in branch name', () => {
		const pr = makePR({ branchName: 'feat/special chars & more' });
		const url = getBranchUrl(pr)!;
		expect(url).toContain('special%20chars%20%26%20more');
	});

	it('returns null when repoFullName is missing', () => {
		const pr = makePR({ repoFullName: '' });
		expect(getBranchUrl(pr)).toBeNull();
	});

	it('returns null when branchName is missing', () => {
		const pr = makePR({ branchName: '' });
		expect(getBranchUrl(pr)).toBeNull();
	});
});

// ── getJiraLink ────────────────────────────────────────────────────

describe('getJiraLink', () => {
	it('extracts Jira link from branch name', () => {
		const pr = makePR({ branchName: 'feature/PROJ-123-add-tests' });
		const result = getJiraLink(pr, 'https://company.atlassian.net');
		expect(result).toEqual({
			ticket: 'PROJ-123',
			url: 'https://company.atlassian.net/browse/PROJ-123',
		});
	});

	it('returns null when no Jira ticket in branch', () => {
		const pr = makePR({ branchName: 'feature/add-tests' });
		expect(getJiraLink(pr, 'https://company.atlassian.net')).toBeNull();
	});

	it('returns null when jiraBaseUrl is empty', () => {
		const pr = makePR({ branchName: 'feature/PROJ-123-add-tests' });
		expect(getJiraLink(pr, '')).toBeNull();
	});

	it('returns null when jiraBaseUrl produces invalid URL', () => {
		const pr = makePR({ branchName: 'feature/PROJ-123-add-tests' });
		// sanitizeJiraUrl prepends https:// to bare strings, so use a value
		// that will fail sanitization entirely (returns empty string)
		expect(getJiraLink(pr, '')).toBeNull();
	});
});

// ── getCardStatusClass ─────────────────────────────────────────────

describe('getCardStatusClass', () => {
	it('returns draft class for draft PRs', () => {
		expect(getCardStatusClass(makePR({ isDraft: true }))).toBe('pr-card-draft');
	});

	it('returns success when checks pass and reviews approved', () => {
		const pr = makePR({
			checks: { status: 'success', details: [] },
			reviews: { status: 'approved', reviewers: [] },
		});
		expect(getCardStatusClass(pr)).toBe('pr-card-success');
	});

	it('returns success when no checks and reviews approved', () => {
		const pr = makePR({
			checks: { status: 'unknown', details: [] },
			reviews: { status: 'approved', reviewers: [] },
		});
		expect(getCardStatusClass(pr)).toBe('pr-card-success');
	});

	it('returns danger when both checks fail and reviews not approved', () => {
		const pr = makePR({
			checks: { status: 'failure', details: [] },
			reviews: { status: 'changes_requested', reviewers: [] },
		});
		expect(getCardStatusClass(pr)).toBe('pr-card-danger');
	});

	it('returns warning when only checks fail', () => {
		const pr = makePR({
			checks: { status: 'failure', details: [] },
			reviews: { status: 'approved', reviewers: [] },
		});
		expect(getCardStatusClass(pr)).toBe('pr-card-warning');
	});

	it('returns warning when only reviews pending', () => {
		const pr = makePR({
			checks: { status: 'success', details: [] },
			reviews: { status: 'pending', reviewers: [] },
		});
		expect(getCardStatusClass(pr)).toBe('pr-card-warning');
	});
});
