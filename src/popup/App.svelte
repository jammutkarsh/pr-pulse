<script>
	import { onMount, onDestroy } from 'svelte';
	import PopupHeader from './PopupHeader.svelte';
	import PopupTabs from './PopupTabs.svelte';
	import PrCard from './PrCard.svelte';
	import PopupStates from './PopupStates.svelte';
	import PopupSkeleton from './PopupSkeleton.svelte';
	import AttributionFooter from '../lib/components/AttributionFooter.svelte';
	import { storage } from '../../lib/storage';
	import {
		copyToClipboard,
		formatRelativeTime,
		isValidHttpUrl,
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
	let viewedPrIds = new Set();
	let newPrCount = 0;

	export let bootstrapDataPromise = null;

	$: currentItems = currentTab === 'myPRs' ? prData.myPRs || [] : prData.reviewRequests || [];
	$: myPrCount = prData.myPRs?.length || 0;
	$: reviewCount = prData.reviewRequests?.length || 0;
	$: lastUpdatedText = prData.lastFetched ? `Updated ${formatRelativeTime(prData.lastFetched)}` : 'Waiting for first sync';
	$: fullpageShellClasses = isFullpageMode ? 'w-full max-w-[80rem]' : 'h-full';
	$: cardListClasses = isFullpageMode ? 'grid gap-3 xl:grid-cols-2' : 'flex flex-col gap-3 pr-1 scroll-thin';

	onMount(() => {
		void init();
	});

	onDestroy(() => {
		chrome.storage.onChanged.removeListener(onStorageChanged);
	});

	function onStorageChanged(changes, areaName) {
		if (areaName !== 'local' || !changes.pullRequests?.newValue) return;
		const newData = changes.pullRequests.newValue;
		prData = newData;

		// Count PRs that weren't in the snapshot taken when the popup opened
		if (viewedPrIds.size > 0) {
			const allNewIds = [...(newData.myPRs || []), ...(newData.reviewRequests || [])].map(pr => pr.id);
			newPrCount = allNewIds.filter(id => !viewedPrIds.has(id)).length;
		}
	}

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
			// Snapshot current PR IDs so we can detect new ones from background refreshes
			const allPrs = [...(prData.myPRs || []), ...(prData.reviewRequests || [])];
			viewedPrIds = new Set(allPrs.map(pr => pr.id));
		} else {
			prData = { myPRs: [], reviewRequests: [], lastFetched: null };
		}

		loading = false;

		chrome.storage.onChanged.addListener(onStorageChanged);
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
</script>


<div class={isFullpageMode ? 'min-h-screen px-6 py-6' : 'popup-frame'}>
	<div class={`mx-auto flex ${fullpageShellClasses} min-h-0 flex-col gap-3`}>
		<div class={`surface-card overflow-hidden ${isFullpageMode ? '' : 'flex h-full flex-col'}`}>
			<PopupHeader
				{provider}
				{isFullpageMode}
				{refreshInProgress}
				onOpenUrl={safeOpenUrl}
				onRefresh={refreshPrs}
				onOpenFullscreen={openFullscreen}
				onOpenSettings={openSettings}
			/>

			<PopupTabs
				{currentTab}
				{myPrCount}
				{reviewCount}
				onTabChange={(tab) => currentTab = tab}
			/>

			<div class={`px-4 py-3 sm:px-4 ${isFullpageMode ? 'min-h-[70vh]' : 'min-h-0 flex-1 overflow-auto'}`}>
				{#if loading}
					<PopupSkeleton className={isFullpageMode ? 'popup-skeleton--fullpage' : ''} />
				{:else if setupRequired || errorMessage || currentItems.length === 0}
					<PopupStates
						{setupRequired}
						{errorMessage}
						{currentTab}
						onOpenSetup={openSetup}
						onRetry={loadPrData}
					/>
				{:else}
					<div class={cardListClasses}>
						{#each currentItems as pr (pr.id)}
							<PrCard
								{pr}
								{currentTab}
								{isFullpageMode}
								{settings}
								{copiedItemId}
								onOpenUrl={safeOpenUrl}
								onCopy={handleCopy}
							/>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-center gap-2 border-t border-soft px-4 py-2.5 text-xs text-soft sm:px-4">
				<span>{lastUpdatedText}</span>
				{#if newPrCount > 0}
					<span aria-hidden="true" class="text-dim">·</span>
					<span class="font-medium text-(--accent)">{newPrCount} new</span>
				{/if}
			</div>
		</div>

		{#if isFullpageMode}
			<AttributionFooter />
		{/if}

		{#if toastVisible}
			<div class={`fixed bottom-4 right-4 rounded-md border px-4 py-3 text-sm shadow-soft ${toastType === 'error' ? 'danger-surface text-(--danger)' : toastType === 'warning' ? 'warning-surface text-(--warning)' : 'accent-surface text-(--accent)'}`}>
				{toastMessage}
			</div>
		{/if}
	</div>
</div>