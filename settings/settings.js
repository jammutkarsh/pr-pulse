/**
 * PR Pulse - Settings Script
 * Handles settings page functionality
 */

import { storage } from '../lib/storage.js';
import { sanitizeJiraUrl, isValidHttpUrl, escapeHtml } from '../lib/utils.js';
import { GitHubProvider } from '../lib/providers/github-provider.js';

// DOM Elements
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const jiraUrlInput = document.getElementById('jira-url');
const saveStatus = document.getElementById('save-status');
const closeSettingsBtn = document.getElementById('close-settings');
const reconnectBtn = document.getElementById('reconnect-btn');
const resetBtn = document.getElementById('reset-btn');
const connectedState = document.getElementById('connected-state');
const tokenInputState = document.getElementById('token-input-state');
const tokenInput = document.getElementById('token-input');
const saveTokenBtn = document.getElementById('save-token-btn');
const cancelTokenBtn = document.getElementById('cancel-token-btn');
const tokenError = document.getElementById('token-error');
const tokenSuccess = document.getElementById('token-success');
const jiraHelpText = document.getElementById('jira-help-text');

let currentSettings = {};
let isConnected = false;

/**
 * Initialize settings page
 */
async function init() {
	try {
		// Load current settings
		currentSettings = await storage.getSettings() || {};
		const provider = await storage.getProvider();

		// Check if connected
		isConnected = !!(provider && provider.user);

		if (isConnected) {
			// Show connected state
			userAvatar.src = provider.user.avatarUrl;
			userName.textContent = provider.user.name || provider.user.login;
			showConnectedState();
		} else {
			// Show token input state
			showTokenInputState();
		}

		// Set current values
		if (jiraUrlInput) {
			// Always sanitize the stored URL on load for display
			const savedUrl = currentSettings.jiraBaseUrl || '';
			const sanitizedUrl = sanitizeJiraUrl(savedUrl);
			jiraUrlInput.value = sanitizedUrl;
			updateJiraHelpText(sanitizedUrl);

			// If the stored URL was dirty (different from sanitized), update it now
			if (savedUrl && savedUrl !== sanitizedUrl) {
				await storage.updateSetting('jiraBaseUrl', sanitizedUrl);
			}
		}

		// Set radio buttons
		setRadioValue('pinnedTab', currentSettings.pinnedTab || 'myPRs');
		setRadioValue('displayMode', currentSettings.displayMode || 'popup');

		// Event listeners
		setupEventListeners();
	} catch (error) {
		console.error('Failed to load settings:', error);
	}
}

/**
 * Update Jira help text based on URL value
 */
function updateJiraHelpText(url) {
	if (!jiraHelpText) return;

	const cleanUrl = sanitizeJiraUrl(url); // Ensure we always work with clean URL for the link

	if (cleanUrl && isValidHttpUrl(cleanUrl)) {
		const dashboardUrl = `${cleanUrl}/jira/for-you`;
		
		// Use safe DOM manipulation instead of innerHTML to prevent XSS
		jiraHelpText.textContent = 'See all your tickets: ';
		
		const link = document.createElement('a');
		link.href = dashboardUrl;
		link.target = '_blank';
		link.style.color = 'var(--primary)';
		link.style.textDecoration = 'underline';
		link.textContent = dashboardUrl;
		
		jiraHelpText.appendChild(link);
	} else {
		jiraHelpText.textContent = "Enter your Jira URL (any URL - we'll extract the base!)";
	}
}

/**
 * Show connected state, hide token input
 */
function showConnectedState() {
	connectedState.classList.remove('hidden');
	tokenInputState.classList.add('hidden');
}

/**
 * Show token input state, hide connected
 */
function showTokenInputState() {
	connectedState.classList.add('hidden');
	tokenInputState.classList.remove('hidden');
	tokenError.classList.add('hidden');
	tokenSuccess.classList.add('hidden');
	tokenInput.value = '';
	tokenInput.focus();
}

/**
 * Validate GitHub token format
 * GitHub PATs have specific formats:
 * - Classic tokens: ghp_ followed by 36 alphanumeric characters
 * - Fine-grained tokens: github_pat_ followed by alphanumeric characters
 * @param {string} token - Token to validate
 * @returns {boolean} - True if token format is valid
 */
function isValidTokenFormat(token) {
	if (!token || typeof token !== 'string') return false;
	
	// Classic PAT: ghp_ followed by 36 alphanumeric chars
	const classicPattern = /^ghp_[a-zA-Z0-9]{36}$/;
	// Fine-grained PAT: github_pat_ followed by alphanumeric chars and underscores
	const fineGrainedPattern = /^github_pat_[a-zA-Z0-9_]{22,}$/;
	
	return classicPattern.test(token) || fineGrainedPattern.test(token);
}

/**
 * Validate and save token
 */
async function validateAndSaveToken() {
	const token = tokenInput.value.trim();

	// Clear previous messages
	tokenError.classList.add('hidden');
	tokenSuccess.classList.add('hidden');

	if (!token) {
		showTokenError('Please enter a token');
		return;
	}

	// Strict token format validation
	if (!isValidTokenFormat(token)) {
		showTokenError('Invalid token format. Token should be a valid GitHub Personal Access Token (ghp_... or github_pat_...)');
		return;
	}

	// Disable button and show loading
	saveTokenBtn.disabled = true;
	saveTokenBtn.textContent = 'Validating...';

	try {
		// Validate token with GitHub API - create fresh instance each time
		const provider = new GitHubProvider({ token });
		const user = await provider.getUser();

		if (!user || !user.login) {
			throw new Error('Invalid user response from GitHub API');
		}

		// Save provider config (this is the source of truth for authentication)
		await storage.setProvider({
			type: 'github',
			token: token,
			baseUrl: 'https://api.github.com',
			user: user,
		});

		// Show success
		tokenSuccess.textContent = `Connected as ${user.name || user.login}!`;
		tokenSuccess.classList.remove('hidden');

		// Notify service worker
		chrome.runtime.sendMessage({ type: 'PROVIDER_CONFIGURED' });

		// Reload page after short delay
		setTimeout(() => {
			window.location.reload();
		}, 1000);

	} catch (error) {
		console.error('Token validation failed:', error);
		showTokenError(`Failed: ${error.message || 'Invalid token or API error. Please check your token.'}`);
		saveTokenBtn.disabled = false;
		saveTokenBtn.textContent = 'Connect';
	}
}

/**
 * Show token error message
 */
function showTokenError(message) {
	tokenError.textContent = message;
	tokenError.classList.remove('hidden');
}

/**
 * Set radio button value and update UI
 */
function setRadioValue(name, value) {
	const options = document.querySelectorAll(`input[name="${name}"]`);
	options.forEach(radio => {
		const label = radio.closest('.radio-option');
		if (label) {
			if (radio.value === value) {
				radio.checked = true;
				label.classList.add('selected');
			} else {
				label.classList.remove('selected');
			}
		}
	});
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
	// Radio options
	document.querySelectorAll('.radio-option').forEach(option => {
		option.addEventListener('click', async () => {
			const input = option.querySelector('input');
			const name = input.name;
			const value = input.value;

			// Update UI
			document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
				radio.closest('.radio-option').classList.remove('selected');
			});
			option.classList.add('selected');
			input.checked = true;

			// Save setting
			await storage.updateSetting(name, value);

			// If pinnedTab changed, notify service worker to update badge
			if (name === 'pinnedTab') {
				chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: { pinnedTab: value } });
			}

			showSaveStatus();
		});
	});

	// Jira URL input - sanitize and save on blur (no debounce needed)
	if (jiraUrlInput) {
		jiraUrlInput.addEventListener('blur', async () => {
			const rawValue = jiraUrlInput.value.trim();
			if (rawValue) {
				// Sanitize URL to extract base URL only
				const sanitizedUrl = sanitizeJiraUrl(rawValue);
				jiraUrlInput.value = sanitizedUrl;
				await storage.updateSetting('jiraBaseUrl', sanitizedUrl);
				updateJiraHelpText(sanitizedUrl);
			} else {
				// Clear the URL if empty
				await storage.updateSetting('jiraBaseUrl', '');
				updateJiraHelpText('');
			}
			showSaveStatus();
		});
	}

	// Close settings - go back to PR Pulse in same tab (full page mode)
	closeSettingsBtn.addEventListener('click', (e) => {
		e.preventDefault();
		window.location.href = chrome.runtime.getURL('popup/popup.html?fullpage=1');
	});

	// Reconnect - show token input instead of redirecting
	reconnectBtn.addEventListener('click', () => {
		showTokenInputState();
	});

	// Save token button
	saveTokenBtn.addEventListener('click', validateAndSaveToken);

	// Cancel token button
	cancelTokenBtn.addEventListener('click', () => {
		if (isConnected) {
			showConnectedState();
		}
	});

	// Token input - allow Enter key to submit
	tokenInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			validateAndSaveToken();
		}
	});

	// Reset all data
	resetBtn.addEventListener('click', async () => {
		if (confirm('This will clear all your settings and cached data. Are you sure?')) {
			await storage.clearAll();
			showTokenInputState();
		}
	});
}

/**
 * Show save status indicator
 */
function showSaveStatus() {
	saveStatus.classList.add('visible');
	setTimeout(() => {
		saveStatus.classList.remove('visible');
	}, 2000);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

