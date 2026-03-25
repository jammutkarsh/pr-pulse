import { providerManager } from './lib/provider-manager';
import { storage } from './lib/storage';
import type { PullRequestData, RuntimeMessage, Settings, StoredProviderConfig } from './lib/types';

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

async function updateBadgeFromSettings(data: PullRequestData): Promise<void> {
	const { settings } = await getRuntimeConfig();
	const count = settings.pinnedTab === 'myPRs' ? data.myPRs.length : data.reviewRequests.length;
	updateBadge(count);
}

function updateBadge(count: number): void {
	const text = count > 0 ? String(count) : '';
	chrome.action.setBadgeText({ text });
	chrome.action.setBadgeBackgroundColor({ color: '#238636' });
}

async function setupPollingAlarm(forceRecreate = false): Promise<void> {
	if (!forceRecreate) {
		const existing = await chrome.alarms.get(ALARM_NAME);
		if (existing) {
			console.log('Polling alarm already exists, skipping recreation');
			return;
		}
	}

	const { settings } = await getRuntimeConfig();
	const intervalMinutes = (settings.pollingIntervalMs || 600000) / 60000;
	await chrome.alarms.clear(ALARM_NAME);
	chrome.alarms.create(ALARM_NAME, {
		delayInMinutes: Math.max(1, intervalMinutes),
		periodInMinutes: Math.max(1, intervalMinutes),
	});
	console.log(`Polling alarm set for every ${intervalMinutes} minute(s)`);
}

chrome.runtime.onInstalled.addListener(async (details) => {
	console.log('Extension installed/updated:', details.reason);
	if (details.reason === 'install') {
		const onboardingUrl = chrome.runtime.getURL('onboarding/onboarding.html');
		chrome.tabs.create({ url: onboardingUrl });
		return;
	}

	await initializeProvider(true);
	await fetchAndCachePRs();
	await setupPollingAlarm(true);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name === ALARM_NAME) {
		console.log('Polling alarm triggered');
		await fetchAndCachePRs();
	}
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
	handleMessage(message)
		.then(sendResponse)
		.catch((error) => {
			console.error('Error handling runtime message:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			sendResponse({ success: false, error: errorMessage });
		});
	return true;
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
			if (message.settings.pollingIntervalMs) {
				await setupPollingAlarm(true);
			}
		}
		return { success: true };
	},
	SETTINGS_UPDATED: async (message) => {
		if ('settings' in message) {
			cachedSettings = cachedSettings ? { ...cachedSettings, ...message.settings } : await storage.getSettings();
			if (message.settings.pinnedTab) {
				const data = await storage.getPullRequests();
				await updateBadgeFromSettings(data);
			}
		}
		return { success: true };
	},
	CLEAR_ALL: async () => {
		providerManager.setProvider(null);
		cachedSettings = null;
		cachedProviderConfig = undefined;
		await chrome.alarms.clear(ALARM_NAME);
		chrome.action.setBadgeText({ text: '' });
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

void initializeProvider().then(() => {
	void setupPollingAlarm();
});