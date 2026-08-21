// Store-agnostic on purpose, and in its own file for a load-bearing reason: webextension-polyfill
// throws on import outside a browser extension, so anything that reaches the extension's storage
// adapter cannot be loaded in node. Keeping the factory here is what makes `storage.test.ts` possible.

import type { FiltersByTab, PopupTab, PullRequestData, Settings, StoredFilterState, StoredProviderConfig } from './types';
import { normalizeFilterState } from './pr-view';
import { normalizeSettings } from './ui-config';

const STORAGE_KEYS = {
	PROVIDER: 'provider',
	PULL_REQUESTS: 'pullRequests',
	SETTINGS: 'settings',
	FILTERS: 'searchFilters',
} as const;

/**
 * Everything this module needs from a key-value store. Narrow on purpose: the extension's local
 * storage satisfies it in the browser, a Map satisfies it in `storage.test.ts`. Two adapters, so the
 * seam is real — before this, nothing could read or write settings outside a browser.
 */
export interface KeyValueStore {
	get(keys: string[]): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string[]): Promise<void>;
	clear(): Promise<void>;
}

function emptyPullRequestData(): PullRequestData {
	return { myPRs: [], reviewRequests: [], lastFetched: null };
}

export interface BootstrapData {
	settings: Settings;
	provider: StoredProviderConfig | undefined;
	pullRequests: PullRequestData;
}

export function createStorage(store: KeyValueStore) {
	async function get<T>(key: string): Promise<T | undefined> {
		const result = await store.get([key]);
		return result[key] as T | undefined;
	}

	async function set<T>(key: string, value: T): Promise<void> {
		return store.set({ [key]: value });
	}

	async function getProvider(): Promise<StoredProviderConfig | undefined> {
		return get<StoredProviderConfig>(STORAGE_KEYS.PROVIDER);
	}

	async function setProvider(provider: StoredProviderConfig): Promise<void> {
		return set(STORAGE_KEYS.PROVIDER, provider);
	}

	async function getPullRequests(): Promise<PullRequestData> {
		return (await get<PullRequestData>(STORAGE_KEYS.PULL_REQUESTS)) || emptyPullRequestData();
	}

	async function setPullRequests(pullRequests: Omit<PullRequestData, 'lastFetched'> | PullRequestData): Promise<void> {
		return set(STORAGE_KEYS.PULL_REQUESTS, {
			...pullRequests,
			lastFetched: Date.now(),
		});
	}

	async function getSettings(): Promise<Settings> {
		return normalizeSettings(await get<Partial<Settings>>(STORAGE_KEYS.SETTINGS));
	}

	/** One read for everyone who starts up. Both the popup and the worker needed a bespoke method before. */
	async function getBootstrapData(): Promise<BootstrapData> {
		const result = await store.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.PROVIDER, STORAGE_KEYS.PULL_REQUESTS]);

		return {
			settings: normalizeSettings(result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined),
			provider: result[STORAGE_KEYS.PROVIDER] as StoredProviderConfig | undefined,
			pullRequests: (result[STORAGE_KEYS.PULL_REQUESTS] as PullRequestData | undefined) || emptyPullRequestData(),
		};
	}

	/** Read-merge-write. `updateSetting(key, value)` was the same thing with one key, so it is gone. */
	async function setSettings(settings: Partial<Settings>): Promise<void> {
		const current = await getSettings();
		return set(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
	}

	/** Both readers — popup and badge — go through this, so both see normalized, legacy-aware filters. */
	async function getFilters(fallbackTab: PopupTab): Promise<FiltersByTab> {
		return normalizeFilterState(await get<StoredFilterState>(STORAGE_KEYS.FILTERS), fallbackTab);
	}

	async function setFilters(filters: FiltersByTab): Promise<void> {
		return set(STORAGE_KEYS.FILTERS, { tabs: filters } satisfies StoredFilterState);
	}

	async function clearFilters(): Promise<void> {
		return store.remove([STORAGE_KEYS.FILTERS]);
	}

	async function isAuthenticated(): Promise<boolean> {
		const provider = await getProvider();
		return !!(provider && provider.token && provider.user);
	}

	async function clearAll(): Promise<void> {
		return store.clear();
	}

	return {
		getProvider,
		setProvider,
		getPullRequests,
		setPullRequests,
		getSettings,
		getBootstrapData,
		setSettings,
		getFilters,
		setFilters,
		clearFilters,
		isAuthenticated,
		clearAll,
	};
}
