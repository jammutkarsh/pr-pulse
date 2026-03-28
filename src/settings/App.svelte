<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, CheckCircle2, ChevronDown, Clock3, MonitorCog, Pin, ListFilter, ShieldAlert, Ticket, UserRound, Sparkles } from 'lucide-svelte';
	import Button from '../lib/components/Button.svelte';
	import RadioCard from '../lib/components/RadioCard.svelte';
	import SectionCard from '../lib/components/SectionCard.svelte';
	import InteractiveGuide from '../lib/components/InteractiveGuide.svelte';
	import AttributionFooter from '../lib/components/AttributionFooter.svelte';
	import { storage } from '../../lib/storage';
	import type { Settings, StoredProviderConfig } from '../../lib/types';
	import { isValidHttpUrl, isValidTokenFormat, sanitizeJiraUrl } from '../../lib/utils';
	import { DEFAULT_SETTINGS } from '../../lib/ui-config';

	const pollingOptions = [
		{ value: 60000, label: '1 minute' },
		{ value: 300000, label: '5 minutes' },
		{ value: 600000, label: '10 minutes' },
		{ value: 900000, label: '15 minutes' },
		{ value: 1800000, label: '30 minutes' },
		{ value: 3600000, label: '60 minutes' },
	];

	let provider = $state<StoredProviderConfig | undefined>(undefined);
	let currentSettings = $state<Settings>(DEFAULT_SETTINGS);
	let jiraUrl = $state('');
	let pollingIntervalMs = $state(600000);
	let token = $state('');
	let tokenError = $state('');
	let tokenSuccess = $state('');
	let reconnecting = $state(false);
	let validatingToken = $state(false);
	let saveVisible = $state(false);
	let saveTimeoutId: ReturnType<typeof setTimeout> | undefined;

	let isConnected = $derived(!!(provider && provider.user && !reconnecting));
	let jiraDashboardUrl = $derived(jiraUrl && isValidHttpUrl(jiraUrl) ? `${jiraUrl}/jira/for-you` : '');

	onMount(() => {
		void init();
	});

	async function init() {
		const [nextSettings, nextProvider] = await Promise.all([storage.getSettings(), storage.getProvider()]);
		currentSettings = nextSettings;
		provider = nextProvider;
		jiraUrl = sanitizeJiraUrl(currentSettings.jiraBaseUrl || '');
		pollingIntervalMs = currentSettings.pollingIntervalMs || 600000;
	}

	function flashSaved() {
		saveVisible = true;
		clearTimeout(saveTimeoutId);
		saveTimeoutId = setTimeout(() => {
			saveVisible = false;
		}, 2000);
	}

	async function updateSetting<K extends keyof Settings>(name: K, value: Settings[K]) {
		currentSettings = { ...currentSettings, [name]: value };
		await storage.updateSetting(name, value);
		flashSaved();
	}

	async function updatePinnedTab(value: Settings['pinnedTab']) {
		await updateSetting('pinnedTab', value);
		await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: { pinnedTab: value } });
	}

	async function updateDisplayMode(value: Settings['displayMode']) {
		await updateSetting('displayMode', value);
	}

	async function updatePollingInterval(event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}

		const value = Number.parseInt(target.value, 10);
		if (!Number.isFinite(value)) {
			return;
		}

		pollingIntervalMs = value;
		await updateSetting('pollingIntervalMs', value);
		await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { pollingIntervalMs: value } });
	}

	async function saveJiraUrl() {
		const sanitized = sanitizeJiraUrl(jiraUrl.trim());
		jiraUrl = sanitized;
		await updateSetting('jiraBaseUrl', sanitized);
	}

	async function validateAndSaveToken() {
		tokenError = '';
		tokenSuccess = '';

		if (!token.trim()) {
			tokenError = 'Please enter a token';
			return;
		}

		if (!isValidTokenFormat(token.trim())) {
			tokenError = 'Invalid token format. Use a valid GitHub personal access token.';
			return;
		}

		validatingToken = true;

		try {
			const { GitHubProvider } = await import('../../lib/providers/github-provider');
			const github = new GitHubProvider({ token: token.trim() });
			const user = await github.getUser();
			provider = {
				type: 'github',
				token: token.trim(),
				baseUrl: 'https://api.github.com',
				user,
			};

			await storage.setProvider(provider);
			await chrome.runtime.sendMessage({ type: 'PROVIDER_CONFIGURED' });
			tokenSuccess = `Connected as ${user.name || user.login}`;
			reconnecting = false;
			token = '';
			flashSaved();
		} catch (error) {
			console.error('Token validation failed:', error);
			tokenError = `Failed: ${error instanceof Error ? error.message : 'Token validation failed.'}`;
		} finally {
			validatingToken = false;
		}
	}

	function goBack() {
		window.location.href = chrome.runtime.getURL('popup/popup.html?fullpage=1');
	}

	async function resetAll() {
		if (!confirm('This will clear all settings and cached data. Continue?')) {
			return;
		}

		await storage.clearAll();
		await chrome.runtime.sendMessage({ type: 'CLEAR_ALL' });
		window.location.href = chrome.runtime.getURL('onboarding/onboarding.html');
	}
</script>

<div class="min-h-screen px-5 py-6 sm:px-6">
	<div class="page-shell mx-auto flex flex-col gap-4">
		<div class="flex items-center justify-between gap-3">
			<Button variant="ghost" onclick={goBack}>
				<ArrowLeft class="h-4 w-4" />
				Back to PR Pulse
			</Button>
			{#if saveVisible}
				<div class="accent-surface flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-(--accent)">
					<CheckCircle2 class="h-3.5 w-3.5" />
					Settings saved
				</div>
			{/if}
		</div>

		<div class="surface-card p-6">
			<div class="max-w-xl space-y-2">
				<div class="text-xs font-semibold uppercase tracking-[0.24em] text-(--accent)">Settings</div>
				<h1 class="text-3xl font-semibold text-white">PR Pulse settings</h1>
				<p class="text-sm leading-[1.2rem] text-soft">Manage the GitHub connection, refresh interval, Jira linking, and the default extension view.</p>
			</div>
		</div>

		<SectionCard>
			<div class="mb-4 flex items-center gap-3">
				<div class="accent-surface rounded-lg border p-3 text-(--accent)">
					<UserRound class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-base font-semibold text-white">GitHub account</h2>
					<p class="text-sm text-soft">Manage the token used by the background sync and popup.</p>
				</div>
			</div>

			{#if isConnected}
				<div class="rounded-[20px] border border-soft bg-black/20 p-4">
					<div class="flex items-center gap-3">
						<img src={provider.user.avatarUrl} alt="Avatar" class="h-11 w-11 rounded-2xl border border-soft object-cover" />
						<div>
							<div class="text-sm font-semibold text-white">{provider.user.name || provider.user.login}</div>
							<div class="text-xs text-soft">@{provider.user.login}</div>
						</div>
					</div>
					<div class="mt-4">
						<Button variant="secondary" onclick={() => reconnecting = true}>Reconnect with a different token</Button>
					</div>
				</div>
			{:else}
				<div class="space-y-3">
					<input class="field-input" type="password" bind:value={token} placeholder="ghp_xxxxxxxxxxxxx" autocomplete="off" />
					<p class="text-sm text-soft">Enter a GitHub personal access token with repository access.</p>
					<div class="flex flex-wrap gap-3">
						<Button onclick={validateAndSaveToken} disabled={validatingToken}>
							{validatingToken ? 'Validating...' : 'Connect'}
						</Button>
						{#if provider?.user}
							<Button variant="secondary" onclick={() => reconnecting = false}>Cancel</Button>
						{/if}
					</div>
					{#if tokenError}
						<p class="text-sm text-(--danger)">{tokenError}</p>
					{/if}
					{#if tokenSuccess}
						<p class="text-sm text-(--accent)">{tokenSuccess}</p>
					{/if}
				</div>
			{/if}
		</SectionCard>

		<SectionCard>
			<div class="mb-4 flex items-center gap-3">
				<div class="rounded-2xl bg-white/6 p-3 text-white">
					<Pin class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-base font-semibold text-white">Default view</h2>
					<p class="text-sm text-soft">Choose the tab the popup opens to by default.</p>
				</div>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<RadioCard name="pinnedTab" value="myPRs" currentValue={currentSettings.pinnedTab || 'myPRs'} title="My PRs" description="Track the pull requests you created and keep an eye on CI and review status." icon="📤" onchange={updatePinnedTab} />
				<RadioCard name="pinnedTab" value="toReview" currentValue={currentSettings.pinnedTab || 'myPRs'} title="To Review" description="Focus the popup on pull requests that need your attention as a reviewer." icon="📥" onchange={updatePinnedTab} />
			</div>
		</SectionCard>

		<SectionCard>
			<div class="mb-4 flex items-center gap-3">
				<div class="rounded-2xl bg-white/6 p-3 text-white">
					<Ticket class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-base font-semibold text-white">Jira integration</h2>
					<p class="text-sm text-soft">Store only the Jira origin and derive ticket links from branch names.</p>
				</div>
			</div>
			<div class="space-y-3">
				<input class="field-input" type="url" bind:value={jiraUrl} placeholder="https://company.atlassian.net/browse/PROJ-123" onblur={saveJiraUrl} />
				{#if jiraDashboardUrl}
					<p class="text-sm text-soft">Dashboard preview: <a class="text-(--accent) underline" href={jiraDashboardUrl} target="_blank" rel="noopener noreferrer">{jiraDashboardUrl}</a></p>
				{:else}
					<p class="text-sm text-soft">Enter any Jira URL and PR Pulse will normalize it to the base workspace URL.</p>
				{/if}
			</div>
		</SectionCard>

		<div class="grid gap-4 lg:grid-cols-2">
			<SectionCard>
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-2xl bg-white/6 p-3 text-white">
						<Clock3 class="h-5 w-5" />
					</div>
					<div>
						<h2 class="text-base font-semibold text-white">Refresh interval</h2>
						<p class="text-sm text-soft">Control how often the background worker refreshes cached PR data.</p>
					</div>
				</div>
				<div class="relative">
					<select class="select-input pr-10" bind:value={pollingIntervalMs} onchange={updatePollingInterval}>
						{#each pollingOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<div class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-soft">
						<ChevronDown class="h-4 w-4" />
					</div>
				</div>
			</SectionCard>

			<SectionCard>
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-2xl bg-white/6 p-3 text-white">
						<MonitorCog class="h-5 w-5" />
					</div>
					<div>
						<h2 class="text-base font-semibold text-white">Display mode</h2>
						<p class="text-sm text-soft">Choose whether PR Pulse prefers the popup or full page workflow.</p>
					</div>
				</div>
				<div class="grid gap-3">
					<RadioCard name="displayMode" value="popup" currentValue={currentSettings.displayMode || 'popup'} title="Popup" description="Keep the toolbar interaction lightweight and compact." icon="📱" onchange={updateDisplayMode} />
					<RadioCard name="displayMode" value="fullpage" currentValue={currentSettings.displayMode || 'popup'} title="Full page" description="Use a larger tab surface for denser layouts and future filters." icon="🖥️" onchange={updateDisplayMode} />
				</div>
			</SectionCard>
		</div>

		<SectionCard>
			<div class="mb-4 flex items-center gap-3">
				<div class="rounded-2xl bg-white/6 p-3 text-white">
					<ListFilter class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-base font-semibold text-white">Filters</h2>
					<p class="text-sm text-soft">Configure the active filter persistence.</p>
				</div>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<RadioCard name="persistFilters" value={true} currentValue={currentSettings.persistFilters ?? true} title="Remember Filters" description="Keep your search and active filters across extension sessions forever." icon="💾" onchange={() => updateSetting('persistFilters', true)} />
				<RadioCard name="persistFilters" value={false} currentValue={currentSettings.persistFilters ?? true} title="Per Session" description="Clear search query and filters every time you close the popup." icon="🧹" onchange={() => updateSetting('persistFilters', false)} />
			</div>
		</SectionCard>

		<SectionCard>
			<div class="mb-0 flex items-center gap-3">
				<div class="rounded-2xl bg-white/6 p-3 text-white">
					<Sparkles class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-base font-semibold text-white">Visual guidance</h2>
					<p class="text-sm text-soft">Hover over the sample card elements to recall what they do.</p>
				</div>
			</div>
			<InteractiveGuide />
		</SectionCard>

		<SectionCard className="danger-surface">
			<div class="mb-4 flex items-center gap-3 text-(--danger)">
				<div class="danger-surface rounded-lg border p-3">
					<ShieldAlert class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-base font-semibold">Danger zone</h2>
					<p class="text-sm text-[rgba(255,194,188,0.82)]">Clear cached data and reset the extension back to its first-run state.</p>
				</div>
			</div>
			<Button variant="danger" onclick={resetAll}>Reset all settings and data</Button>
		</SectionCard>

		<AttributionFooter />
	</div>
</div>