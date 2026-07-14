import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PullRequest, PullRequestData, Settings, StoredProviderConfig } from '@lib/types';

vi.mock('@lib/extension-api', () => ({
	actionSetBadgeBackgroundColor: vi.fn(async () => {}),
	actionSetBadgeText: vi.fn(async () => {}),
	alarmsOnAlarmAddListener: vi.fn(),
	alarmsClear: vi.fn(async () => true),
	alarmsCreate: vi.fn(),
	alarmsGet: vi.fn(async () => undefined),
	runtimeGetURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
	runtimeOnInstalledAddListener: vi.fn(),
	runtimeOnMessageAddListener: vi.fn(),
	runtimeOnStartupAddListener: vi.fn(),
	storageLocalGet: vi.fn(async () => ({})),
	tabsCreate: vi.fn(async () => ({}) as never),
}));

vi.mock('@lib/provider-manager', () => {
	let current: unknown = null;
	return {
		providerManager: {
			createProvider: vi.fn((type: string, config: unknown) => ({ type, config })),
			setProvider: vi.fn((provider: unknown) => {
				current = provider;
			}),
			hasProvider: vi.fn(() => current !== null),
			fetchAllPullRequests: vi.fn(),
		},
	};
});

vi.mock('@lib/storage', () => ({
	storage: {
		getBackgroundBootstrapData: vi.fn(),
		getPullRequests: vi.fn(),
		setPullRequests: vi.fn(async () => {}),
		getProvider: vi.fn(),
		setProvider: vi.fn(async () => {}),
		getSettings: vi.fn(),
		setSettings: vi.fn(async () => {}),
	},
}));

function makePR(id: string, overrides: Partial<PullRequest> = {}): PullRequest {
	return {
		id,
		provider: 'github',
		title: `PR ${id}`,
		url: `https://github.com/owner/repo/pull/${id}`,
		repoFullName: 'owner/repo',
		repoOwner: { login: 'owner', type: 'org' },
		branchName: 'main',
		author: { login: 'author', avatarUrl: '', name: 'author' },
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

function baseSettings(overrides: Partial<Settings> = {}): Settings {
	return {
		jiraBaseUrl: '',
		displayMode: 'popup',
		pinnedTab: 'myPRs',
		visibleColumns: ['title', 'author', 'checks', 'reviewStatus', 'repo', 'changes', 'jira'],
		pollingIntervalMs: 600000,
		persistFilters: true,
		badgeCountMode: 'total',
		ui: {
			pageMaxWidthRem: 56,
			popupWidthRem: 28,
			popupHeightRem: 37.5,
			popupInsetRem: 1,
			surfaceRadiusPx: 10,
			sectionRadiusPx: 20,
			fieldRadiusPx: 6,
			smoothScroll: true,
		},
		...overrides,
	};
}

const providerConfig: StoredProviderConfig = {
	type: 'github',
	token: 'test-token',
	baseUrl: 'https://api.github.com',
};

describe('service-worker', () => {
	let extensionApi: typeof import('@lib/extension-api');
	let providerManagerModule: typeof import('@lib/provider-manager');
	let storageModule: typeof import('@lib/storage');
	let onInstalled: (details: { reason: string }) => Promise<void>;
	let onStartup: () => Promise<void>;
	let onAlarm: (alarm: { name: string }) => Promise<void>;
	let onMessage: (message: unknown) => Promise<unknown>;

	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();

		extensionApi = await import('@lib/extension-api');
		providerManagerModule = await import('@lib/provider-manager');
		storageModule = await import('@lib/storage');

		(storageModule.storage.getBackgroundBootstrapData as Mock).mockResolvedValue({
			settings: baseSettings(),
			provider: providerConfig,
		});
		(storageModule.storage.getPullRequests as Mock).mockResolvedValue({ myPRs: [], reviewRequests: [], lastFetched: null });

		await import('../../service-worker');

		onInstalled = (extensionApi.runtimeOnInstalledAddListener as Mock).mock.calls[0][0];
		onStartup = (extensionApi.runtimeOnStartupAddListener as Mock).mock.calls[0][0];
		onAlarm = (extensionApi.alarmsOnAlarmAddListener as Mock).mock.calls[0][0];
		onMessage = (extensionApi.runtimeOnMessageAddListener as Mock).mock.calls[0][0];
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('install lifecycle', () => {
		it('opens onboarding on fresh install and skips fetching', async () => {
			await onInstalled({ reason: 'install' });

			expect(extensionApi.tabsCreate).toHaveBeenCalledWith({ url: 'chrome-extension://fake-id/onboarding/onboarding.html' });
			expect(providerManagerModule.providerManager.createProvider).not.toHaveBeenCalled();
		});

		it('initializes provider and fetches PRs on update', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [makePR('1')],
				reviewRequests: [],
				lastFetched: null,
			});

			await onInstalled({ reason: 'update' });

			expect(providerManagerModule.providerManager.createProvider).toHaveBeenCalledWith('github', {
				token: 'test-token',
				baseUrl: 'https://api.github.com',
			});
			expect(storageModule.storage.setPullRequests).toHaveBeenCalled();
			expect(extensionApi.actionSetBadgeText).toHaveBeenCalledWith({ text: '1' });
		});

		it('runs the same bootstrap sequence on browser startup', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [makePR('1'), makePR('2')],
				reviewRequests: [],
				lastFetched: null,
			});

			await onStartup();

			expect(extensionApi.actionSetBadgeText).toHaveBeenCalledWith({ text: '2' });
		});
	});

	describe('fetchAndCachePRs error handling', () => {
		it('marks the token invalid on a 401 response', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockRejectedValue(
				Object.assign(new Error('Bad credentials'), { details: { statusCode: 401 } }),
			);
			(storageModule.storage.getProvider as Mock).mockResolvedValue({ ...providerConfig });

			await onInstalled({ reason: 'update' });

			expect(storageModule.storage.setProvider).toHaveBeenCalledWith(expect.objectContaining({ isTokenInvalid: true }));
		});

		it('retries transient network failures with backoff, then succeeds', async () => {
			vi.useFakeTimers();
			const networkError = new TypeError('Failed to fetch');
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock)
				.mockRejectedValueOnce(networkError)
				.mockRejectedValueOnce(networkError)
				.mockResolvedValueOnce({ myPRs: [], reviewRequests: [], lastFetched: null });

			const runPromise = onInstalled({ reason: 'update' });
			await vi.runAllTimersAsync();
			await runPromise;

			expect(providerManagerModule.providerManager.fetchAllPullRequests).toHaveBeenCalledTimes(3);
			expect(storageModule.storage.setPullRequests).toHaveBeenCalled();
		});

		it('does not retry non-network errors', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockRejectedValue(new Error('boom'));

			await onInstalled({ reason: 'update' });

			expect(providerManagerModule.providerManager.fetchAllPullRequests).toHaveBeenCalledTimes(1);
		});
	});

	describe('badge counting', () => {
		it('uses the total count for the pinned tab by default', async () => {
			(storageModule.storage.getBackgroundBootstrapData as Mock).mockResolvedValue({
				settings: baseSettings({ pinnedTab: 'toReview' }),
				provider: providerConfig,
			});
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [makePR('1')],
				reviewRequests: [makePR('2'), makePR('3')],
				lastFetched: null,
			});

			await onInstalled({ reason: 'update' });

			expect(extensionApi.actionSetBadgeText).toHaveBeenCalledWith({ text: '2' });
		});

		it('applies persisted popup filters when badgeCountMode is "filters"', async () => {
			(storageModule.storage.getBackgroundBootstrapData as Mock).mockResolvedValue({
				settings: baseSettings({ pinnedTab: 'myPRs', badgeCountMode: 'filters' }),
				provider: providerConfig,
			});
			(extensionApi.storageLocalGet as Mock).mockResolvedValue({
				searchFilters: { tabs: { myPRs: { drafts: 'exclude' } } },
			});
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [makePR('1', { isDraft: true }), makePR('2', { isDraft: false })],
				reviewRequests: [],
				lastFetched: null,
			});

			await onInstalled({ reason: 'update' });

			expect(extensionApi.actionSetBadgeText).toHaveBeenCalledWith({ text: '1' });
		});

		it('clears the badge text when the count is zero', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [],
				reviewRequests: [],
				lastFetched: null,
			});

			await onInstalled({ reason: 'update' });

			expect(extensionApi.actionSetBadgeText).toHaveBeenCalledWith({ text: '' });
		});
	});

	describe('polling alarm setup', () => {
		it('clears the alarm in manual refresh mode', async () => {
			(storageModule.storage.getBackgroundBootstrapData as Mock).mockResolvedValue({
				settings: baseSettings({ pollingIntervalMs: 0 }),
				provider: providerConfig,
			});
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [],
				reviewRequests: [],
				lastFetched: null,
			});

			await onInstalled({ reason: 'update' });

			expect(extensionApi.alarmsClear).toHaveBeenCalledWith('pr-poll');
			expect(extensionApi.alarmsCreate).not.toHaveBeenCalled();
		});

		it('creates a recurring alarm sized in whole minutes', async () => {
			(storageModule.storage.getBackgroundBootstrapData as Mock).mockResolvedValue({
				settings: baseSettings({ pollingIntervalMs: 300000 }),
				provider: providerConfig,
			});
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [],
				reviewRequests: [],
				lastFetched: null,
			});

			await onInstalled({ reason: 'update' });

			expect(extensionApi.alarmsCreate).toHaveBeenCalledWith('pr-poll', { delayInMinutes: 5, periodInMinutes: 5 });
		});

		it('triggers a fetch when the poll alarm fires', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [makePR('1')],
				reviewRequests: [],
				lastFetched: null,
			});

			await onAlarm({ name: 'pr-poll' });

			expect(providerManagerModule.providerManager.fetchAllPullRequests).toHaveBeenCalledTimes(1);
		});

		it('ignores alarms with a different name', async () => {
			await onAlarm({ name: 'something-else' });
			expect(providerManagerModule.providerManager.fetchAllPullRequests).not.toHaveBeenCalled();
		});
	});

	describe('message handlers', () => {
		it('GET_PRS returns cached pull requests', async () => {
			const data: PullRequestData = { myPRs: [makePR('1')], reviewRequests: [], lastFetched: 123 };
			(storageModule.storage.getPullRequests as Mock).mockResolvedValue(data);

			const result = await onMessage({ type: 'GET_PRS' });

			expect(result).toEqual(data);
		});

		it('REFRESH_PRS reports TOKEN_INVALID on a 401', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockRejectedValue(
				Object.assign(new Error('Bad credentials'), { details: { statusCode: 401 } }),
			);

			const result = await onMessage({ type: 'REFRESH_PRS' });

			expect(result).toEqual({ success: false, error: 'TOKEN_INVALID' });
		});

		it('REFRESH_PRS reports a generic failure message otherwise', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockRejectedValue(new Error('network down'));

			const result = await onMessage({ type: 'REFRESH_PRS' });

			expect(result).toEqual({ success: false, error: 'network down' });
		});

		it('REFRESH_PRS succeeds and caches data', async () => {
			(providerManagerModule.providerManager.fetchAllPullRequests as Mock).mockResolvedValue({
				myPRs: [],
				reviewRequests: [],
				lastFetched: null,
			});

			const result = await onMessage({ type: 'REFRESH_PRS' });

			expect(result).toEqual({ success: true });
			expect(storageModule.storage.setPullRequests).toHaveBeenCalled();
		});

		it('UPDATE_SETTINGS persists settings and recreates the alarm on interval changes', async () => {
			(storageModule.storage.getSettings as Mock).mockResolvedValue(baseSettings({ pollingIntervalMs: 120000 }));

			const result = await onMessage({ type: 'UPDATE_SETTINGS', settings: { pollingIntervalMs: 120000 } });

			expect(result).toEqual({ success: true });
			expect(storageModule.storage.setSettings).toHaveBeenCalledWith({ pollingIntervalMs: 120000 });
			expect(extensionApi.alarmsCreate).toHaveBeenCalledWith('pr-poll', { delayInMinutes: 2, periodInMinutes: 2 });
		});

		it('UPDATE_BADGE_COUNT sets the badge directly', async () => {
			const result = await onMessage({ type: 'UPDATE_BADGE_COUNT', count: 7 });

			expect(result).toEqual({ success: true });
			expect(extensionApi.actionSetBadgeText).toHaveBeenCalledWith({ text: '7' });
		});

		it('CLEAR_ALL resets the provider, alarm, and badge', async () => {
			const result = await onMessage({ type: 'CLEAR_ALL' });

			expect(result).toEqual({ success: true });
			expect(providerManagerModule.providerManager.setProvider).toHaveBeenCalledWith(null);
			expect(extensionApi.alarmsClear).toHaveBeenCalledWith('pr-poll');
			expect(extensionApi.actionSetBadgeText).toHaveBeenCalledWith({ text: '' });
		});

		it('returns an error payload for an unknown message type', async () => {
			const result = await onMessage({ type: 'NOT_A_REAL_TYPE' });
			expect(result).toEqual({ error: 'Unknown message type' });
		});

		it('catches handler exceptions and reports them as a failure response', async () => {
			(storageModule.storage.getPullRequests as Mock).mockRejectedValue(new Error('storage exploded'));

			const result = await onMessage({ type: 'GET_PRS' });

			expect(result).toEqual({ success: false, error: 'storage exploded' });
		});
	});
});
