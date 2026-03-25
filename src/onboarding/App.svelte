<script>
	import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Github, LayoutPanelLeft, Link2, MonitorSmartphone, Sparkles } from 'lucide-svelte';
	import Button from '../lib/components/Button.svelte';
	import RadioCard from '../lib/components/RadioCard.svelte';
	import SectionCard from '../lib/components/SectionCard.svelte';
	import { storage } from '../../lib/storage';
	import { isValidHttpUrl, isValidTokenFormat, sanitizeJiraUrl } from '../../lib/utils';

	const STEP_GITHUB = 1;
	const STEP_DEFAULT_VIEW = 2;
	const STEP_JIRA = 3;
	const STEP_DISPLAY = 4;
	const STEP_COMPLETE = 5;

	const steps = [
		{ id: STEP_GITHUB, label: 'GitHub' },
		{ id: STEP_DEFAULT_VIEW, label: 'Default view' },
		{ id: STEP_JIRA, label: 'Jira' },
		{ id: STEP_DISPLAY, label: 'Display' },
	];

	let currentStep = STEP_GITHUB;
	let providerData = null;
	let settings = {
		pinnedTab: 'myPRs',
		jiraBaseUrl: '',
		displayMode: 'popup',
	};
	let token = '';
	let tokenVisible = false;
	let testingConnection = false;
	let errorMessage = '';
	let completingSetup = false;

	$: previewUrl = settings.jiraBaseUrl && isValidHttpUrl(settings.jiraBaseUrl) ? `${settings.jiraBaseUrl}/browse/JIRA-1234` : '';

	async function handlePrimaryConnectionAction() {
		if (providerData) {
			nextStep();
			return;
		}

		await testConnection();
	}

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

	function updateJiraUrl(event) {
		settings = {
			...settings,
			jiraBaseUrl: sanitizeJiraUrl(event.currentTarget.value.trim()),
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
			await chrome.runtime.sendMessage({ type: 'PROVIDER_CONFIGURED' });
			currentStep = STEP_COMPLETE;
		} catch (error) {
			console.error('Setup failed:', error);
			errorMessage = 'Failed to complete setup. Please try again.';
		} finally {
			completingSetup = false;
		}
	}

	function closeSetup() {
		if (settings.displayMode === 'fullpage') {
			window.location.href = chrome.runtime.getURL('popup/popup.html?fullpage=1');
			return;
		}

		window.close();
	}
</script>

<div class="min-h-screen px-5 py-6 sm:px-6">
	<div class="mx-auto flex max-w-4xl flex-col gap-4">
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
					{#each steps as step}
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
			<SectionCard className="p-6">
				<div class="space-y-4">
					<div class="flex items-center gap-3">
						<div class="accent-surface rounded-lg border p-3 text-(--accent)">
							<Github class="h-5 w-5" />
						</div>
						<div>
							<h2 class="text-xl font-semibold text-white">Connect to GitHub</h2>
							<p class="text-sm text-soft">Authenticate once, then let the background worker keep your PRs fresh.</p>
						</div>
					</div>

					<div class="space-y-3">
						<div class="relative">
							<input class="field-input pr-12" type={tokenVisible ? 'text' : 'password'} bind:value={token} placeholder="ghp_xxxxxxxxxxxxxxxxx" autocomplete="off" />
							<button
								type="button"
								class="absolute right-3 top-1/2 -translate-y-1/2 text-soft transition hover:text-white"
								on:click={() => tokenVisible = !tokenVisible}
								aria-label={tokenVisible ? 'Hide token' : 'Show token'}
								aria-pressed={tokenVisible}
								title={tokenVisible ? 'Hide token' : 'Show token'}
							>
								{#if tokenVisible}
									<EyeOff class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</button>
						</div>
						<p class="text-sm text-soft">Need a token? <a class="text-(--accent) underline" href="https://github.com/settings/tokens/new?scopes=repo&description=PR%20Pulse" target="_blank" rel="noopener noreferrer">Create one here</a>.</p>
					</div>

					{#if providerData}
						<div class="accent-surface rounded-lg border p-4">
							<div class="flex items-center gap-3">
								<img src={providerData.user.avatarUrl} alt="Avatar" class="h-12 w-12 rounded-2xl border border-soft object-cover" />
								<div>
									<div class="text-sm font-semibold text-white">{providerData.user.name || providerData.user.login}</div>
									<div class="text-xs text-soft">@{providerData.user.login}</div>
								</div>
							</div>
						</div>
					{/if}

					<div class="flex flex-wrap gap-3">
						<Button on:click={handlePrimaryConnectionAction} disabled={testingConnection}>
							{testingConnection ? 'Testing connection...' : providerData ? 'Continue' : 'Test connection'}
							<ArrowRight class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</SectionCard>
		{:else if currentStep === STEP_DEFAULT_VIEW}
			<SectionCard className="p-6">
				<div class="mb-5 flex items-center gap-3">
					<div class="rounded-2xl bg-white/6 p-3 text-white">
						<LayoutPanelLeft class="h-5 w-5" />
					</div>
					<div>
						<h2 class="text-xl font-semibold text-white">Choose your default view</h2>
						<p class="text-sm text-soft">Pick the first tab the popup should show when you open the extension.</p>
					</div>
				</div>
				<div class="grid gap-3 md:grid-cols-2">
					<RadioCard name="pinnedTab" value="myPRs" currentValue={settings.pinnedTab} title="My PRs" description="Track pull requests you authored and keep an eye on CI and review progress." icon="📤" on:change={(event) => settings = { ...settings, pinnedTab: event.detail }} />
					<RadioCard name="pinnedTab" value="toReview" currentValue={settings.pinnedTab} title="To review" description="Prioritize the work queued up for your review workload and team coordination." icon="📥" on:change={(event) => settings = { ...settings, pinnedTab: event.detail }} />
				</div>
				<div class="mt-6 flex flex-wrap gap-3">
					<Button variant="secondary" on:click={prevStep}><ArrowLeft class="h-4 w-4" />Back</Button>
					<Button on:click={nextStep}>Continue<ArrowRight class="h-4 w-4" /></Button>
				</div>
			</SectionCard>
		{:else if currentStep === STEP_JIRA}
			<SectionCard className="p-6">
				<div class="mb-5 flex items-center gap-3">
					<div class="rounded-2xl bg-white/6 p-3 text-white">
						<Link2 class="h-5 w-5" />
					</div>
					<div>
						<h2 class="text-xl font-semibold text-white">Connect Jira</h2>
						<p class="text-sm text-soft">Map branch names to ticket links now, or skip and configure it later from settings.</p>
					</div>
				</div>
				<div class="space-y-4">
					<input class="field-input" type="url" value={settings.jiraBaseUrl} on:input={updateJiraUrl} placeholder="https://company.atlassian.net/browse/PROJ-123" />
					<div class="rounded-lg border border-soft bg-(--bg-panel) p-4 text-sm text-soft">
						<div class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-dim">Preview</div>
						<div class="flex flex-wrap items-center gap-2">
							<code class="rounded-lg bg-white/6 px-2 py-1 text-white">feat/JIRA-1234/login-flow</code>
							<span>→</span>
							{#if previewUrl}
								<a class="text-(--accent) underline" href={previewUrl} target="_blank" rel="noopener noreferrer">JIRA-1234</a>
							{:else}
								<span>No Jira configured</span>
							{/if}
						</div>
					</div>
				</div>
				<div class="mt-6 flex flex-wrap gap-3">
					<Button variant="secondary" on:click={prevStep}><ArrowLeft class="h-4 w-4" />Back</Button>
					<Button on:click={nextStep}>Continue<ArrowRight class="h-4 w-4" /></Button>
				</div>
			</SectionCard>
		{:else if currentStep === STEP_DISPLAY}
			<SectionCard className="p-6">
				<div class="mb-5 flex items-center gap-3">
					<div class="rounded-2xl bg-white/6 p-3 text-white">
						<MonitorSmartphone class="h-5 w-5" />
					</div>
					<div>
						<h2 class="text-xl font-semibold text-white">Choose a display mode</h2>
						<p class="text-sm text-soft">Start compact in the popup or jump directly into a full-page workspace.</p>
					</div>
				</div>
				<div class="grid gap-3 md:grid-cols-2">
					<RadioCard name="displayMode" value="popup" currentValue={settings.displayMode} title="Popup" description="A compact glanceable interface from the toolbar for quick daily use." icon="📱" on:change={(event) => settings = { ...settings, displayMode: event.detail }} />
					<RadioCard name="displayMode" value="fullpage" currentValue={settings.displayMode} title="Full page" description="A broader canvas better suited for future filters, search, and richer organization." icon="🖥️" on:change={(event) => settings = { ...settings, displayMode: event.detail }} />
				</div>
				<div class="mt-6 flex flex-wrap gap-3">
					<Button variant="secondary" on:click={prevStep}><ArrowLeft class="h-4 w-4" />Back</Button>
					<Button on:click={completeSetup} disabled={completingSetup}>
						{completingSetup ? 'Finishing setup...' : 'Complete setup'}
						<Sparkles class="h-4 w-4" />
					</Button>
				</div>
			</SectionCard>
		{:else}
			<SectionCard className="p-6">
				<div class="flex flex-col items-center gap-5 text-center">
					<div class="accent-surface rounded-full border p-4 text-(--accent)">
						<CheckCircle2 class="h-10 w-10" />
					</div>
					<div class="space-y-2">
						<h2 class="text-2xl font-semibold text-white">You are ready to go</h2>
						<p class="max-w-xl text-sm leading-[1.2rem] text-soft">PR Pulse is configured and the background worker can start syncing GitHub pull requests. You can reopen settings later as the extension grows into search, sorting, and multi-platform workflows.</p>
					</div>
					<div class="grid gap-3 text-left sm:grid-cols-3">
						<div class="rounded-lg border border-soft bg-(--bg-panel) p-4 text-sm text-soft">Click the extension icon anytime to open the PR list.</div>
						<div class="rounded-lg border border-soft bg-(--bg-panel) p-4 text-sm text-soft">Background refresh stays aligned with the saved interval setting.</div>
						<div class="rounded-lg border border-soft bg-(--bg-panel) p-4 text-sm text-soft">Settings remain the place to reconnect tokens and adjust future behaviors.</div>
					</div>
					<Button on:click={closeSetup}>Open PR Pulse</Button>
				</div>
			</SectionCard>
		{/if}
	</div>
</div>