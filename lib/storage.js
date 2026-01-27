/**
 * Storage Service
 * Wrapper around Chrome's storage API with typed accessors
 */

const STORAGE_KEYS = {
	PROVIDER: 'provider',
	PULL_REQUESTS: 'pullRequests',
	SETTINGS: 'settings',
};

/**
 * Default settings
 */
const DEFAULT_SETTINGS = {
	jiraBaseUrl: '',
	displayMode: 'popup',
	pinnedTab: 'myPRs',
	visibleColumns: ['title', 'author', 'checks', 'reviewStatus', 'repo', 'changes', 'jira'],
	pollingIntervalMs: 600000,
};

/**
 * Default user display when not authenticated
 */
export const DEFAULT_USER = {
	avatar: 'icons/icon128.png',
	greeting: 'PR Pulse',
};

/**
 * Get data from chrome.storage.local
 * @param {string} key - Storage key
 * @returns {Promise<any>}
 */
async function get(key) {
	return new Promise((resolve) => {
		chrome.storage.local.get([key], (result) => {
			resolve(result[key]);
		});
	});
}

/**
 * Set data in chrome.storage.local
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {Promise<void>}
 */
async function set(key, value) {
	return new Promise((resolve) => {
		chrome.storage.local.set({ [key]: value }, resolve);
	});
}

/**
 * Remove data from chrome.storage.local
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
async function remove(key) {
	return new Promise((resolve) => {
		chrome.storage.local.remove([key], resolve);
	});
}

// Provider Storage
export async function getProvider() {
	return get(STORAGE_KEYS.PROVIDER);
}

export async function setProvider(provider) {
	return set(STORAGE_KEYS.PROVIDER, provider);
}

export async function clearProvider() {
	return remove(STORAGE_KEYS.PROVIDER);
}

// Pull Requests Storage
export async function getPullRequests() {
	const data = await get(STORAGE_KEYS.PULL_REQUESTS);
	return data || { myPRs: [], reviewRequests: [], lastFetched: null };
}

export async function setPullRequests(pullRequests) {
	return set(STORAGE_KEYS.PULL_REQUESTS, {
		...pullRequests,
		lastFetched: Date.now(),
	});
}

// Settings Storage
export async function getSettings() {
	const data = await get(STORAGE_KEYS.SETTINGS);
	return { ...DEFAULT_SETTINGS, ...data };
}

export async function setSettings(settings) {
	const current = await getSettings();
	return set(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
}

export async function updateSetting(key, value) {
	const settings = await getSettings();
	settings[key] = value;
	return set(STORAGE_KEYS.SETTINGS, settings);
}

// Authentication State - just checks if we have a valid token
export async function isAuthenticated() {
	const provider = await get(STORAGE_KEYS.PROVIDER);
	return !!(provider && provider.token && provider.user);
}

// Legacy alias for backwards compatibility
export async function isOnboardingComplete() {
	return isAuthenticated();
}

// Clear all data
export async function clearAll() {
	return new Promise((resolve) => {
		chrome.storage.local.clear(resolve);
	});
}

export const storage = {
	getProvider,
	setProvider,
	clearProvider,
	getPullRequests,
	setPullRequests,
	getSettings,
	setSettings,
	updateSetting,
	isAuthenticated,
	isOnboardingComplete,
	clearAll,
};
