import { GitHubProvider } from './lib/providers/github-provider';
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
	tabsCreate,
} from './lib/extension-api';
import { storage } from './lib/storage';
import { createPrView } from './lib/pr-view';
import type { PrSource, PrSourceResult, RuntimeMessage, Settings, StoredProviderConfig } from './lib/types';

const ALARM_NAME = 'pr-poll';
let prSource: PrSource | null = null;
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

async function initializeProvider(forceRefresh = false): Promise<PrSource | null> {
	const { provider: providerConfig } = await getRuntimeConfig(forceRefresh);
	prSource = providerConfig ? new GitHubProvider({ token: providerConfig.token, baseUrl: providerConfig.baseUrl }) : null;

	return prSource;
}

async function fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';
			if (!isNetworkError || attempt === maxRetries) {
				throw error;
			}
			const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
			console.log(`Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
	throw lastError;
}

async function fetchAndCachePRs(throwError = false): Promise<void> {
	try {
		const source = prSource ?? (await initializeProvider(true));
		if (!source) {
			console.log('No provider configured, skipping fetch');
			if (throwError) throw new Error('No provider configured');
			return;
		}

		console.log('Fetching PR data...');
		const data = await fetchWithRetry(() => source.getAllPullRequests());
		await storage.setPullRequests(data);
		await updateBadgeFromSettings(data);
		console.log(`Fetched ${data.myPRs.length} my PRs, ${data.reviewRequests.length} review requests`);
	} catch (error) {
		console.error('Failed to fetch PR data:', error);
		const err = error as Error & { details?: { statusCode?: number } };
		if (err?.details?.statusCode === 401 || (err?.message && err.message.includes('401'))) {
			const config = await storage.getProvider();
			if (config) {
				config.isTokenInvalid = true;
				await storage.setProvider(config);
			}
		}
		if (throwError) throw error;
	}
}

async function restoreBadgeFromStorage(): Promise<void> {
	const data = await storage.getPullRequests();
	await updateBadgeFromSettings(data);
}

async function updateBadgeFromSettings(data: PrSourceResult): Promise<void> {
	const { settings } = await getRuntimeConfig();
	const items = settings.pinnedTab === 'myPRs' ? data.myPRs : data.reviewRequests;

	if (settings.badgeCountMode === 'filters') {
		const filters = (await storage.getFilters(settings.pinnedTab))[settings.pinnedTab];
		// Same view the popup builds, same empty-query path; only an active filter narrows the badge.
		const view = createPrView(items, filters, '', settings.pinnedTab);
		if (view.filterCount > 0) {
			await updateBadge(view.items.length);
			return;
		}
	}

	await updateBadge(items.length);
}

async function updateBadge(count: number): Promise<void> {
	const text = count > 0 ? String(count) : '';
	await Promise.all([actionSetBadgeText({ text }), actionSetBadgeBackgroundColor({ color: '#238636' })]);
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
		try {
			await fetchAndCachePRs(true);
			return { success: true };
		} catch (err) {
			const error = err as Error & { details?: { statusCode?: number } };
			if (error?.details?.statusCode === 401 || (error?.message && error.message.includes('401'))) {
				return { success: false, error: 'TOKEN_INVALID' };
			}
			return { success: false, error: error?.message || 'Failed to refresh PRs' };
		}
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
		prSource = null;
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
