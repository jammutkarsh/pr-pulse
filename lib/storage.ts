import type { PullRequestData, Settings, StoredProviderConfig } from './types';

const STORAGE_KEYS = {
	PROVIDER: 'provider',
	PULL_REQUESTS: 'pullRequests',
	SETTINGS: 'settings',
} as const;

const DEFAULT_SETTINGS: Settings = {
	jiraBaseUrl: '',
	displayMode: 'popup',
	pinnedTab: 'myPRs',
	visibleColumns: ['title', 'author', 'checks', 'reviewStatus', 'repo', 'changes', 'jira'],
	pollingIntervalMs: 600000,
};

export const DEFAULT_USER = {
	avatar: 'icons/icon128.png',
	greeting: 'PR Pulse',
} as const;

async function get<T>(key: string): Promise<T | undefined> {
	return new Promise((resolve) => {
		chrome.storage.local.get([key], (result) => {
			resolve(result[key] as T | undefined);
		});
	});
}

async function getMany<TKeys extends readonly string[]>(keys: TKeys): Promise<Record<TKeys[number], unknown>> {
	return new Promise((resolve) => {
		chrome.storage.local.get([...keys], (result) => {
			resolve(result as Record<TKeys[number], unknown>);
		});
	});
}

async function set<T>(key: string, value: T): Promise<void> {
	return new Promise((resolve) => {
		chrome.storage.local.set({ [key]: value }, () => resolve());
	});
}

async function remove(key: string): Promise<void> {
	return new Promise((resolve) => {
		chrome.storage.local.remove([key], () => resolve());
	});
}

async function getProvider(): Promise<StoredProviderConfig | undefined> {
	return get<StoredProviderConfig>(STORAGE_KEYS.PROVIDER);
}

async function setProvider(provider: StoredProviderConfig): Promise<void> {
	return set(STORAGE_KEYS.PROVIDER, provider);
}

async function clearProvider(): Promise<void> {
	return remove(STORAGE_KEYS.PROVIDER);
}

async function getPullRequests(): Promise<PullRequestData> {
	const data = await get<PullRequestData>(STORAGE_KEYS.PULL_REQUESTS);
	return data || { myPRs: [], reviewRequests: [], lastFetched: null };
}

async function setPullRequests(pullRequests: Omit<PullRequestData, 'lastFetched'> | PullRequestData): Promise<void> {
	return set(STORAGE_KEYS.PULL_REQUESTS, {
		...pullRequests,
		lastFetched: Date.now(),
	});
}

async function getSettings(): Promise<Settings> {
	const data = await get<Partial<Settings>>(STORAGE_KEYS.SETTINGS);
	return { ...DEFAULT_SETTINGS, ...data };
}

async function getPopupBootstrapData(): Promise<{
	settings: Settings;
	provider: StoredProviderConfig | undefined;
	pullRequests: PullRequestData;
}> {
	const result = await getMany([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.PROVIDER, STORAGE_KEYS.PULL_REQUESTS] as const);
	const settings = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined) };
	const provider = result[STORAGE_KEYS.PROVIDER] as StoredProviderConfig | undefined;
	const pullRequests = (result[STORAGE_KEYS.PULL_REQUESTS] as PullRequestData | undefined) || {
		myPRs: [],
		reviewRequests: [],
		lastFetched: null,
	};

	return {
		settings,
		provider,
		pullRequests,
	};
}

async function getBackgroundBootstrapData(): Promise<{
	settings: Settings;
	provider: StoredProviderConfig | undefined;
}> {
	const result = await getMany([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.PROVIDER] as const);

	return {
		settings: { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined) },
		provider: result[STORAGE_KEYS.PROVIDER] as StoredProviderConfig | undefined,
	};
}

async function setSettings(settings: Partial<Settings>): Promise<void> {
	const current = await getSettings();
	return set(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
}

async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
	const settings = await getSettings();
	settings[key] = value;
	return set(STORAGE_KEYS.SETTINGS, settings);
}

async function isAuthenticated(): Promise<boolean> {
	const provider = await get<StoredProviderConfig>(STORAGE_KEYS.PROVIDER);
	return !!(provider && provider.token && provider.user);
}

async function isOnboardingComplete(): Promise<boolean> {
	return isAuthenticated();
}

async function clearAll(): Promise<void> {
	return new Promise((resolve) => {
		chrome.storage.local.clear(() => resolve());
	});
}

export const storage = {
	getProvider,
	setProvider,
	clearProvider,
	getPullRequests,
	setPullRequests,
	getSettings,
	getPopupBootstrapData,
	getBackgroundBootstrapData,
	setSettings,
	updateSetting,
	isAuthenticated,
	isOnboardingComplete,
	clearAll,
};