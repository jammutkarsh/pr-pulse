import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock extension-api before importing storage
vi.mock('../extension-api', () => ({
	storageLocalGet: vi.fn(),
	storageLocalSet: vi.fn(),
	storageLocalClear: vi.fn(),
}));

import { storage } from '@lib/storage';
import { storageLocalGet, storageLocalSet, storageLocalClear } from '@lib/extension-api';

const mockGet = vi.mocked(storageLocalGet);
const mockSet = vi.mocked(storageLocalSet);
const mockClear = vi.mocked(storageLocalClear);

beforeEach(() => {
	vi.clearAllMocks();
	mockSet.mockResolvedValue(undefined);
	mockClear.mockResolvedValue(undefined);
});

describe('storage.getProvider', () => {
	it('returns provider config when present', async () => {
		const provider = { type: 'github' as const, token: 'tok', user: { login: 'u', avatarUrl: '', name: 'U' } };
		mockGet.mockResolvedValueOnce({ provider });
		const result = await storage.getProvider();
		expect(result).toEqual(provider);
	});

	it('returns undefined when not set', async () => {
		mockGet.mockResolvedValueOnce({});
		const result = await storage.getProvider();
		expect(result).toBeUndefined();
	});
});

describe('storage.setProvider', () => {
	it('stores provider config', async () => {
		const provider = { type: 'github' as const, token: 'tok', user: { login: 'u', avatarUrl: '', name: 'U' } };
		await storage.setProvider(provider);
		expect(mockSet).toHaveBeenCalledWith({ provider });
	});
});

describe('storage.getPullRequests', () => {
	it('returns stored PR data', async () => {
		const data = { myPRs: [{ id: '1' }], reviewRequests: [], lastFetched: 123 };
		mockGet.mockResolvedValueOnce({ pullRequests: data });
		const result = await storage.getPullRequests();
		expect(result).toEqual(data);
	});

	it('returns default empty data when nothing stored', async () => {
		mockGet.mockResolvedValueOnce({});
		const result = await storage.getPullRequests();
		expect(result).toEqual({ myPRs: [], reviewRequests: [], lastFetched: null });
	});
});

describe('storage.setPullRequests', () => {
	it('stores PR data with lastFetched timestamp', async () => {
		const before = Date.now();
		await storage.setPullRequests({ myPRs: [], reviewRequests: [] });
		expect(mockSet).toHaveBeenCalledTimes(1);
		const stored = mockSet.mock.calls[0][0].pullRequests as Record<string, unknown>;
		expect(stored.lastFetched).toBeGreaterThanOrEqual(before);
		expect(stored.myPRs).toEqual([]);
	});
});

describe('storage.getSettings', () => {
	it('returns normalized settings', async () => {
		mockGet.mockResolvedValueOnce({ settings: { pinnedTab: 'toReview' } });
		const result = await storage.getSettings();
		expect(result.pinnedTab).toBe('toReview');
		// defaults filled in
		expect(result.displayMode).toBe('popup');
		expect(result.pollingIntervalMs).toBe(600000);
	});

	it('returns full defaults when nothing stored', async () => {
		mockGet.mockResolvedValueOnce({});
		const result = await storage.getSettings();
		expect(result.pinnedTab).toBe('myPRs');
		expect(result.displayMode).toBe('popup');
	});
});

describe('storage.setSettings', () => {
	it('merges with existing settings', async () => {
		// getSettings call inside setSettings
		mockGet.mockResolvedValueOnce({ settings: { pinnedTab: 'myPRs', displayMode: 'popup' } });
		await storage.setSettings({ pinnedTab: 'toReview' });
		expect(mockSet).toHaveBeenCalledTimes(1);
		const stored = mockSet.mock.calls[0][0].settings as Record<string, unknown>;
		expect(stored.pinnedTab).toBe('toReview');
	});
});

describe('storage.isAuthenticated', () => {
	it('returns true when provider has token and user', async () => {
		mockGet.mockResolvedValueOnce({
			provider: { type: 'github', token: 'tok', user: { login: 'u', avatarUrl: '', name: 'U' } },
		});
		expect(await storage.isAuthenticated()).toBe(true);
	});

	it('returns false when no provider', async () => {
		mockGet.mockResolvedValueOnce({});
		expect(await storage.isAuthenticated()).toBe(false);
	});

	it('returns false when provider has no token', async () => {
		mockGet.mockResolvedValueOnce({ provider: { type: 'github', token: undefined, user: { login: 'u', avatarUrl: '', name: 'U' } } });
		expect(await storage.isAuthenticated()).toBe(false);
	});
});

describe('storage.clearAll', () => {
	it('calls storageLocalClear', async () => {
		await storage.clearAll();
		expect(mockClear).toHaveBeenCalledOnce();
	});
});

describe('storage.getPopupBootstrapData', () => {
	it('returns combined settings, provider, and PR data', async () => {
		mockGet.mockResolvedValueOnce({
			settings: { pinnedTab: 'toReview' },
			provider: { type: 'github', token: 'tok', user: { login: 'u', avatarUrl: '', name: 'U' } },
			pullRequests: { myPRs: [{ id: '1' }], reviewRequests: [], lastFetched: 100 },
		});
		const result = await storage.getPopupBootstrapData();
		expect(result.settings.pinnedTab).toBe('toReview');
		expect(result.provider?.token).toBe('tok');
		expect(result.pullRequests.myPRs).toHaveLength(1);
	});
});

describe('storage.getBackgroundBootstrapData', () => {
	it('returns settings and provider', async () => {
		mockGet.mockResolvedValueOnce({
			settings: { displayMode: 'fullpage' },
			provider: { type: 'github', token: 'tok' },
		});
		const result = await storage.getBackgroundBootstrapData();
		expect(result.settings.displayMode).toBe('fullpage');
		expect(result.provider?.token).toBe('tok');
	});
});
