import { providerManager } from './lib/provider-manager';
import {
	actionSetBadgeBackgroundColor,
	actionSetBadgeText,
	alarmsOnAlarmAddListener,
	alarmsClear,
	alarmsCreate,
	alarmsGet,
	runtimeGetURL,
	runtimeOnInstalledAddListener,
	runtimeOnMessageAddListener,
	runtimeOnStartupAddListener,
	storageLocalGet,
	tabsCreate,
} from './lib/extension-api';
import { storage } from './lib/storage';
import { filterPullRequests } from './lib/utils';
import type { PullRequestData, PopupFilters, RuntimeMessage, Settings, StoredProviderConfig } from './lib/types';

const ALARM_NAME = 'pr-poll';
let cachedSettings: Settings | null = null;
let cachedProviderConfig: StoredProviderConfig | undefined;

async function getRuntimeConfig(forceRefresh = false): Promise<{ settings: Settings; provider: StoredProviderConfig | undefined }> {
	if (!forceRefresh && cachedSettings) {
		return {
			settings: cachedSettings,
			provider: cachedProviderConfig,
		};
	}

	const runtimeConfig = await storage.getBackgroundBootstrapData();
	cachedSettings = runtimeConfig.settings;
	cachedProviderConfig = runtimeConfig.provider;
	return runtimeConfig;
}


async function initializeProvider(forceRefresh = false): Promise<boolean> {
	const { provider: providerConfig } = await getRuntimeConfig(forceRefresh);
	if (providerConfig) {
		const provider = providerManager.createProvider(providerConfig.type, {
			token: providerConfig.token,
			baseUrl: providerConfig.baseUrl,
		});
		providerManager.setProvider(provider);
		return true;
	}

	return false;
}

async function fetchAndCachePRs(): Promise<void> {
	try {
		if (!providerManager.hasProvider()) {
			const initialized = await initializeProvider();
			if (!initialized) {
				console.log('No provider configured, skipping fetch');
				return;
			}
		}

		console.log('Fetching PR data...');
		const data = await providerManager.fetchAllPullRequests();
		await storage.setPullRequests(data);
		await updateBadgeFromSettings(data);
		console.log(`Fetched ${data.myPRs.length} my PRs, ${data.reviewRequests.length} review requests`);
	} catch (error) {
		console.error('Failed to fetch PR data:', error);
	}
}

async function restoreBadgeFromStorage(): Promise<void> {
	const data = await storage.getPullRequests();
	await updateBadgeFromSettings(data);
}

async function updateBadgeFromSettings(data: PullRequestData): Promise<void> {
	const { settings } = await getRuntimeConfig();
	const totalCount = settings.pinnedTab === 'myPRs' ? data.myPRs.length : data.reviewRequests.length;

	if (settings.badgeCountMode === 'filters') {
		const persisted = await storageLocalGet<{ tabs?: Record<string, PopupFilters> }>(['searchFilters']);
		const tabs = persisted.searchFilters?.tabs;
		const filters = tabs?.[settings.pinnedTab];

		if (filters) {
			const items = settings.pinnedTab === 'myPRs' ? data.myPRs : data.reviewRequests;
			const filtered = filterPullRequests(items, {
				authors: filters.authors,
				owners: filters.owners,
				repos: filters.repos,
				drafts: filters.drafts,
				showReviewed: settings.pinnedTab === 'toReview' ? filters.showReviewed : undefined,
			});
			await updateBadge(filtered.length);
			return;
		}
	}

	await updateBadge(totalCount);
}

async function updateBadge(count: number): Promise<void> {
	const text = count > 0 ? String(count) : '';
	await Promise.all([
		actionSetBadgeText({ text }),
		actionSetBadgeBackgroundColor({ color: '#238636' }),
	]);
}

async function setupPollingAlarm(forceRecreate = false): Promise<void> {
	const { settings } = await getRuntimeConfig();

	// Manual refresh mode — clear any existing alarm and stop
	if (!settings.pollingIntervalMs) {
		await alarmsClear(ALARM_NAME);
		console.log('Manual refresh mode: polling alarm cleared');
		return;
	}

	if (!forceRecreate) {
		const existing = await alarmsGet(ALARM_NAME);
		if (existing) {
			console.log('Polling alarm already exists, skipping recreation');
			return;
		}
	}

	const intervalMinutes = settings.pollingIntervalMs / 60000;
	await alarmsClear(ALARM_NAME);
	alarmsCreate(ALARM_NAME, {
		delayInMinutes: Math.max(1, intervalMinutes),
		periodInMinutes: Math.max(1, intervalMinutes),
	});
	console.log(`Polling alarm set for every ${intervalMinutes} minute(s)`);
}

runtimeOnInstalledAddListener(async (details) => {
	console.log('Extension installed/updated:', details.reason);
	if (details.reason === 'install') {
		const onboardingUrl = runtimeGetURL('onboarding/onboarding.html');
		await tabsCreate({ url: onboardingUrl });
		return;
	}

	await initializeProvider(true);
	await fetchAndCachePRs();
	await setupPollingAlarm(true);
});

runtimeOnStartupAddListener(async () => {
	await initializeProvider(true);
	await restoreBadgeFromStorage();
	await fetchAndCachePRs();
	await setupPollingAlarm(true);
});

alarmsOnAlarmAddListener(async (alarm) => {
	if (alarm.name === ALARM_NAME) {
		console.log('Polling alarm triggered');
		await fetchAndCachePRs();
	}
});

runtimeOnMessageAddListener(async (message) => {
	try {
		return await handleMessage(message as RuntimeMessage);
	} catch (error) {
		console.error('Error handling runtime message:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, error: errorMessage };
	}
});

const messageHandlers: Record<RuntimeMessage['type'], (message: RuntimeMessage) => Promise<unknown>> = {
	PROVIDER_CONFIGURED: async () => {
		await initializeProvider(true);
		await fetchAndCachePRs();
		await setupPollingAlarm(true);
		return { success: true };
	},
	REFRESH_PRS: async () => {
		await fetchAndCachePRs();
		return { success: true };
	},
	GET_PRS: async () => storage.getPullRequests(),
	UPDATE_SETTINGS: async (message) => {
		if ('settings' in message) {
			await storage.setSettings(message.settings);
			cachedSettings = cachedSettings ? { ...cachedSettings, ...message.settings } : await storage.getSettings();
			if ('pollingIntervalMs' in message.settings) {
				await setupPollingAlarm(true);
			}
		}
		return { success: true };
	},
	SETTINGS_UPDATED: async (message) => {
		if ('settings' in message) {
			cachedSettings = cachedSettings ? { ...cachedSettings, ...message.settings } : await storage.getSettings();
			if (message.settings.pinnedTab || message.settings.badgeCountMode) {
				const data = await storage.getPullRequests();
				await updateBadgeFromSettings(data);
			}
		}
		return { success: true };
	},
	UPDATE_BADGE_COUNT: async (message) => {
		if ('count' in message) {
			await updateBadge(message.count);
		}
		return { success: true };
	},
	CLEAR_ALL: async () => {
		providerManager.setProvider(null);
		cachedSettings = null;
		cachedProviderConfig = undefined;
		await alarmsClear(ALARM_NAME);
		await actionSetBadgeText({ text: '' });
		return { success: true };
	},
};

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
	const handler = messageHandlers[message.type];
	if (handler) {
		return handler(message);
	}

	console.warn('Unknown message type:', message.type);
	return { error: 'Unknown message type' };
}
