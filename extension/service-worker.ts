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
import { badgeCount } from './lib/pr-view';
import { isAuthError } from './lib/errors';
import type { PrSource, RuntimeMessage } from './lib/types';

const ALARM_NAME = 'pr-poll';

// No settings cache. MV3 tears this worker down between events, so a cache guards a local storage
// read that is already cheap, at the cost of three module-level variables five handlers had to
// invalidate by hand. Read on demand instead; storage is the single source.

async function currentSource(): Promise<PrSource | null> {
	const provider = await storage.getProvider();
	return provider ? new GitHubProvider({ token: provider.token, baseUrl: provider.baseUrl }) : null;
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
		const source = await currentSource();
		if (!source) {
			console.log('No provider configured, skipping fetch');
			if (throwError) throw new Error('No provider configured');
			return;
		}

		console.log('Fetching PR data...');
		const data = await fetchWithRetry(() => source.getAllPullRequests());
		await storage.setPullRequests(data);
		await refreshBadge();
		console.log(`Fetched ${data.myPRs.length} my PRs, ${data.reviewRequests.length} review requests`);
	} catch (error) {
		console.error('Failed to fetch PR data:', error);
		if (isAuthError(error)) {
			const config = await storage.getProvider();
			if (config) {
				config.isTokenInvalid = true;
				await storage.setProvider(config);
			}
		}
		if (throwError) throw error;
	}
}

/** The count itself is decided by the view module, so the popup and the badge cannot disagree. */
async function refreshBadge(): Promise<void> {
	const { settings, pullRequests } = await storage.getBootstrapData();
	const filters = await storage.getFilters(settings.pinnedTab);
	await updateBadge(badgeCount(pullRequests, settings, filters));
}

async function updateBadge(count: number): Promise<void> {
	const text = count > 0 ? String(count) : '';
	await Promise.all([actionSetBadgeText({ text }), actionSetBadgeBackgroundColor({ color: '#238636' })]);
}

async function setupPollingAlarm(forceRecreate = false): Promise<void> {
	const settings = await storage.getSettings();

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

	await fetchAndCachePRs();
	await setupPollingAlarm(true);
});

runtimeOnStartupAddListener(async () => {
	await refreshBadge();
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
		await fetchAndCachePRs();
		await setupPollingAlarm(true);
		return { success: true };
	},
	REFRESH_PRS: async () => {
		try {
			await fetchAndCachePRs(true);
			return { success: true };
		} catch (error) {
			if (isAuthError(error)) {
				return { success: false, error: 'TOKEN_INVALID' };
			}
			return { success: false, error: (error as Error)?.message || 'Failed to refresh PRs' };
		}
	},
	GET_PRS: async () => storage.getPullRequests(),
	// The page that changed a setting has already written it. This says which keys moved so the worker
	// can react — it is not a second write, which is what the old UPDATE_SETTINGS/SETTINGS_UPDATED pair
	// ended up doing to the same value.
	SETTINGS_CHANGED: async (message) => {
		if ('settings' in message) {
			if ('pollingIntervalMs' in message.settings) {
				await setupPollingAlarm(true);
			}

			if ('pinnedTab' in message.settings || 'badgeCountMode' in message.settings) {
				await refreshBadge();
			}
		}
		return { success: true };
	},
	// The popup's filters may never reach disk (persistFilters off), so it pushes the number it computed
	// from the same badgeCount() the worker uses.
	UPDATE_BADGE_COUNT: async (message) => {
		if ('count' in message) {
			await updateBadge(message.count);
		}
		return { success: true };
	},
	CLEAR_ALL: async () => {
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
