<script lang="ts">
	import { onMount } from 'svelte';
	import { storage } from '../../lib/storage';
	import { DEFAULT_SETTINGS } from '../../lib/ui-config';
	import type { PullRequestData, Settings, StoredProviderConfig } from '../../lib/types';
	import { isValidHttpUrl, isValidTokenFormat, sanitizeJiraUrl } from '../../lib/utils';
	import GithubStep from './steps/GithubStep.svelte';
	import DefaultViewStep from './steps/DefaultViewStep.svelte';
	import JiraStep from './steps/JiraStep.svelte';
	import DisplayStep from './steps/DisplayStep.svelte';
	import CompleteStep from './steps/CompleteStep.svelte';
	import AttributionFooter from '../lib/components/AttributionFooter.svelte';

	const STEP_GITHUB = 1;
	const STEP_DEFAULT_VIEW = 2;
	const STEP_JIRA = 3;
	const STEP_DISPLAY = 4;
	const STEP_COMPLETE = 5;
	type OnboardingSettings = Pick<Settings, 'pinnedTab' | 'jiraBaseUrl' | 'displayMode'>;
	type OnboardingSessionState = {
		currentStep?: number;
		providerData?: StoredProviderConfig | null;
		settings?: Partial<OnboardingSettings>;
		token?: string;
	};

	const steps = [
		{ id: STEP_GITHUB, label: 'GitHub' },
		{ id: STEP_DEFAULT_VIEW, label: 'Default view' },
		{ id: STEP_JIRA, label: 'Jira' },
		{ id: STEP_DISPLAY, label: 'Display' },
	];

	let currentStep = $state<number>(STEP_GITHUB);
	let providerData = $state<StoredProviderConfig | null>(null);
	let settings = $state<OnboardingSettings>({
		pinnedTab: DEFAULT_SETTINGS.pinnedTab,
		jiraBaseUrl: DEFAULT_SETTINGS.jiraBaseUrl,
		displayMode: DEFAULT_SETTINGS.displayMode,
	});
	let token = $state('');
	let tokenVisible = $state(false);
	let testingConnection = $state(false);
	let errorMessage = $state('');
	let completingSetup = $state(false);
	let onboardingStateReady = $state(false);
	let syncedPrCount = $state(0);

	onMount(() => {
		const saved = sessionStorage.getItem('prPulseOnboarding');
		if (saved) {
			try {
				const state = JSON.parse(saved) as OnboardingSessionState;
				if (state.settings) settings = { ...settings, ...state.settings };
				if (state.token) token = state.token;
				if (state.providerData) providerData = state.providerData;
				if (state.currentStep) currentStep = Math.min(STEP_COMPLETE, Math.max(STEP_GITHUB, state.currentStep));
			} catch {
				// ignore invalid state
			}
		}
		onboardingStateReady = true;
	});

	$effect(() => {
		if (onboardingStateReady) {
			sessionStorage.setItem('prPulseOnboarding', JSON.stringify({ currentStep, providerData, settings, token }));
		}
	});

	async function testConnection() {
		errorMessage = '';
		const normalizedToken = token.trim();

		if (!normalizedToken) {
			errorMessage = 'Please enter a personal access token.';
			return;
		}

		if (!isValidTokenFormat(normalizedToken)) {
			errorMessage = 'Invalid token format. Use a valid GitHub personal access token.';
			return;
		}

		testingConnection = true;
		try {
			const { GitHubProvider } = await import('../../lib/providers/github-provider');
			const provider = new GitHubProvider({ token: normalizedToken });
			const user = await provider.authenticate();
			providerData = {
				type: 'github',
				token: normalizedToken,
				baseUrl: 'https://api.github.com',
				user,
			};
		} catch (error) {
			console.error('Failed to authenticate token:', error);
			errorMessage = error instanceof Error ? error.message : 'Failed to connect. Check your token and try again.';
		} finally {
			testingConnection = false;
		}
	}

	function nextStep() {
		if (currentStep === STEP_JIRA && settings.jiraBaseUrl && !isValidHttpUrl(settings.jiraBaseUrl)) {
			errorMessage = 'Please enter a valid Jira URL or leave the field empty.';
			return;
		}

		errorMessage = '';
		currentStep = Math.min(STEP_DISPLAY, currentStep + 1);
	}

	function prevStep() {
		errorMessage = '';
		currentStep = Math.max(STEP_GITHUB, currentStep - 1);
	}

	function updateJiraUrl(value: string) {
		settings = {
			...settings,
			jiraBaseUrl: sanitizeJiraUrl(value.trim()),
		};
	}

	async function completeSetup() {
		if (!providerData) {
			errorMessage = 'Connect your GitHub account first.';
			currentStep = STEP_GITHUB;
			return;
		}

		completingSetup = true;
		errorMessage = '';

		try {
			await storage.setProvider(providerData);
			await storage.setSettings(settings);

			// Listen for the PR data write triggered by the service worker
			const prSyncPromise = new Promise<number>((resolve) => {
				function onChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
					if (areaName !== 'local' || !changes.pullRequests?.newValue) return;
					chrome.storage.onChanged.removeListener(onChanged);
					const data = changes.pullRequests.newValue as PullRequestData;
					resolve((data.myPRs?.length || 0) + (data.reviewRequests?.length || 0));
				}
				chrome.storage.onChanged.addListener(onChanged);
				// Timeout fallback in case no PRs are fetched
				setTimeout(() => {
					chrome.storage.onChanged.removeListener(onChanged);
					resolve(0);
				}, 15000);
			});

			await chrome.runtime.sendMessage({ type: 'PROVIDER_CONFIGURED' });
			syncedPrCount = await prSyncPromise;
			currentStep = STEP_COMPLETE;
		} catch (error) {
			console.error('Setup failed:', error);
			errorMessage = 'Failed to complete setup. Please try again.';
		} finally {
			completingSetup = false;
		}
	}

	function closeSetup() {
		sessionStorage.removeItem('prPulseOnboarding');

		if (settings.displayMode === 'fullpage') {
			window.location.href = chrome.runtime.getURL('popup/popup.html?fullpage=1');
			return;
		}

		window.close();
	}
</script>

<div class="min-h-screen px-5 py-6 sm:px-6">
	{#if !onboardingStateReady}
		<div class="page-shell mx-auto flex flex-col gap-4">
			<div class="surface-card p-6">
				<div class="space-y-2">
					<div class="text-xs font-semibold uppercase tracking-[0.24em] text-(--accent)">Setup</div>
					<h1 class="text-3xl font-semibold text-white">Configure PR Pulse</h1>
					<p class="text-sm leading-[1.2rem] text-soft">Restoring your onboarding progress...</p>
				</div>
			</div>
		</div>
	{:else}
	<div class="page-shell mx-auto flex flex-col gap-4">
		<div class="surface-card p-6">
			<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
				<div class="max-w-xl space-y-2">
					<div class="text-xs font-semibold uppercase tracking-[0.24em] text-(--accent)">Setup</div>
					<h1 class="text-3xl font-semibold text-white">Configure PR Pulse</h1>
					<p class="text-sm leading-[1.2rem] text-soft">Connect GitHub, choose your default view, and optionally enable Jira ticket links.</p>
				</div>
				<div class="rounded-lg border border-soft bg-(--bg-muted) px-4 py-3 text-sm text-soft">
					{currentStep === STEP_COMPLETE ? 'Setup complete' : `Step ${Math.min(currentStep, STEP_DISPLAY)} of ${STEP_DISPLAY}`}
				</div>
			</div>

			{#if currentStep !== STEP_COMPLETE}
				<div class="mt-6 grid gap-3 sm:grid-cols-4">
					{#each steps as step (step.id)}
						<div class={`rounded-lg border px-4 py-3 text-sm transition ${currentStep === step.id ? 'border-(--accent) bg-(--accent-muted) text-white' : currentStep > step.id ? 'border-(--accent-border) bg-[rgba(55,148,255,0.08)] text-soft' : 'border-soft bg-(--bg-panel) text-dim'}`}>
							<div class="text-[11px] font-semibold uppercase tracking-[0.18em]">{step.id}</div>
							<div class="mt-1 font-medium">{step.label}</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if errorMessage}
			<div class="danger-surface rounded-lg border px-4 py-3 text-sm text-(--danger)">
				{errorMessage}
			</div>
		{/if}

		{#if currentStep === STEP_GITHUB}
			<GithubStep
				{token}
				{tokenVisible}
				{testingConnection}
				{providerData}
				onTestConnection={testConnection}
				onNext={nextStep}
				onTokenChange={(val) => token = val}
				onToggleTokenVisible={() => tokenVisible = !tokenVisible}
			/>
		{:else if currentStep === STEP_DEFAULT_VIEW}
			<DefaultViewStep
				pinnedTab={settings.pinnedTab}
				onPinnedTabChange={(val) => settings = { ...settings, pinnedTab: val }}
				onNext={nextStep}
				onBack={prevStep}
			/>
		{:else if currentStep === STEP_JIRA}
			<JiraStep
				jiraBaseUrl={settings.jiraBaseUrl}
				onJiraUrlChange={updateJiraUrl}
				onNext={nextStep}
				onBack={prevStep}
			/>
		{:else if currentStep === STEP_DISPLAY}
			<DisplayStep
				displayMode={settings.displayMode}
				{completingSetup}
				onDisplayModeChange={(val) => settings = { ...settings, displayMode: val }}
				onComplete={completeSetup}
				onBack={prevStep}
			/>
		{:else}
			<CompleteStep
				displayMode={settings.displayMode}
				{syncedPrCount}
				onClose={closeSetup}
			/>
		{/if}

		<AttributionFooter />
	</div>
	{/if}
</div>