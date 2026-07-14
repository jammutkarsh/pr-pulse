// Filter-option helpers copied verbatim from the extension popup (App.svelte)
// so the demo's search/filter derives exactly the same authors/owners/repos.
import type {
	PullRequest,
	PopupFilters,
	PopupAuthorFilterOption,
	PopupOwnerFilterOption,
	PopupRepoFilterOption,
} from '../../../extension/lib/types';

export function createDefaultFilters(): PopupFilters {
	return { authors: [], owners: [], repos: [], ageRange: '', drafts: 'include', showReviewed: false };
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
	const mapped = items.map((pr) => {
		const login = pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || '';
		const type = pr.repoOwner?.type || 'unknown';
		return [login.toLowerCase(), { login, type }] as const;
	});
	const valid = mapped.filter(([login]) => Boolean(login));
	const list = Array.from(new Map<string, PopupOwnerFilterOption>(valid).values());
	list.sort((a, b) => a.login.localeCompare(b.login, undefined, { sensitivity: 'base' }));
	return list;
}

export function getAuthorsFromItems(items: PullRequest[], isToReview: boolean): PopupAuthorFilterOption[] {
	if (!isToReview) return [];
	const mapped = items.map((pr) => {
		const login = pr.author?.login || '';
		const name = pr.author?.name || login;
		return [login.toLowerCase(), { login, name }] as const;
	});
	const valid = mapped.filter(([login]) => Boolean(login));
	const list = Array.from(new Map<string, PopupAuthorFilterOption>(valid).values());
	list.sort(
		(a, b) =>
			a.login.localeCompare(b.login, undefined, { sensitivity: 'base' }) ||
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
	);
	return list;
}

export function getReposFromItems(items: PullRequest[]): PopupRepoFilterOption[] {
	const withRepos = items.filter((pr) => pr.repoFullName);
	const mapped = withRepos.map((pr) => {
		const [owner = '', name = pr.repoFullName] = pr.repoFullName.split('/');
		const option: PopupRepoFilterOption = { fullName: pr.repoFullName, owner, ownerType: pr.repoOwner?.type || 'unknown', name };
		return [pr.repoFullName, option] as const;
	});
	const list = Array.from(new Map<string, PopupRepoFilterOption>(mapped).values());
	list.sort(
		(a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
			a.owner.localeCompare(b.owner, undefined, { sensitivity: 'base' }),
	);
	return list;
}
