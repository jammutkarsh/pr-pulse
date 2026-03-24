<script>
	import { onMount } from 'svelte';
	import {
		Check,
		Copy,
		Expand,
		FileDiff,
		FolderGit2,
		GitBranch,
		GitPullRequest,
		Inbox,
		RefreshCw,
		Settings2,
		Ticket,
		UserRound,
	} from 'lucide-svelte';
	import Button from '../lib/components/Button.svelte';
	import SectionCard from '../lib/components/SectionCard.svelte';
	import { storage } from '../../lib/storage';
	import {
		copyToClipboard,
		extractJiraTicket,
		formatRelativeTime,
		getCheckStatusDisplay,
		getJiraUrl,
		getReviewStatusDisplay,
		isValidHttpUrl,
		safeParseInt,
	} from '../../lib/utils';

	let currentTab = 'myPRs';
	let prData = { myPRs: [], reviewRequests: [], lastFetched: null };
	let settings = {};
	let provider = null;
	let isFullpageMode = false;
	let loading = true;
	let setupRequired = false;
	let errorMessage = '';
	let refreshInProgress = false;
	let copiedItemId = null;
	let toastMessage = '';
	let toastType = 'info';
	let toastVisible = false;

	export let bootstrapDataPromise = null;

	$: currentItems = currentTab === 'myPRs' ? prData.myPRs || [] : prData.reviewRequests || [];
	$: myPrCount = prData.myPRs?.length || 0;
	$: reviewCount = prData.reviewRequests?.length || 0;
	$: lastUpdatedText = prData.lastFetched ? `Updated ${formatRelativeTime(prData.lastFetched)}` : 'Waiting for first sync';

	onMount(() => {
		void init();
	});

	async function init() {
		isFullpageMode = new URLSearchParams(window.location.search).has('fullpage');
		const bootstrapData = bootstrapDataPromise ? await bootstrapDataPromise : await storage.getPopupBootstrapData();
		settings = bootstrapData.settings || {};

		if (settings.displayMode === 'fullpage' && !isFullpageMode) {
			chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?fullpage=1') });
			window.close();
			return;
		}

		provider = bootstrapData.provider;
		setupRequired = !(provider && provider.user && provider.token);
		currentTab = settings.pinnedTab || 'myPRs';

		if (!setupRequired) {
			prData = bootstrapData.pullRequests;
		} else {
			prData = { myPRs: [], reviewRequests: [], lastFetched: null };
		}

		loading = false;
	}

	async function loadPrData() {
		loading = true;
		errorMessage = '';

		try {
			prData = await storage.getPullRequests();
		} catch (error) {
			console.error('Failed to load pull requests:', error);
			errorMessage = 'Failed to load pull requests';
		} finally {
			loading = false;
		}
	}

	async function refreshPrs() {
		if (setupRequired) {
			showToast('Setup required before refreshing PRs', 'warning');
			return;
		}

		refreshInProgress = true;
		try {
			await chrome.runtime.sendMessage({ type: 'REFRESH_PRS' });
			await loadPrData();
			showToast('PR data refreshed', 'success');
		} catch (error) {
			console.error('Failed to refresh PRs:', error);
			showToast('Failed to refresh PRs', 'error');
		} finally {
			refreshInProgress = false;
		}
	}

	function showToast(message, type = 'info') {
		toastMessage = message;
		toastType = type;
		toastVisible = true;
		setTimeout(() => {
			toastVisible = false;
		}, 2500);
	}

	function openSetup() {
		const target = chrome.runtime.getURL('onboarding/onboarding.html');
		if (isFullpageMode) {
			window.location.href = target;
			return;
		}

		chrome.tabs.create({ url: target });
	}

	function openSettings() {
		const target = chrome.runtime.getURL('settings/settings.html');
		if (isFullpageMode) {
			window.location.href = target;
			return;
		}

		chrome.tabs.create({ url: target });
	}

	function openFullscreen() {
		chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?fullpage=1') });
	}

	function safeOpenUrl(url) {
		if (!isValidHttpUrl(url)) {
			return;
		}

		chrome.tabs.create({ url });
	}

	async function handleCopy(value, id) {
		await copyToClipboard(value);
		copiedItemId = id;
		setTimeout(() => {
			if (copiedItemId === id) {
				copiedItemId = null;
			}
		}, 1000);
	}

	function getBranchUrl(pr) {
		if (!pr?.repoFullName || !pr?.branchName) {
			return null;
		}

		return `https://github.com/${pr.repoFullName}/tree/${encodeURIComponent(pr.branchName)}`;
	}

	function getStatusDotClass(pr) {
		const checksStatus = pr.checks?.status;
		const checksOk = !checksStatus || checksStatus === 'success' || checksStatus === 'neutral' || checksStatus === 'unknown';
		const reviewOk = pr.reviews?.status === 'approved';

		if (checksOk && reviewOk) {
			return 'bg-(--success)';
		}

		if (!checksOk && !reviewOk) {
			return 'bg-(--danger)';
		}

		return 'bg-(--warning)';
	}

	function getCheckToneClass(className) {
		switch (className) {
			case 'checks-success':
				return 'status-inline-success';
			case 'checks-failure':
				return 'status-inline-danger';
			case 'checks-pending':
				return 'status-inline-warning';
			default:
				return 'status-inline-neutral';
		}
	}

	function getReviewToneClass(className) {
		switch (className) {
			case 'status-approved':
				return 'status-inline-success';
			case 'status-changes':
				return 'status-inline-danger';
			default:
				return 'status-inline-warning';
		}
	}

	function getDotToneClass(className) {
		switch (className) {
			case 'checks-success':
			case 'status-approved':
				return 'status-dot-success';
			case 'checks-failure':
			case 'status-changes':
				return 'status-dot-danger';
			case 'checks-pending':
			case 'status-pending':
				return 'status-dot-warning';
			default:
				return 'status-dot-neutral';
		}
	}

	function getJiraLink(pr) {
		const jiraTicket = extractJiraTicket(pr.branchName);
		if (!jiraTicket || !settings.jiraBaseUrl) {
			return null;
		}

		const jiraUrl = getJiraUrl(jiraTicket, settings.jiraBaseUrl);
		if (!isValidHttpUrl(jiraUrl)) {
			return null;
		}

		return { ticket: jiraTicket, url: jiraUrl };
	}
</script>


<div class={isFullpageMode ? 'min-h-screen px-6 py-6' : 'h-150 w-105 overflow-hidden'}>
	<div class={`mx-auto flex ${isFullpageMode ? 'max-w-4xl' : 'h-full'} min-h-0 flex-col gap-3`}>
		<div class={`surface-card overflow-hidden rounded-none ${isFullpageMode ? '' : 'flex h-full flex-col'}`}>
			<div class="border-b border-soft px-4 py-3 sm:px-4">
				<div class="flex items-center justify-between gap-3">
					<button class="group flex min-w-0 items-center gap-3 text-left transition" on:click={() => provider?.user && safeOpenUrl(`https://github.com/${provider.user.login}`)}>
						<img src={provider?.user?.avatarUrl || '../icons/icon128.png'} alt="Avatar" class="h-9 w-9 rounded-md border border-soft object-cover" />
						<div class="min-w-0">
							<div class="truncate text-sm font-semibold text-white transition group-hover:text-(--accent)">{provider?.user?.name || 'PR Pulse'}</div>
							<div class="truncate text-xs text-soft transition group-hover:text-(--accent)">{provider?.user?.login ? `@${provider.user.login}` : 'Pull request radar'}</div>
						</div>
					</button>
					<div class="flex items-center gap-2">
						<Button className="hover:text-(--accent)" size="icon" variant="ghost" on:click={refreshPrs} disabled={refreshInProgress} aria-label="Refresh pull requests" title="Refresh pull requests">
							<RefreshCw class={`h-4 w-4 ${refreshInProgress ? 'animate-spin' : ''}`} />
						</Button>
						{#if !isFullpageMode}
							<Button className="hover:text-(--accent)" size="icon" variant="ghost" on:click={openFullscreen} aria-label="Open full page view" title="Open full page view">
								<Expand class="h-4 w-4" />
							</Button>
						{/if}
						<Button className="hover:text-(--accent)" size="icon" variant="ghost" on:click={openSettings} aria-label="Open settings" title="Open settings">
							<Settings2 class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			<div class="border-b border-soft px-4 py-2.5 sm:px-4">
				<div class="grid grid-cols-2 gap-1 rounded-lg bg-(--bg-muted) p-1">
					<button
						class={`rounded-md px-3 py-1.5 text-sm font-medium transition ${currentTab === 'myPRs' ? 'bg-(--bg-panel-strong) text-white shadow-sm' : 'text-soft hover:bg-[#3a3d41] hover:text-white'}`}
						on:click={() => currentTab = 'myPRs'}
					>
						<div class="flex items-center justify-center gap-2">
							<GitPullRequest class="h-4 w-4" />
							<span>My PRs</span>
							<span class="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">{myPrCount}</span>
						</div>
					</button>
					<button
						class={`rounded-md px-3 py-1.5 text-sm font-medium transition ${currentTab === 'toReview' ? 'bg-(--bg-panel-strong) text-white shadow-sm' : 'text-soft hover:bg-[#3a3d41] hover:text-white'}`}
						on:click={() => currentTab = 'toReview'}
					>
						<div class="flex items-center justify-center gap-2">
							<Inbox class="h-4 w-4" />
							<span>To Review</span>
							<span class="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">{reviewCount}</span>
						</div>
					</button>
				</div>
			</div>

			<div class={`px-4 py-3 sm:px-4 ${isFullpageMode ? 'min-h-[70vh]' : 'min-h-0 flex-1 overflow-auto'}`}>
				{#if loading}
					<div class="state-shell">
						<RefreshCw class="h-8 w-8 animate-spin text-(--accent)" />
						<p class="text-sm text-soft">Loading pull requests...</p>
					</div>
				{:else if setupRequired}
					<div class="state-shell">
						<div class="accent-surface rounded-full p-4 text-(--accent)">
							<UserRound class="h-8 w-8" />
						</div>
						<div class="space-y-1">
							<h2 class="text-lg font-semibold">Setup Required</h2>
							<p class="max-w-sm text-sm text-soft">Connect your GitHub account to start tracking PRs in the popup.</p>
						</div>
						<Button on:click={openSetup}>Open Setup</Button>
					</div>
				{:else if errorMessage}
					<div class="state-shell">
						<div class="text-sm text-(--danger)">{errorMessage}</div>
						<Button variant="secondary" on:click={loadPrData}>Try Again</Button>
					</div>
				{:else if currentItems.length === 0}
					<div class="state-shell">
						<div class="rounded-full bg-white/6 p-4 text-soft">
							<Inbox class="h-8 w-8" />
						</div>
						<h2 class="text-lg font-semibold">No pull requests here</h2>
						<p class="max-w-sm text-sm text-soft">
							{currentTab === 'myPRs' ? "You don't have any open PRs right now." : 'No pull requests are waiting for your review.'}
						</p>
					</div>
				{:else}
					<div class={`flex flex-col gap-3 ${isFullpageMode ? '' : 'pr-1 scroll-thin'}`}>
						{#each currentItems as pr}
							{@const reviewDisplay = getReviewStatusDisplay(pr.reviews?.status)}
							{@const checkDisplay = getCheckStatusDisplay(pr.checks?.status)}
							{@const jiraLink = getJiraLink(pr)}
							{@const branchUrl = getBranchUrl(pr)}
							<SectionCard className="rounded-[20px] p-3.5">
								<div class="min-w-0 space-y-1">
									<div class="relative min-w-0 pr-6">
										<div class="flex min-w-0 items-start gap-1">
											<span class={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getStatusDotClass(pr)}`}></span>
											<button class="hyperlink-button line-clamp-2 flex-1 overflow-hidden text-left text-sm font-semibold leading-[1.15rem] text-white hover:text-(--accent)" on:click={() => safeOpenUrl(pr.url)}>
												{pr.title}
											</button>
										</div>
										<button class="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-sm text-soft transition hover:bg-(--bg-muted) hover:text-white" type="button" on:click={() => handleCopy(pr.url, `pr-${pr.id}`)} aria-label="Copy PR link" title="Copy PR link">
											{#if copiedItemId === `pr-${pr.id}`}
												<Check class="h-3 w-3 text-(--success)" />
											{:else}
												<Copy class="h-3 w-3" />
											{/if}
										</button>
									</div>

									<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-4 text-soft">
										<button class="action-chip" on:click={() => safeOpenUrl(`https://github.com/${encodeURI(pr.repoFullName || '')}`)}>
											<FolderGit2 class="metadata-repo-icon h-3.5 w-3.5" />
											<span class="hyperlink-text metadata-repo">{pr.repoFullName}</span>
										</button>
										<span aria-hidden="true" class="text-dim">•</span>
										<button class="action-chip" on:click={() => safeOpenUrl(`${pr.url}/changes`)}>
											<FileDiff class="metadata-diff-icon h-3.5 w-3.5" />
											<span>
												<span class="metadata-diff-add font-semibold">+{safeParseInt(pr.changes?.additions, 0)}</span><span class="metadata-diff-del font-semibold">-{safeParseInt(pr.changes?.deletions, 0)}</span>
											</span>
										</button>
										{#if jiraLink}
											<span aria-hidden="true" class="text-dim">•</span>
											<button class="action-chip" on:click={() => safeOpenUrl(jiraLink.url)}>
												<Ticket class="metadata-jira-icon h-3.5 w-3.5" />
												<span class="hyperlink-text metadata-jira">{jiraLink.ticket}</span>
											</button>
										{/if}
										{#if branchUrl}
											<span aria-hidden="true" class="text-dim">•</span>
											<div class="flex items-center gap-0.5">
												<button class="action-chip" on:click={() => safeOpenUrl(branchUrl)}>
													<GitBranch class="metadata-branch-icon h-3.5 w-3.5" />
													<span class="hyperlink-text metadata-branch">{pr.branchName}</span>
												</button>
												<Button className="h-5 w-5 px-0 text-soft hover:text-white" size="icon" variant="ghost" on:click={() => handleCopy(pr.branchName, `branch-${pr.id}`)} aria-label="Copy branch name" title="Copy branch name">
													{#if copiedItemId === `branch-${pr.id}`}
														<Check class="h-3 w-3 text-(--success)" />
													{:else}
														<Copy class="h-3 w-3" />
													{/if}
												</Button>
											</div>
										{/if}
									</div>

									<div class="border-t border-soft pt-2.5">
										<div class="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
											<span class={`status-inline ${getCheckToneClass(checkDisplay.className)}`}>
												<span class={`status-dot ${getDotToneClass(checkDisplay.className)}`}></span>
												{checkDisplay.label}
											</span>
											<span class={`status-inline ${getReviewToneClass(reviewDisplay.className)}`}>
												<span class={`status-dot ${getDotToneClass(reviewDisplay.className)}`}></span>
												{reviewDisplay.label}
											</span>
										</div>
									</div>
								</div>
							</SectionCard>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-center border-t border-soft px-4 py-2.5 text-xs text-soft sm:px-4">
				<span>{lastUpdatedText}</span>
			</div>
		</div>

		{#if toastVisible}
			<div class={`fixed bottom-4 right-4 rounded-md border px-4 py-3 text-sm shadow-soft ${toastType === 'error' ? 'danger-surface text-(--danger)' : toastType === 'warning' ? 'warning-surface text-(--warning)' : 'accent-surface text-(--accent)'}`}>
				{toastMessage}
			</div>
		{/if}
	</div>
</div>