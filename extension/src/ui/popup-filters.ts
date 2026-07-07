/**
 * Pure functions for popup PR list filtering and option extraction.
 *
 * Extracted from popup/App.svelte to enable unit testing
 * without requiring a Svelte component environment.
 */
import type {
	PullRequest,
	PopupFilters,
	PopupAuthorFilterOption,
	PopupOwnerFilterOption,
	PopupRepoFilterOption,
	Settings,
} from '@lib/types';

type PopupTab = Settings['pinnedTab'];
type StoredFilters = Partial<PopupFilters>;
type StoredFilterState = {
	tabs?: Partial<Record<PopupTab, StoredFilters>>;
	activeFilters?: StoredFilters;
};
type FiltersByTab = Record<PopupTab, PopupFilters>;

export function createDefaultFilters(): PopupFilters {
	return {
		authors: [],
		owners: [],
		repos: [],
		ageRange: '',
		drafts: 'exclude',
		showReviewed: false,
	};
}

export function createDefaultFiltersByTab(): FiltersByTab {
	return {
		myPRs: createDefaultFilters(),
		toReview: createDefaultFilters(),
	};
}

export function cloneFilters(filters: PopupFilters): PopupFilters {
	return {
		authors: [...filters.authors],
		owners: [...filters.owners],
		repos: [...filters.repos],
		ageRange: filters.ageRange,
		drafts: filters.drafts,
		showReviewed: filters.showReviewed,
	};
}

export function getOwnersFromItems(items: PullRequest[]): PopupOwnerFilterOption[] {
	// 1. Extract owner configurations from items
	const mappedOwners = items.map((pr) => {
		const ownerLogin = pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || '';
		const ownerType = pr.repoOwner?.type || 'unknown';
		return [ownerLogin.toLowerCase(), { login: ownerLogin, type: ownerType }] as const;
	});

	// 2. Filter out items with empty or invalid owner login
	const validOwners = mappedOwners.filter(([login]) => Boolean(login));

	// 3. De-duplicate owners using a Map
	const uniqueOwnersMap = new Map<string, PopupOwnerFilterOption>(validOwners);
	const uniqueOwnersList = Array.from(uniqueOwnersMap.values());

	// 4. Sort the result alphabetically by login name
	uniqueOwnersList.sort((left, right) => left.login.localeCompare(right.login, undefined, { sensitivity: 'base' }));

	return uniqueOwnersList;
}

export function getAuthorsFromItems(items: PullRequest[], isToReview: boolean): PopupAuthorFilterOption[] {
	if (!isToReview) {
		return [];
	}

	// 1. Map items to author tuples
	const mappedAuthors = items.map((pr) => {
		const login = pr.author?.login || '';
		const name = pr.author?.name || login;
		return [login.toLowerCase(), { login, name }] as const;
	});

	// 2. Filter out empty/invalid author logins
	const validAuthors = mappedAuthors.filter(([login]) => Boolean(login));

	// 3. De-duplicate authors using a Map
	const uniqueAuthorsMap = new Map<string, PopupAuthorFilterOption>(validAuthors);
	const uniqueAuthorsList = Array.from(uniqueAuthorsMap.values());

	// 4. Sort alphabetically by login, then name
	uniqueAuthorsList.sort(
		(left, right) =>
			left.login.localeCompare(right.login, undefined, { sensitivity: 'base' }) ||
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
	);

	return uniqueAuthorsList;
}

export function getReposFromItems(items: PullRequest[]): PopupRepoFilterOption[] {
	// 1. Filter out PRs that don't have a repoFullName
	const prsWithRepos = items.filter((pr) => pr.repoFullName);

	// 2. Map PRs to repo tuple entries
	const mappedRepos = prsWithRepos.map((pr) => {
		const [owner = '', name = pr.repoFullName] = pr.repoFullName.split('/');
		const repoOption: PopupRepoFilterOption = {
			fullName: pr.repoFullName,
			owner,
			ownerType: pr.repoOwner?.type || 'unknown',
			name,
		};
		return [pr.repoFullName, repoOption] as const;
	});

	// 3. De-duplicate repos using a Map
	const uniqueReposMap = new Map<string, PopupRepoFilterOption>(mappedRepos);
	const uniqueReposList = Array.from(uniqueReposMap.values());

	// 4. Sort alphabetically by name, then owner
	uniqueReposList.sort(
		(left, right) =>
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
			left.owner.localeCompare(right.owner, undefined, { sensitivity: 'base' }),
	);

	return uniqueReposList;
}

export function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((entry): entry is string => typeof entry === 'string');
}

const DEFAULT_FILTERS = createDefaultFilters();

export function normalizeStoredFilters(value: StoredFilters | undefined): PopupFilters {
	const storedFilters = value ?? {};
	const authors = toStringArray(storedFilters.authors);
	const owners = toStringArray(storedFilters.owners);
	const repos = toStringArray(storedFilters.repos);
	const ageRange = typeof storedFilters.ageRange === 'string' ? storedFilters.ageRange : '';
	const drafts = storedFilters.drafts === 'only' || storedFilters.drafts === 'include' ? storedFilters.drafts : 'exclude';
	const showReviewed = typeof storedFilters.showReviewed === 'boolean' ? storedFilters.showReviewed : false;

	return {
		...DEFAULT_FILTERS,
		authors,
		repos,
		owners,
		ageRange,
		drafts,
		showReviewed,
	};
}

export function normalizeStoredFilterState(value: StoredFilterState | undefined, fallbackTab: PopupTab): FiltersByTab {
	const defaultState = createDefaultFiltersByTab();
	const storedTabs = value?.tabs;

	if (storedTabs) {
		return {
			myPRs: normalizeStoredFilters(storedTabs.myPRs),
			toReview: normalizeStoredFilters(storedTabs.toReview),
		};
	}

	if (value?.activeFilters) {
		return {
			...defaultState,
			[fallbackTab]: normalizeStoredFilters(value.activeFilters),
		};
	}

	return defaultState;
}
