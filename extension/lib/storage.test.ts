import assert from 'node:assert/strict';
import { createStorage, type KeyValueStore } from './storage-core';
import { DEFAULT_SETTINGS } from './ui-config';

// The second adapter at the KeyValueStore seam. Its whole point is that this file can run in node:
// before storage took its store as a parameter, nothing here was reachable outside a browser.
// Run with: npm test

function createInMemoryStore(seed: Record<string, unknown> = {}): KeyValueStore {
	const map = new Map(Object.entries(seed));

	return {
		async get(keys) {
			const result: Record<string, unknown> = {};
			for (const key of keys) {
				if (map.has(key)) {
					result[key] = map.get(key);
				}
			}
			return result;
		},
		async set(items) {
			for (const [key, value] of Object.entries(items)) {
				map.set(key, value);
			}
		},
		async remove(keys) {
			for (const key of keys) {
				map.delete(key);
			}
		},
		async clear() {
			map.clear();
		},
	};
}

async function testDefaultsOnEmptyStore(): Promise<void> {
	const storage = createStorage(createInMemoryStore());

	// An empty store reads as defaults, not undefined — every caller assumes a whole Settings.
	assert.deepEqual(await storage.getSettings(), DEFAULT_SETTINGS);
	assert.deepEqual(await storage.getPullRequests(), { myPRs: [], reviewRequests: [], lastFetched: null });
	assert.equal(await storage.getProvider(), undefined);
	assert.equal(await storage.isAuthenticated(), false);
}

async function testBootstrapMatchesTheIndividualReads(): Promise<void> {
	const storage = createStorage(createInMemoryStore());
	await storage.setSettings({ pinnedTab: 'toReview' });
	await storage.setPullRequests({ myPRs: [], reviewRequests: [] });

	// One read, same answers as the per-key reads — the two bespoke bootstrap methods this replaced
	// each carried their own copy of the empty-PullRequestData default.
	const bootstrap = await storage.getBootstrapData();
	assert.deepEqual(bootstrap.settings, await storage.getSettings());
	assert.deepEqual(bootstrap.pullRequests, await storage.getPullRequests());
	assert.equal(bootstrap.provider, undefined);
	assert.deepEqual(await storage.getBootstrapData(), { ...bootstrap, pullRequests: bootstrap.pullRequests });
}

async function testSettingsMerge(): Promise<void> {
	const storage = createStorage(createInMemoryStore());

	// Read-merge-write: a partial write must not drop the keys it does not mention.
	await storage.setSettings({ pinnedTab: 'toReview' });
	await storage.setSettings({ badgeCountMode: 'filters' });
	const settings = await storage.getSettings();
	assert.equal(settings.pinnedTab, 'toReview');
	assert.equal(settings.badgeCountMode, 'filters');
	assert.equal(settings.pollingIntervalMs, DEFAULT_SETTINGS.pollingIntervalMs);
}

async function testFiltersRoundTripAndClear(): Promise<void> {
	const storage = createStorage(createInMemoryStore());
	const filters = await storage.getFilters('myPRs');
	filters.myPRs.repos = ['acme/api'];

	await storage.setFilters(filters);
	assert.deepEqual((await storage.getFilters('myPRs')).myPRs.repos, ['acme/api']);

	await storage.clearFilters();
	assert.deepEqual((await storage.getFilters('myPRs')).myPRs.repos, []);
}

async function testAuthenticatedNeedsTokenAndUser(): Promise<void> {
	const storage = createStorage(createInMemoryStore());

	await storage.setProvider({ type: 'github', token: 'ghp_x' });
	assert.equal(await storage.isAuthenticated(), false, 'a token without a user is not authenticated');

	await storage.setProvider({ type: 'github', token: 'ghp_x', user: { login: 'ada', name: 'Ada', avatarUrl: '' } });
	assert.equal(await storage.isAuthenticated(), true);

	await storage.clearAll();
	assert.equal(await storage.isAuthenticated(), false);
}

await testDefaultsOnEmptyStore();
await testBootstrapMatchesTheIndividualReads();
await testSettingsMerge();
await testFiltersRoundTripAndClear();
await testAuthenticatedNeedsTokenAndUser();
console.log('storage: all checks passed');
