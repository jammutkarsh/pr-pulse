/**
 * PR Pulse - Popup Script
 * Handles the main popup UI and interactions
 */

import { storage, DEFAULT_USER } from '../lib/storage.js';
import {
	extractJiraTicket,
	getJiraUrl,
	formatLinesChanged,
	getReviewStatusDisplay,
	getCheckStatusDisplay,
	copyToClipboard,
	formatRelativeTime,
	isValidHttpUrl,
	safeParseInt,
} from '../lib/utils.js';

// State
let currentTab = 'myPRs';
let prData = { myPRs: [], reviewRequests: [], lastFetched: null };
let settings = {};

// DOM Elements
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const refreshBtn = document.getElementById('refresh-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const settingsBtn = document.getElementById('settings-btn');
const tabs = document.querySelectorAll('.tab');
const myPRsCount = document.getElementById('my-prs-count');
const reviewCount = document.getElementById('review-count');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const setupState = document.getElementById('setup-state');
const prList = document.getElementById('pr-list');
const lastUpdated = document.getElementById('last-updated');
const prCardTemplate = document.getElementById('pr-card-template');
const emptyMessage = document.getElementById('empty-message');
const openSetupBtn = document.getElementById('open-setup-btn');
const toast = document.getElementById('toast');

// Track fullpage mode for navigation behavior
let isFullpageMode = false;

/**
 * Safely open a URL in a new tab
 * Only allows http/https protocols to prevent XSS attacks
 * @param {string} url - URL to open
 */
function safeOpenUrl(url) {
	if (isValidHttpUrl(url)) {
		chrome.tabs.create({ url });
	} else {
		console.warn('Blocked attempt to open invalid URL:', url);
	}
}

/**
 * Initialize the popup
 */
async function init() {
	// Always set up event listeners first so buttons work even before onboarding
	setupEventListeners();

	// Load settings (may be empty/null before onboarding)
	settings = await storage.getSettings() || {};

	// Check if we're in fullpage mode (set global for navigation behavior)
	isFullpageMode = new URLSearchParams(window.location.search).has('fullpage');

	// If displayMode is fullpage and not already in fullpage mode, redirect
	if (settings.displayMode === 'fullpage' && !isFullpageMode) {
		chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?fullpage=1') });
		window.close();
		return;
	}

	// Add fullpage class to body if in fullpage mode
	if (isFullpageMode) {
		document.body.classList.add('fullpage-mode');
	}

	// Load provider info - Check if connected (provider with user)
	const provider = await storage.getProvider();
	const isOnboarded = !!(provider && provider.user && provider.token);

	if (!isOnboarded) {
		showSetupState();
		return;
	}

	// Load user info into header - replace emoji with actual avatar
	if (provider.user) {
		// Create an img element to replace the emoji span
		const img = document.createElement('img');
		img.src = provider.user.avatarUrl;
		img.alt = 'Avatar';
		img.className = 'avatar avatar-img';
		img.id = 'user-avatar';
		userAvatar.replaceWith(img);
		userName.textContent = provider.user.name || provider.user.login;

		// Make user section clickable to open GitHub profile
		const userSection = document.querySelector('.user-section');
		userSection.style.cursor = 'pointer';
		userSection.title = 'Open GitHub profile';
		userSection.addEventListener('click', () => {
			chrome.tabs.create({ url: `https://github.com/${provider.user.login}` });
		});
	}

	// Set initial tab based on settings
	currentTab = settings.pinnedTab || 'myPRs';
	updateActiveTab();

	// Load PR data
	await loadPRData();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
	// Refresh button
	refreshBtn.addEventListener('click', refreshPRs);

	// Fullscreen button - open in full page mode
	fullscreenBtn.addEventListener('click', () => {
		chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?fullpage=1') });
	});

	// Settings button
	settingsBtn.addEventListener('click', openSettings);

	// Tab switching
	tabs.forEach(tab => {
		tab.addEventListener('click', async () => {
			currentTab = tab.dataset.tab;
			updateActiveTab();

			// Check if onboarded before rendering
			const provider = await storage.getProvider();
			const isOnboarded = !!(provider && provider.user && provider.token);
			if (!isOnboarded) {
				showSetupState();
			} else {
				renderPRList();
			}
		});
	});

	// Open setup button (for when not onboarded - should go to onboarding)
	openSetupBtn.addEventListener('click', () => {
		if (isFullpageMode) {
			window.location.href = chrome.runtime.getURL('onboarding/onboarding.html');
		} else {
			chrome.tabs.create({ url: 'onboarding/onboarding.html' });
		}
	});
}

/**
 * Load PR data from storage
 */
async function loadPRData() {
	showLoading();

	try {
		prData = await storage.getPullRequests();

		// Update counts
		myPRsCount.textContent = prData.myPRs?.length || 0;
		reviewCount.textContent = prData.reviewRequests?.length || 0;

		// Update last fetched
		if (prData.lastFetched) {
			lastUpdated.textContent = `Updated ${formatRelativeTime(prData.lastFetched)}`;
		}

		renderPRList();
	} catch (error) {
		console.error('Failed to load PR data:', error);
		showEmptyState('Failed to load pull requests');
	}
}

/**
 * Refresh PRs from GitHub
 */
async function refreshPRs() {
	// Check if authenticated first
	const provider = await storage.getProvider();
	const isOnboarded = !!(provider && provider.user && provider.token);

	if (!isOnboarded) {
		showToast('Setup required - please connect your GitHub account', 'warning');
		return;
	}

	refreshBtn.classList.add('spinning');

	try {
		await chrome.runtime.sendMessage({ type: 'REFRESH_PRS' });
		await loadPRData();
	} catch (error) {
		console.error('Failed to refresh PRs:', error);
		showToast('Failed to refresh PRs', 'error');
	} finally {
		refreshBtn.classList.remove('spinning');
	}
}

/**
 * Open settings page - in fullscreen mode, navigate in same tab
 */
function openSettings() {
	if (isFullpageMode) {
		window.location.href = chrome.runtime.getURL('settings/settings.html');
	} else {
		chrome.tabs.create({ url: 'settings/settings.html' });
	}
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
	toast.textContent = message;
	toast.className = 'toast visible';
	if (type) {
		toast.classList.add(`toast-${type}`);
	}

	setTimeout(() => {
		toast.classList.remove('visible');
	}, 3000);
}

/**
 * Update active tab styling
 */
function updateActiveTab() {
	tabs.forEach(tab => {
		tab.classList.toggle('active', tab.dataset.tab === currentTab);
	});
}

/**
 * Show loading state
 */
function showLoading() {
	loadingState.classList.remove('hidden');
	emptyState.classList.add('hidden');
	setupState.classList.add('hidden');
	prList.classList.add('hidden');
}

/**
 * Show empty state
 */
function showEmptyState(message) {
	loadingState.classList.add('hidden');
	emptyState.classList.remove('hidden');
	setupState.classList.add('hidden');
	prList.classList.add('hidden');

	if (message) {
		emptyMessage.textContent = message;
	} else {
		emptyMessage.textContent = currentTab === 'myPRs'
			? "You don't have any open PRs"
			: "No PRs awaiting your review";
	}
}

/**
 * Show setup required state
 */
function showSetupState() {
	loadingState.classList.add('hidden');
	emptyState.classList.add('hidden');
	setupState.classList.remove('hidden');
	prList.classList.add('hidden');
}

/**
 * Render the PR list
 */
function renderPRList() {
	const prs = currentTab === 'myPRs' ? prData.myPRs : prData.reviewRequests;

	if (!prs || prs.length === 0) {
		showEmptyState();
		return;
	}

	// Hide states, show list
	loadingState.classList.add('hidden');
	emptyState.classList.add('hidden');
	setupState.classList.add('hidden');
	prList.classList.remove('hidden');

	// Clear existing cards
	prList.innerHTML = '';

	// Render cards
	prs.forEach(pr => {
		const card = createPRCard(pr);
		prList.appendChild(card);
	});
}

/**
 * Create a PR card element
 */
function createPRCard(pr) {
	const template = prCardTemplate.content.cloneNode(true);
	const card = template.querySelector('.pr-card');

	// Set data attribute for click handling
	card.dataset.url = pr.url;

	// Title
	card.querySelector('.pr-title').textContent = pr.title;

	// Author - clickable with tooltip
	const authorAvatar = card.querySelector('.pr-author-avatar');
	const authorName = card.querySelector('.pr-author');
	authorAvatar.src = pr.author?.avatarUrl || '';
	authorName.textContent = pr.author?.login || 'Unknown';

	// Add tooltip showing full name on hover
	const authorFullName = pr.author?.name || pr.author?.login || 'Unknown';
	authorAvatar.title = authorFullName;
	authorName.title = authorFullName;

	// Click on author avatar or name to open their GitHub profile
	const authorProfileUrl = `https://github.com/${pr.author?.login}`;
	authorAvatar.classList.add('clickable');
	authorName.classList.add('clickable');
	authorAvatar.addEventListener('click', (e) => {
		e.stopPropagation();
		safeOpenUrl(authorProfileUrl);
	});
	authorName.addEventListener('click', (e) => {
		e.stopPropagation();
		safeOpenUrl(authorProfileUrl);
	});

	// Repo - clickable to open repo
	const repoEl = card.querySelector('.pr-repo');
	repoEl.textContent = pr.repoFullName || '';
	repoEl.classList.add('clickable');
	repoEl.addEventListener('click', (e) => {
		e.stopPropagation();
		safeOpenUrl(`https://github.com/${pr.repoFullName}`);
	});

	// Changes - clickable to open files changed tab
	const changesEl = card.querySelector('.pr-changes');
	const filesEl = card.querySelector('.pr-files');
	if (pr.changes) {
		// Use safe DOM manipulation instead of innerHTML to prevent XSS
		changesEl.textContent = '';
		const additionsSpan = document.createElement('span');
		additionsSpan.className = 'additions';
		additionsSpan.textContent = `+${safeParseInt(pr.changes.additions, 0)}`;
		const deletionsSpan = document.createElement('span');
		deletionsSpan.className = 'deletions';
		deletionsSpan.textContent = `-${safeParseInt(pr.changes.deletions, 0)}`;
		changesEl.appendChild(additionsSpan);
		changesEl.appendChild(document.createTextNode(' '));
		changesEl.appendChild(deletionsSpan);
	}
	filesEl.textContent = `${safeParseInt(pr.changes?.filesChanged, 0)} files`;

	// Wrap changes and files in a clickable group that opens /files tab
	const filesChangedUrl = `${pr.url}/changes`;
	changesEl.classList.add('clickable');
	filesEl.classList.add('clickable');
	changesEl.title = 'View file changes';
	filesEl.title = 'View file changes';
	changesEl.addEventListener('click', (e) => {
		e.stopPropagation();
		safeOpenUrl(filesChangedUrl);
	});
	filesEl.addEventListener('click', (e) => {
		e.stopPropagation();
		safeOpenUrl(filesChangedUrl);
	});

	// Checks status
	const checksDisplay = getCheckStatusDisplay(pr.checks?.status);
	const checksEl = card.querySelector('.pr-checks');
	checksEl.classList.add(checksDisplay.className);
	checksEl.querySelector('.check-icon').textContent = checksDisplay.icon;
	checksEl.querySelector('.check-label').textContent = checksDisplay.label;

	// Review status
	const reviewDisplay = getReviewStatusDisplay(pr.reviews?.status);
	const reviewEl = card.querySelector('.pr-review');
	reviewEl.classList.add(reviewDisplay.className);
	reviewEl.querySelector('.review-icon').textContent = reviewDisplay.icon;
	reviewEl.querySelector('.review-label').textContent = reviewDisplay.label;

	// Status dot - combined checks/review indicator
	// Green = approved AND checks passing (or no checks / unknown)
	// Yellow = one condition not met
	// Red = both conditions not met
	const statusDot = card.querySelector('.pr-status-dot');
	const checksStatus = pr.checks?.status;
	const checksOk = !checksStatus || checksStatus === 'success' || checksStatus === 'neutral' || checksStatus === 'unknown';
	const reviewOk = pr.reviews?.status === 'approved';

	if (checksOk && reviewOk) {
		statusDot.classList.add('status-green');
	} else if (!checksOk && !reviewOk) {
		statusDot.classList.add('status-red');
	} else {
		statusDot.classList.add('status-yellow');
	}

	// Jira link
	const jiraTicket = extractJiraTicket(pr.branchName);
	const jiraLink = card.querySelector('.jira-link');

	if (jiraTicket && settings.jiraBaseUrl) {
		const jiraUrl = getJiraUrl(jiraTicket, settings.jiraBaseUrl);
		
		// Only show Jira link if the URL is valid
		if (isValidHttpUrl(jiraUrl)) {
			jiraLink.classList.remove('hidden');

			// Show separator if it exists
			const jiraSeparator = card.querySelector('.separator-jira');
			if (jiraSeparator) jiraSeparator.classList.remove('hidden');

			jiraLink.querySelector('.action-label').textContent = jiraTicket;
			jiraLink.href = jiraUrl;

			jiraLink.addEventListener('click', (e) => {
				e.stopPropagation();
				// Default behavior allows opening in new tab
			});
		}
	}

	// Copy button - handling SVG icon swap
	const copyBtn = card.querySelector('.copy-btn');
	const copyIcon = copyBtn.querySelector('.action-icon');
	const originalIconContent = copyIcon.innerHTML;
	const checkmarkIconContent = '<polyline points="20 6 9 17 4 12"></polyline>';

	copyBtn.addEventListener('click', async (e) => {
		e.stopPropagation();
		await copyToClipboard(pr.url);

		copyBtn.classList.add('copied');
		copyBtn.title = 'Copied!';
		copyIcon.innerHTML = checkmarkIconContent;

		setTimeout(() => {
			copyBtn.classList.remove('copied');
			copyBtn.title = 'Copy PR Link';
			copyIcon.innerHTML = originalIconContent;
		}, 2000);
	});

	// Title click - open PR in new tab
	const titleEl = card.querySelector('.pr-title');
	titleEl.addEventListener('click', () => {
		safeOpenUrl(pr.url);
	});

	// Card click removed - interaction now cleaner
	// card.addEventListener('click', () => {
	// 	chrome.tabs.create({ url: pr.url });
	// });

	return card;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
