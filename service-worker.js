/**
 * PR Pulse - Service Worker
 * Handles background tasks: polling, alarms, and badge updates
 */

import { providerManager } from './lib/provider-manager.js';
import { storage } from './lib/storage.js';

const ALARM_NAME = 'pr-poll';

/**
 * Initialize the provider from storage
 */
async function initializeProvider() {
	const providerConfig = await storage.getProvider();

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

/**
 * Fetch and cache PR data
 */
async function fetchAndCachePRs() {
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

		// Update badge based on pinned tab setting
		await updateBadgeFromSettings(data);

		console.log(`Fetched ${data.myPRs.length} my PRs, ${data.reviewRequests.length} review requests`);
	} catch (error) {
		console.error('Failed to fetch PR data:', error);
	}
}

/**
 * Update badge count based on pinned tab setting
 * @param {Object} data - PR data with myPRs and reviewRequests arrays
 */
async function updateBadgeFromSettings(data) {
	const settings = await storage.getSettings();
	const pinnedTab = settings.pinnedTab || 'myPRs';

	// Show count for the pinned tab only
	const count = pinnedTab === 'myPRs'
		? (data?.myPRs?.length || 0)
		: (data?.reviewRequests?.length || 0);

	updateBadge(count);
}

/**
 * Update extension badge with count
 * @param {number} count - Number to display
 */
function updateBadge(count) {
	const text = count > 0 ? String(count) : '';
	chrome.action.setBadgeText({ text });
	chrome.action.setBadgeBackgroundColor({ color: '#238636' }); // GitHub green
}

/**
 * Set up polling alarm
 */
async function setupPollingAlarm() {
	const settings = await storage.getSettings();
	const intervalMinutes = (settings.pollingIntervalMs || 60000) / 60000;

	// Clear existing alarm
	await chrome.alarms.clear(ALARM_NAME);

	// Create new alarm
	chrome.alarms.create(ALARM_NAME, {
		periodInMinutes: Math.max(1, intervalMinutes), // Minimum 1 minute
	});

	console.log(`Polling alarm set for every ${intervalMinutes} minute(s)`);
}

/**
 * Handle extension installation or update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
	console.log('Extension installed/updated:', details.reason);

	if (details.reason === 'install') {
		// Open onboarding page on first install
		chrome.tabs.create({ url: 'onboarding/onboarding.html' });
	} else {
		// On update, try to initialize and fetch
		await initializeProvider();
		await fetchAndCachePRs();
		await setupPollingAlarm();
	}
});

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name === ALARM_NAME) {
		console.log('Polling alarm triggered');
		await fetchAndCachePRs();
	}
});

/**
 * Handle messages from popup/onboarding
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	handleMessage(message).then(sendResponse);
	return true; // Keep message channel open for async response
});

/**
 * Process incoming messages
 * @param {Object} message - Message object
 * @returns {Promise<any>}
 */
async function handleMessage(message) {
	switch (message.type) {
		case 'PROVIDER_CONFIGURED':
			await initializeProvider();
			await fetchAndCachePRs();
			await setupPollingAlarm();
			return { success: true };

		case 'REFRESH_PRS':
			await fetchAndCachePRs();
			return { success: true };

		case 'GET_PRS':
			const prData = await storage.getPullRequests();
			return prData;

		case 'UPDATE_SETTINGS':
			await storage.setSettings(message.settings);
			if (message.settings.pollingIntervalMs) {
				await setupPollingAlarm();
			}
			return { success: true };

		case 'SETTINGS_UPDATED':
			// Re-update badge when pinned tab changes
			if (message.settings?.pinnedTab) {
				const data = await storage.getPullRequests();
				await updateBadgeFromSettings(data);
			}
			return { success: true };

		default:
			console.warn('Unknown message type:', message.type);
			return { error: 'Unknown message type' };
	}
}

// Initialize on service worker start
initializeProvider().then(() => {
	setupPollingAlarm();
});
