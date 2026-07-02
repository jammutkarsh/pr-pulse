import { describe, it, expect } from 'vitest';
import type { PopupFilters, PullRequest } from '@lib/types';
import {
	createDefaultFilters,
	createDefaultFiltersByTab,
	cloneFilters,
	getOwnersFromItems,
	getAuthorsFromItems,
	getReposFromItems,
	toStringArray,
	normalizeStoredFilters,
	normalizeStoredFilterState,
} from '@ui/popup-filters';

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
	return {
		id: 'pr-1',
		provider: 'github',
		title: 'Test PR',
		url: 'https://github.com/owner/repo/pull/1',
		repoFullName: 'owner/repo',
		repoOwner: { login: 'owner', type: 'org' },
		branchName: 'main',
		author: { login: 'alice', avatarUrl: '', name: 'Alice' },
		state: 'open',
		changes: { additions: 0, deletions: 0, filesChanged: 0 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-01T00:00:00Z',
		isDraft: false,
		...overrides,
	};
}

// ── createDefaultFilters ───────────────────────────────────────────

describe('createDefaultFilters', () => {
	it('returns expected default shape', () => {
		const filters = createDefaultFilters();
		expect(filters).toEqual({
			authors: [],
			owners: [],
			repos: [],
			ageRange: '',
			drafts: 'exclude',
			showReviewed: false,
		});
	});

	it('returns a new object each time', () => {
		const a = createDefaultFilters();
		const b = createDefaultFilters();
		expect(a).not.toBe(b);
	});
});

// ── createDefaultFiltersByTab ──────────────────────────────────────

describe('createDefaultFiltersByTab', () => {
	it('returns defaults for both tabs', () => {
		const byTab = createDefaultFiltersByTab();
		expect(byTab.myPRs).toEqual(createDefaultFilters());
		expect(byTab.toReview).toEqual(createDefaultFilters());
	});
});

// ── cloneFilters ───────────────────────────────────────────────────

describe('cloneFilters', () => {
	it('creates a deep copy of arrays', () => {
		const original = createDefaultFilters();
		original.authors = ['alice'];
		const clone = cloneFilters(original);

		clone.authors.push('bob');
		expect(original.authors).toEqual(['alice']);
		expect(clone.authors).toEqual(['alice', 'bob']);
	});

	it('copies primitive values', () => {
		const original = createDefaultFilters();
		original.drafts = 'only';
		original.showReviewed = true;
		const clone = cloneFilters(original);
		expect(clone.drafts).toBe('only');
		expect(clone.showReviewed).toBe(true);
	});
});

// ── getOwnersFromItems ─────────────────────────────────────────────

describe('getOwnersFromItems', () => {
	it('returns empty array for empty input', () => {
		expect(getOwnersFromItems([])).toEqual([]);
	});

	it('extracts and deduplicates owners', () => {
		const prs = [
			makePR({ repoOwner: { login: 'org-a', type: 'org' } }),
			makePR({ repoOwner: { login: 'org-a', type: 'org' }, id: '2' }),
			makePR({ repoOwner: { login: 'user-b', type: 'user' }, id: '3' }),
		];
		const owners = getOwnersFromItems(prs);
		expect(owners).toHaveLength(2);
		expect(owners.map(o => o.login)).toEqual(['org-a', 'user-b']);
	});

	it('sorts alphabetically by login', () => {
		const prs = [
			makePR({ repoOwner: { login: 'Zebra', type: 'org' } }),
			makePR({ repoOwner: { login: 'alpha', type: 'user' }, id: '2' }),
		];
		const owners = getOwnersFromItems(prs);
		expect(owners[0].login).toBe('alpha');
		expect(owners[1].login).toBe('Zebra');
	});

	it('falls back to repoFullName when repoOwner.login is empty', () => {
		const pr = makePR({ repoOwner: { login: '', type: 'unknown' }, repoFullName: 'fallback-owner/repo' });
		const owners = getOwnersFromItems([pr]);
		expect(owners).toHaveLength(1);
		expect(owners[0].login).toBe('fallback-owner');
	});
});

// ── getAuthorsFromItems ────────────────────────────────────────────

describe('getAuthorsFromItems', () => {
	it('returns empty array when isToReview is false', () => {
		const prs = [makePR()];
		expect(getAuthorsFromItems(prs, false)).toEqual([]);
	});

	it('extracts and deduplicates authors for toReview', () => {
		const prs = [
			makePR({ author: { login: 'alice', avatarUrl: '', name: 'Alice' } }),
			makePR({ author: { login: 'alice', avatarUrl: '', name: 'Alice' }, id: '2' }),
			makePR({ author: { login: 'bob', avatarUrl: '', name: 'Bob' }, id: '3' }),
		];
		const authors = getAuthorsFromItems(prs, true);
		expect(authors).toHaveLength(2);
		expect(authors.map(a => a.login)).toEqual(['alice', 'bob']);
	});

	it('handles PRs with missing author login', () => {
		const prs = [
			makePR({ author: { login: '', avatarUrl: '', name: '' } }),
			makePR({ author: { login: 'bob', avatarUrl: '', name: 'Bob' }, id: '2' }),
		];
		const authors = getAuthorsFromItems(prs, true);
		expect(authors).toHaveLength(1);
		expect(authors[0].login).toBe('bob');
	});
});

// ── getReposFromItems ──────────────────────────────────────────────

describe('getReposFromItems', () => {
	it('returns empty for empty input', () => {
		expect(getReposFromItems([])).toEqual([]);
	});

	it('extracts and deduplicates repos', () => {
		const prs = [
			makePR({ repoFullName: 'org/repo-a' }),
			makePR({ repoFullName: 'org/repo-a', id: '2' }),
			makePR({ repoFullName: 'org/repo-b', id: '3' }),
		];
		const repos = getReposFromItems(prs);
		expect(repos).toHaveLength(2);
	});

	it('sorts by name then owner', () => {
		const prs = [
			makePR({ repoFullName: 'org-b/zebra', id: '1' }),
			makePR({ repoFullName: 'org-a/alpha', id: '2' }),
		];
		const repos = getReposFromItems(prs);
		expect(repos[0].name).toBe('alpha');
		expect(repos[1].name).toBe('zebra');
	});
});

// ── toStringArray ──────────────────────────────────────────────────

describe('toStringArray', () => {
	it('returns empty array for non-array', () => {
		expect(toStringArray(null)).toEqual([]);
		expect(toStringArray(undefined)).toEqual([]);
		expect(toStringArray('hello')).toEqual([]);
		expect(toStringArray(42)).toEqual([]);
	});

	it('filters non-string entries', () => {
		expect(toStringArray(['a', 1, 'b', null, 'c'])).toEqual(['a', 'b', 'c']);
	});

	it('passes through string arrays', () => {
		expect(toStringArray(['x', 'y'])).toEqual(['x', 'y']);
	});
});

// ── normalizeStoredFilters ─────────────────────────────────────────

describe('normalizeStoredFilters', () => {
	it('returns defaults for undefined', () => {
		const result = normalizeStoredFilters(undefined);
		expect(result.drafts).toBe('exclude');
		expect(result.authors).toEqual([]);
		expect(result.showReviewed).toBe(false);
	});

	it('preserves valid filter values', () => {
		const result = normalizeStoredFilters({
			authors: ['alice'],
			drafts: 'only',
			showReviewed: true,
		});
		expect(result.authors).toEqual(['alice']);
		expect(result.drafts).toBe('only');
		expect(result.showReviewed).toBe(true);
	});

	it('sanitizes invalid drafts value to exclude', () => {
		const result = normalizeStoredFilters({ drafts: 'invalid' as PopupFilters['drafts'] });
		expect(result.drafts).toBe('exclude');
	});

	it('sanitizes non-boolean showReviewed', () => {
		const result = normalizeStoredFilters({ showReviewed: 'yes' as unknown as boolean });
		expect(result.showReviewed).toBe(false);
	});
});

// ── normalizeStoredFilterState ─────────────────────────────────────

describe('normalizeStoredFilterState', () => {
	it('returns defaults for undefined', () => {
		const result = normalizeStoredFilterState(undefined, 'myPRs');
		expect(result.myPRs).toEqual(createDefaultFilters());
		expect(result.toReview).toEqual(createDefaultFilters());
	});

	it('normalizes tab-based stored state', () => {
		const result = normalizeStoredFilterState({
			tabs: {
				myPRs: { drafts: 'include', authors: ['alice'] },
				toReview: { drafts: 'only' },
			},
		}, 'myPRs');
		expect(result.myPRs.drafts).toBe('include');
		expect(result.myPRs.authors).toEqual(['alice']);
		expect(result.toReview.drafts).toBe('only');
	});

	it('uses activeFilters fallback with fallbackTab', () => {
		const result = normalizeStoredFilterState({
			activeFilters: { authors: ['bob'] },
		}, 'toReview');
		expect(result.toReview.authors).toEqual(['bob']);
		expect(result.myPRs.authors).toEqual([]); // default
	});
});
