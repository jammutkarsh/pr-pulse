<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PopupHeader from './PopupHeader.svelte';
	import PrCard from './PrCard.svelte';
	import PopupStates from './PopupStates.svelte';
	import SearchFilter from './SearchFilter.svelte';
	import AttributionFooter from '../lib/components/AttributionFooter.svelte';
	import {
		isExtensionRuntime,
		runtimeGetURL,
		storageOnChangedAddListener,
		storageOnChangedRemoveListener,
		runtimeSendMessage,
		tabsCreate,
		type StorageChangeMap,
	} from '../../lib/extension-api';
	import { storage } from '../../lib/storage';
	import type { FiltersByTab, PopupFilters, PopupTab, PullRequestData, Settings, StoredProviderConfig } from '../../lib/types';
	import { DEFAULT_SETTINGS } from '../../lib/ui-config';
	import {
		cloneFilters,
		createDefaultFilters,
		createDefaultFiltersByTab,
		createPrView,
	} from '../../lib/pr-view';
	import {
		copyToClipboard,
		formatRelativeTime,
		isValidHttpUrl,
	} from '../../lib/utils';

	type PopupBootstrapData = Awaited<ReturnType<typeof storage.getPopupBootstrapData>>;

	const tokenExpired = 'Token expired or revoked; Connect a new one.';

	interface Props {
		bootstrapDataPromise?: Promise<PopupBootstrapData> | null;
	}

	let { bootstrapDataPromise = null }: Props = $props();

	let currentTab = $state<Settings['pinnedTab']>('myPRs');
	let prData = $state<PullRequestData>({ myPRs: [], reviewRequests: [], lastFetched: null });
	let settings = $state<Settings>(DEFAULT_SETTINGS);
	let provider = $state<StoredProviderConfig | undefined>(undefined);
	let isFullpageMode = $state(false);
	let loading = $state(true);
	let setupRequired = $state(false);
	let errorMessage = $state('');
	let refreshInProgress = $state(false);
	let copiedItemId = $state<string | null>(null);
	let toastMessage = $state('');
	let toastType = $state<'info' | 'warning' | 'error' | 'success'>('info');
	let toastVisible = $state(false);
	let viewedPrIds = new Set<string>();
	let newPrCount = $state(0);
	let isSearchOpen = $state(false);
	let isFilterOpen = $state(false);
	let searchQuery = $state('');
	let activeFilters = $state<PopupFilters>(createDefaultFilters());
	let filtersByTab = $state<FiltersByTab>(createDefaultFiltersByTab());
	let filterPersistenceReady = $state(false);

	onMount(() => {
		void init();
	});

	onDestroy(() => {
		storageOnChangedRemoveListener(onStorageChanged);
	});

	function onStorageChanged(changes: StorageChangeMap, areaName: string) {
		if (areaName !== 'local' || !changes.pullRequests?.newValue) return;
		const newData = changes.pullRequests.newValue as PullRequestData;
		prData = newData;

		if (viewedPrIds.size > 0) {
			const allNewIds = [...(newData.myPRs || []), ...(newData.reviewRequests || [])].map((pr) => pr.id);
			newPrCount = allNewIds.filter((id) => !viewedPrIds.has(id)).length;
		}
	}

	async function initDisplayMode(bootstrapSettings: Settings): Promise<boolean> {
		isFullpageMode = new URLSearchParams(window.location.search).has('fullpage');

		if (bootstrapSettings.displayMode === 'fullpage' && !isFullpageMode) {
			await tabsCreate({ url: runtimeGetURL('popup/popup.html?fullpage=1') });
			window.close();
			return true;
		}

		return false;
	}

	async function initDataAndFilters(bootstrapData: PopupBootstrapData) {
		provider = bootstrapData.provider;
		setupRequired = !(provider && provider.user && provider.token);
		currentTab = settings.pinnedTab || 'myPRs';

		if (provider?.isTokenInvalid) {
			errorMessage = tokenExpired;
		}

		if (setupRequired) {
			prData = { myPRs: [], reviewRequests: [], lastFetched: null };
			filtersByTab = createDefaultFiltersByTab();
			activeFilters = createDefaultFilters();
			return;
		}

		prData = bootstrapData.pullRequests;
		const allPrs = [...(prData.myPRs || []), ...(prData.reviewRequests || [])];
		viewedPrIds = new Set(allPrs.map((pr) => pr.id));

		if (settings.persistFilters) {
			filtersByTab = await storage.getFilters(currentTab);
			activeFilters = cloneFilters(filtersByTab[currentTab]);
		} else {
			await storage.clearFilters();
		}
	}

	async function init() {
		filterPersistenceReady = false;
		const bootstrapData = bootstrapDataPromise ? await bootstrapDataPromise : await storage.getPopupBootstrapData();
		settings = bootstrapData.settings;

		const redirected = await initDisplayMode(settings);
		if (redirected) return;

		await initDataAndFilters(bootstrapData);
		filterPersistenceReady = true;
		loading = false;
		storageOnChangedAddListener(onStorageChanged);
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
			const response = await runtimeSendMessage<{ success?: boolean; error?: string }>({ type: 'REFRESH_PRS' });
			if (response && response.success === false) {
				if (response.error === 'TOKEN_INVALID') {
					errorMessage = tokenExpired;
					return;
				}
				throw new Error(response.error);
			}
			await loadPrData();
			showToast('PR data refreshed', 'success');
		} catch (error) {
			console.error('Failed to refresh PRs:', error);
			showToast('Failed to refresh PRs', 'error');
		} finally {
			refreshInProgress = false;
		}
	}

	function showToast(message: string, type: typeof toastType = 'info') {
		toastMessage = message;
		toastType = type;
		toastVisible = true;
		setTimeout(() => {
			toastVisible = false;
		}, 2500);
	}

	function openSetup() {
		const target = runtimeGetURL('onboarding/onboarding.html');
		if (isFullpageMode) {
			window.location.href = target;
			return;
		}

		void tabsCreate({ url: target });
	}

	function openSettings() {
		const target = runtimeGetURL('settings/settings.html');
		if (isFullpageMode) {
			window.location.href = target;
			return;
		}

		void tabsCreate({ url: target });
	}

	function openFullscreen() {
		void tabsCreate({ url: runtimeGetURL('popup/popup.html?fullpage=1') });
	}

	function toggleSearch() {
		if (!isSearchOpen) {
			isSearchOpen = true;
			isFilterOpen = hasMeaningfulFilters;
			return;
		}

		isSearchOpen = false;
		isFilterOpen = false;
	}

	function handleTabChange(tab: PopupTab) {
		if (tab === currentTab) {
			return;
		}

		filtersByTab = {
			...filtersByTab,
			[currentTab]: cloneFilters(activeFilters),
		};
		currentTab = tab;
		activeFilters = cloneFilters(filtersByTab[tab]);
		isFilterOpen = false;
	}

	function safeOpenUrl(url: string) {
		if (!isValidHttpUrl(url)) {
			return;
		}

		void tabsCreate({ url });
	}

	async function handleCopy(value: string, id: string) {
		await copyToClipboard(value);
		copiedItemId = id;
		setTimeout(() => {
			if (copiedItemId === id) {
				copiedItemId = null;
			}
		}, 1000);
	}

	let currentItems = $derived(currentTab === 'myPRs' ? prData.myPRs || [] : prData.reviewRequests || []);
	let myPrCount = $derived(prData.myPRs?.length || 0);
	let reviewCount = $derived(prData.reviewRequests?.length || 0);
	let lastUpdatedText = $derived(prData.lastFetched ? `Updated ${formatRelativeTime(prData.lastFetched)}` : 'Waiting for first sync');
	let fullpageShellClasses = $derived(isFullpageMode ? 'w-full max-w-[80rem]' : 'h-full');
	let cardListClasses = $derived(isFullpageMode ? 'grid gap-3 xl:grid-cols-2' : 'flex flex-col gap-3 pr-1 scroll-thin');
	let view = $derived(createPrView(currentItems, activeFilters, searchQuery, currentTab));
	let filteredItems = $derived(view.items);
	let filterCount = $derived(view.filterCount);
	let filterActive = $derived(filterCount > 0);
	let allAvailableOwners = $derived(view.options.owners.all);
	let allAvailableAuthors = $derived(view.options.authors.all);
	let allAvailableRepos = $derived(view.options.repos.all);
	let availableOwners = $derived(view.options.owners.available);
	let availableAuthors = $derived(view.options.authors.available);
	let availableRepos = $derived(view.options.repos.available);
	let showSearchControls = $derived(!loading && !setupRequired && currentItems.length > 0);
	let showTabToggle = $derived(!loading && !setupRequired);
	let hasAuthorFilter = $derived(allAvailableAuthors.length > 1);
	let hasOwnerFilter = $derived(allAvailableOwners.length > 1);
	let hasRepoFilter = $derived(allAvailableRepos.length > 1);
	let hasMeaningfulFilters = true; // Always true because Draft filter is always available
	let searchActive = $derived(isSearchOpen || searchQuery.trim().length > 0);

	$effect(() => {
		if (!filterPersistenceReady || !isExtensionRuntime) {
			return;
		}

		if (settings.persistFilters) {
			const nextFiltersByTab = {
				...filtersByTab,
				[currentTab]: cloneFilters(activeFilters),
			};
			void storage.setFilters(nextFiltersByTab).catch((error) => {
				console.error('Failed to persist filter state:', error);
			});
			return;
		}

		void storage.clearFilters().catch((error) => {
			console.error('Failed to clear persisted filter state:', error);
		});
	});

	// Sync filtered count to badge when badgeCountMode is 'filters'
	// Always use the pinned (default) tab's data — never the current popup tab
	let pinnedTabItems = $derived(settings.pinnedTab === 'myPRs' ? (prData.myPRs || []) : (prData.reviewRequests || []));
	let pinnedTabFilters = $derived(currentTab === settings.pinnedTab ? activeFilters : filtersByTab[settings.pinnedTab]);
	let pinnedTabView = $derived(createPrView(pinnedTabItems, pinnedTabFilters, '', settings.pinnedTab));
	let pinnedTabFilterActive = $derived(pinnedTabView.filterCount > 0);
	let totalCount = $derived(settings.pinnedTab === 'myPRs' ? myPrCount : reviewCount);

	$effect(() => {
		if (settings.badgeCountMode !== 'filters') {
			return;
		}

		const targetCount = pinnedTabFilterActive ? pinnedTabView.items.length : totalCount;
		void runtimeSendMessage({ type: 'UPDATE_BADGE_COUNT', count: targetCount }).catch((error) => {
			console.error('Failed to update badge count:', error);
		});
	});
</script>


<div class={isFullpageMode ? 'min-h-screen px-6 py-6' : 'popup-frame'}>
	<div class={`mx-auto flex ${fullpageShellClasses} min-h-0 flex-col gap-3`}>
		<div class={`surface-card overflow-hidden ${isFullpageMode ? '' : 'flex h-full flex-col'}`}>
			<PopupHeader
				{provider}
				{isFullpageMode}
				{refreshInProgress}
				showCompactIdentity={showSearchControls}
				{showTabToggle}
				{showSearchControls}
				{isSearchOpen}
				{searchActive}
				{filterActive}
				{currentTab}
				{myPrCount}
				{reviewCount}
				onOpenUrl={safeOpenUrl}
				onTabChange={handleTabChange}
				onToggleSearch={toggleSearch}
				onRefresh={refreshPrs}
				onOpenFullscreen={openFullscreen}
				onOpenSettings={openSettings}
			/>

			{#if showSearchControls && isSearchOpen}
				<div class="border-b border-soft px-2.5 py-1.5 sm:px-2.5">
					<SearchFilter
						embedded={true}
						fullpageMode={isFullpageMode}
						hasAuthorFilter={hasAuthorFilter}
						hasOwnerFilter={hasOwnerFilter}
						hasRepoFilter={hasRepoFilter}
						isToReviewTab={currentTab === 'toReview'}
						bind:query={searchQuery}
						bind:activeFilters={activeFilters}
						bind:isSearchOpen={isSearchOpen}
						bind:isFilterOpen={isFilterOpen}
						allAuthors={allAvailableAuthors}
						allRepos={allAvailableRepos}
						allOwners={allAvailableOwners}
						{availableAuthors}
						{availableRepos}
						{availableOwners}
					/>
				</div>
			{/if}

			<div class={`px-4 ${showSearchControls ? 'pb-3 pt-3' : 'py-3'} sm:px-4 ${isFullpageMode ? 'min-h-[70vh]' : 'min-h-0 flex-1 overflow-auto'}`}>
				{#if loading}
					<div class="flex min-h-50 items-center justify-center desc">Loading PRs...</div>
				{:else if setupRequired || currentItems.length === 0}
					<PopupStates
						{setupRequired}
						{errorMessage}
						{currentTab}
						onOpenSetup={openSetup}
						onRetry={loadPrData}
					/>
				{:else}
					{#if errorMessage}
						<div class="mb-4 rounded-lg border border-(--danger)/20 bg-(--danger)/10 p-3 text-sm text-(--danger) flex items-center justify-between gap-4">
							<span>{errorMessage}</span>
							<button class="shrink-0 text-xs font-medium underline hover:text-(--danger)/80 whitespace-nowrap" onclick={openSettings}>Open Settings</button>
						</div>
					{/if}
					{#if filteredItems.length === 0}
						<div class="py-8 text-center text-soft">
							<p>No PRs match your filters.</p>
							<button class="mt-2 text-sm text-(--accent) hover:underline" onclick={() => { searchQuery = ''; activeFilters = createDefaultFilters(); }}>Clear filters</button>
						</div>
					{:else}
						<div class={cardListClasses}>
							{#each filteredItems as pr (pr.id)}
								<PrCard
									{pr}
									{isFullpageMode}
									{settings}
									{copiedItemId}
									onOpenUrl={safeOpenUrl}
									onCopy={handleCopy}
								/>
							{/each}
						</div>
					{/if}
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
