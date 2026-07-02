import type { PullRequestData, Settings, StoredProviderConfig } from './types';
import { storageLocalClear, storageLocalGet, storageLocalSet } from './extension-api';
import { normalizeSettings } from './ui-config';

const STORAGE_KEYS = {
	PROVIDER: 'provider',
	PULL_REQUESTS: 'pullRequests',
	SETTINGS: 'settings',
	BADGE_COUNT: 'badgeCount',
} as const;

async function get<T>(key: string): Promise<T | undefined> {
	const result = await storageLocalGet<T>([key]);
	return result[key] as T | undefined;
}

async function getMany<TKeys extends readonly string[]>(keys: TKeys): Promise<Record<TKeys[number], unknown>> {
	const result = await storageLocalGet([...keys]);
	return result as Record<TKeys[number], unknown>;
}

async function set<T>(key: string, value: T): Promise<void> {
	return storageLocalSet({ [key]: value });
}

async function getProvider(): Promise<StoredProviderConfig | undefined> {
	return get<StoredProviderConfig>(STORAGE_KEYS.PROVIDER);
}

async function setProvider(provider: StoredProviderConfig): Promise<void> {
	return set(STORAGE_KEYS.PROVIDER, provider);
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
	return normalizeSettings(data);
}

async function getPopupBootstrapData(): Promise<{
	settings: Settings;
	provider: StoredProviderConfig | undefined;
	pullRequests: PullRequestData;
}> {
	const result = await getMany([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.PROVIDER, STORAGE_KEYS.PULL_REQUESTS] as const);
	const settings = normalizeSettings(result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined);
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
		settings: normalizeSettings(result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined),
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

async function clearAll(): Promise<void> {
	return storageLocalClear();
}

async function getBadgeCount(): Promise<number | undefined> {
	return get<number>(STORAGE_KEYS.BADGE_COUNT);
}

async function setBadgeCount(count: number): Promise<void> {
	return set(STORAGE_KEYS.BADGE_COUNT, count);
}

export const storage = {
	getProvider,
	setProvider,
	getPullRequests,
	setPullRequests,
	getSettings,
	getPopupBootstrapData,
	getBackgroundBootstrapData,
	setSettings,
	updateSetting,
	isAuthenticated,
	clearAll,
	getBadgeCount,
	setBadgeCount,
};