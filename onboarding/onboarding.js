/**
 * PR Pulse - Onboarding Script
 * Handles the multi-step setup wizard
 */

import { storage } from '../lib/storage.js';
import { GitHubProvider } from '../lib/providers/github-provider.js';
import { sanitizeJiraUrl, isValidHttpUrl } from '../lib/utils.js';

// State
let currentStep = 1;
let providerData = null;
let settings = {
	pinnedTab: 'myPRs',
	jiraBaseUrl: '',
	displayMode: 'popup',
};

// DOM Elements
const steps = document.querySelectorAll('.step-content');
const progressSteps = document.querySelectorAll('.progress-step');

// Step 1 Elements
const patInput = document.getElementById('pat-input');
const togglePatBtn = document.getElementById('toggle-pat');
const testConnectionBtn = document.getElementById('test-connection');
const connectionStatus = document.getElementById('connection-status');
const errorMessage = document.getElementById('error-message');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userLogin = document.getElementById('user-login');

// Step 2 Elements
const pinnedTabRadios = document.querySelectorAll('input[name="pinnedTab"]');

// Step 3 Elements
const jiraUrlInput = document.getElementById('jira-url');
const jiraPreviewLink = document.getElementById('jira-preview-link');

// Step 4 Elements
const displayModeRadios = document.querySelectorAll('input[name="displayMode"]');

// Complete Button
const completeSetupBtn = document.getElementById('complete-setup');
const closeSetupBtn = document.getElementById('close-setup');

/**
 * Initialize the onboarding wizard
 */
function init() {
	// Check if already onboarded
	checkExistingSetup();

	// Step 1: PAT input
	togglePatBtn.addEventListener('click', togglePatVisibility);
	testConnectionBtn.addEventListener('click', testConnection);
	patInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') testConnection();
	});

	// Step 2: Pinned tab selection
	pinnedTabRadios.forEach(radio => {
		radio.addEventListener('change', handleRadioChange);
	});

	// Step 3: Jira URL
	jiraUrlInput.addEventListener('input', updateJiraPreview);

	// Step 4: Display mode
	displayModeRadios.forEach(radio => {
		radio.addEventListener('change', handleRadioChange);
	});

	// Navigation buttons
	document.querySelectorAll('.next-step').forEach(btn => {
		btn.addEventListener('click', nextStep);
	});
	document.querySelectorAll('.prev-step').forEach(btn => {
		btn.addEventListener('click', prevStep);
	});

	// Complete setup
	completeSetupBtn.addEventListener('click', completeSetup);
	closeSetupBtn.addEventListener('click', () => window.close());
}

/**
 * Check if user has already completed setup
 */
async function checkExistingSetup() {
	const isComplete = await storage.isOnboardingComplete();
	const existingProvider = await storage.getProvider();

	if (isComplete && existingProvider) {
		// Show settings mode? Or just close?
		// For now, allow re-configuration
	}
}

/**
 * Toggle PAT visibility
 */
function togglePatVisibility() {
	const type = patInput.type === 'password' ? 'text' : 'password';
	patInput.type = type;
	togglePatBtn.textContent = type === 'password' ? '👁️' : '🔒';
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
 * Test GitHub connection with provided PAT
 */
async function testConnection() {
	const token = patInput.value.trim();

	if (!token) {
		showError('Please enter a Personal Access Token');
		return;
	}

	// Strict token format validation
	if (!isValidTokenFormat(token)) {
		showError('Invalid token format. Token should be a valid GitHub Personal Access Token (ghp_... or github_pat_...)');
		return;
	}

	// Show loading state
	testConnectionBtn.classList.add('loading');
	testConnectionBtn.disabled = true;
	hideError();
	connectionStatus.classList.add('hidden');

	try {
		const provider = new GitHubProvider({ token });
		const user = await provider.authenticate();

		// Store provider data for later
		providerData = {
			type: 'github',
			token,
			baseUrl: 'https://api.github.com',
			user,
		};

		// Show success
		userAvatar.src = user.avatarUrl;
		userName.textContent = user.name;
		userLogin.textContent = `@${user.login}`;
		connectionStatus.classList.remove('hidden');

		// Change button to continue
		testConnectionBtn.textContent = 'Continue';
		testConnectionBtn.classList.remove('loading');
		testConnectionBtn.disabled = false;
		testConnectionBtn.onclick = nextStep;

	} catch (error) {
		showError(error.message || 'Failed to connect. Please check your token.');
		testConnectionBtn.classList.remove('loading');
		testConnectionBtn.disabled = false;
	}
}

/**
 * Show error message
 */
function showError(message) {
	errorMessage.textContent = message;
	errorMessage.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
	errorMessage.classList.add('hidden');
}

/**
 * Handle radio card selection
 */
function handleRadioChange(e) {
	const name = e.target.name;
	const value = e.target.value;

	// Update visual state
	document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
		radio.closest('.radio-card').classList.toggle('selected', radio.checked);
	});

	// Update settings
	if (name === 'pinnedTab') {
		settings.pinnedTab = value;
	} else if (name === 'displayMode') {
		settings.displayMode = value;
	}
}

/**
 * Update Jira preview link
 */
function updateJiraPreview() {
	const rawUrl = jiraUrlInput.value.trim();
	// Sanitize the URL to extract base browse URL
	const sanitizedUrl = sanitizeJiraUrl(rawUrl);
	
	// Only store the sanitized URL for security
	settings.jiraBaseUrl = sanitizedUrl;

	if (sanitizedUrl && isValidHttpUrl(sanitizedUrl)) {
		const previewUrl = `${sanitizedUrl}/browse/JIRA-1234`;
		jiraPreviewLink.href = previewUrl;
		jiraPreviewLink.textContent = 'JIRA-1234';
	} else {
		jiraPreviewLink.href = '#';
		jiraPreviewLink.textContent = 'No Jira configured';
	}
}

/**
 * Go to next step
 */
function nextStep() {
	if (currentStep < 4) {
		goToStep(currentStep + 1);
	}
}

/**
 * Go to previous step
 */
function prevStep() {
	if (currentStep > 1) {
		goToStep(currentStep - 1);
	}
}

/**
 * Navigate to specific step
 */
function goToStep(step) {
	// Hide current step
	steps.forEach(s => s.classList.remove('active'));
	progressSteps.forEach(s => {
		s.classList.remove('active');
		if (parseInt(s.dataset.step) < step) {
			s.classList.add('completed');
		} else {
			s.classList.remove('completed');
		}
	});

	// Show new step
	currentStep = step;
	document.getElementById(`step-${step}`).classList.add('active');
	document.querySelector(`.progress-step[data-step="${step}"]`).classList.add('active');
}

/**
 * Complete the setup
 */
async function completeSetup() {
	completeSetupBtn.classList.add('loading');
	completeSetupBtn.disabled = true;

	try {
		// Save provider configuration
		await storage.setProvider(providerData);

		// Save settings
		await storage.setSettings(settings);

		// Mark onboarding as complete
		await storage.setOnboardingComplete(true);

		// Notify service worker to start polling
		await chrome.runtime.sendMessage({ type: 'PROVIDER_CONFIGURED' });

		// Show success screen
		steps.forEach(s => s.classList.remove('active'));
		progressSteps.forEach(s => s.classList.add('completed'));
		document.getElementById('step-complete').classList.add('active');

	} catch (error) {
		console.error('Setup failed:', error);
		showError('Failed to complete setup. Please try again.');
		completeSetupBtn.classList.remove('loading');
		completeSetupBtn.disabled = false;
	}
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
