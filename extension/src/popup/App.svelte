<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PopupHeader from './PopupHeader.svelte';
	import PrCard from './PrCard.svelte';
	import PopupStates from './PopupStates.svelte';
	import PopupSkeleton from './PopupSkeleton.svelte';
	import SearchFilter from './SearchFilter.svelte';
	import AttributionFooter from '../lib/components/AttributionFooter.svelte';
	import {
		runtimeGetURL,
		storageOnChangedAddListener,
		storageOnChangedRemoveListener,
		runtimeSendMessage,
		storageLocalGet,
		storageLocalRemove,
		storageLocalSet,
		tabsCreate,
		type StorageChangeMap,
	} from '../../lib/extension-api';
	import { storage } from '../../lib/storage';
	import Fuse from 'fuse.js';
	import type { PullRequest, PullRequestData, PopupAuthorFilterOption, PopupFilters, PopupOwnerFilterOption, PopupRepoFilterOption, Settings, StoredProviderConfig } from '../../lib/types';
	import { DEFAULT_SETTINGS } from '../../lib/ui-config';
	import {
		copyToClipboard,
		formatRelativeTime,
		isValidHttpUrl,
	} from '../../lib/utils';

	type PopupBootstrapData = Awaited<ReturnType<typeof storage.getPopupBootstrapData>>;
	type SearchablePullRequest = PullRequest & { _jiraTicket: string };
	type AuthorFilterOption = PopupAuthorFilterOption;
	type OwnerFilterOption = PopupOwnerFilterOption;
	type RepoFilterOption = PopupRepoFilterOption;
	type PopupTab = Settings['pinnedTab'];
	type StoredFilters = Partial<PopupFilters>;
	type StoredFilterState = {
		tabs?: Partial<Record<PopupTab, StoredFilters>>;
		activeFilters?: StoredFilters;
	};
	type FiltersByTab = Record<PopupTab, PopupFilters>;

	function createDefaultFilters(): PopupFilters {
		return {
			authors: [],
			owners: [],
			repos: [],
			ageRange: '',
			includeDrafts: false,
		};
	}

	function createDefaultFiltersByTab(): FiltersByTab {
		return {
			myPRs: createDefaultFilters(),
			toReview: createDefaultFilters(),
		};
	}

	function cloneFilters(filters: PopupFilters): PopupFilters {
		return {
			authors: [...filters.authors],
			owners: [...filters.owners],
			repos: [...filters.repos],
			ageRange: filters.ageRange,
			includeDrafts: filters.includeDrafts,
		};
	}

	function toStringArray(value: unknown): string[] {
		if (!Array.isArray(value)) {
			return [];
		}

		return value.filter((entry): entry is string => typeof entry === 'string');
	}

	function normalizeStoredFilters(value: StoredFilters | undefined): PopupFilters {
		const storedFilters = value ?? {};
		const authors = toStringArray(storedFilters.authors);
		const owners = toStringArray(storedFilters.owners);
		const repos = toStringArray(storedFilters.repos);
		const ageRange = typeof storedFilters.ageRange === 'string' ? storedFilters.ageRange : '';
		const includeDrafts = typeof storedFilters.includeDrafts === 'boolean' ? storedFilters.includeDrafts : false;

		return {
			...DEFAULT_FILTERS,
			authors,
			repos,
			owners,
			ageRange,
			includeDrafts,
		};
	}

	function normalizeStoredFilterState(value: StoredFilterState | undefined, fallbackTab: PopupTab): FiltersByTab {
		const defaultState = createDefaultFiltersByTab();
		const storedTabs = value?.tabs;

		if (storedTabs) {
			return {
				myPRs: normalizeStoredFilters(storedTabs.myPRs),
				toReview: normalizeStoredFilters(storedTabs.toReview),
			};
		}

		if (value?.activeFilters) {
			return {
				...defaultState,
				[fallbackTab]: normalizeStoredFilters(value.activeFilters),
			};
		}

		return defaultState;
	}

	const DEFAULT_FILTERS = createDefaultFilters();

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
	let activeFilters = $state<PopupFilters>({ ...DEFAULT_FILTERS });
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

	async function init() {
		filterPersistenceReady = false;
		isFullpageMode = new URLSearchParams(window.location.search).has('fullpage');
		const bootstrapData = bootstrapDataPromise ? await bootstrapDataPromise : await storage.getPopupBootstrapData();
		settings = bootstrapData.settings;

		if (settings.displayMode === 'fullpage' && !isFullpageMode) {
			await tabsCreate({ url: runtimeGetURL('popup/popup.html?fullpage=1') });
			window.close();
			return;
		}

		provider = bootstrapData.provider;
		setupRequired = !(provider && provider.user && provider.token);
		currentTab = settings.pinnedTab || 'myPRs';

		if (!setupRequired) {
			prData = bootstrapData.pullRequests;
			const allPrs = [...(prData.myPRs || []), ...(prData.reviewRequests || [])];
			viewedPrIds = new Set(allPrs.map((pr) => pr.id));

			if (settings.persistFilters) {
				const initialFilters = (await storageLocalGet<StoredFilterState | undefined>(['searchFilters'])).searchFilters;

				filtersByTab = normalizeStoredFilterState(initialFilters, currentTab);
				activeFilters = cloneFilters(filtersByTab[currentTab]);
			} else {
				await storageLocalRemove(['searchFilters']);
			}
		} else {
			prData = { myPRs: [], reviewRequests: [], lastFetched: null };
			filtersByTab = createDefaultFiltersByTab();
			activeFilters = createDefaultFilters();
		}

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
			await runtimeSendMessage({ type: 'REFRESH_PRS' });
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
	let allAvailableOwners = $derived(Array.from(
		new Map<string, OwnerFilterOption>(
			currentItems
				.map((pr) => {
					const ownerLogin = pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || '';
					const ownerType = pr.repoOwner?.type || 'unknown';
					return [ownerLogin.toLowerCase(), { login: ownerLogin, type: ownerType }] as const;
				})
				.filter(([login]) => Boolean(login))
	).values()
	).sort((left, right) => left.login.localeCompare(right.login, undefined, { sensitivity: 'base' })));
	let allAvailableAuthors = $derived(currentTab === 'toReview'
		? Array.from(
			new Map<string, AuthorFilterOption>(
				currentItems
					.map((pr) => [pr.author?.login?.toLowerCase() || '', {
						login: pr.author?.login || '',
						name: pr.author?.name || pr.author?.login || '',
					}] as const)
					.filter(([login]) => Boolean(login))
			).values()
		).sort((left, right) =>
			left.login.localeCompare(right.login, undefined, { sensitivity: 'base' }) ||
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
		)
		: []);
	let allAvailableRepos = $derived(Array.from(
		new Map<string, RepoFilterOption>(
			currentItems
				.filter((pr) => pr.repoFullName)
				.map((pr) => {
					const [owner = '', name = pr.repoFullName] = pr.repoFullName.split('/');
					return [
						pr.repoFullName,
						{
							fullName: pr.repoFullName,
							owner,
							ownerType: pr.repoOwner?.type || 'unknown',
							name,
						},
					] as const;
				})
		).values()
	).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.owner.localeCompare(right.owner, undefined, { sensitivity: 'base' })));
	let itemsForAuthorOptions = $derived.by(() => {
		let result = currentItems;
		if (activeFilters.owners.length > 0) {
			result = result.filter((pr) => activeFilters.owners.includes(pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || ''));
		}
		if (activeFilters.repos.length > 0) {
			result = result.filter((pr) => activeFilters.repos.includes(pr.repoFullName));
		}
		return result;
	});
	let itemsForOwnerOptions = $derived.by(() => {
		let result = currentItems;
		if (activeFilters.authors.length > 0) {
			result = result.filter((pr) => activeFilters.authors.includes(pr.author?.login || ''));
		}
		if (activeFilters.repos.length > 0) {
			result = result.filter((pr) => activeFilters.repos.includes(pr.repoFullName));
		}
		return result;
	});
	let itemsForRepoOptions = $derived.by(() => {
		let result = currentItems;
		if (activeFilters.authors.length > 0) {
			result = result.filter((pr) => activeFilters.authors.includes(pr.author?.login || ''));
		}
		if (activeFilters.owners.length > 0) {
			result = result.filter((pr) => activeFilters.owners.includes(pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || ''));
		}
		return result;
	});
	let availableOwners = $derived(Array.from(
		new Map<string, OwnerFilterOption>(
			itemsForOwnerOptions
				.map((pr) => {
					const ownerLogin = pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || '';
					const ownerType = pr.repoOwner?.type || 'unknown';
					return [ownerLogin.toLowerCase(), { login: ownerLogin, type: ownerType }] as const;
				})
				.filter(([login]) => Boolean(login))
	).values()
	).sort((left, right) => left.login.localeCompare(right.login, undefined, { sensitivity: 'base' })));
	let availableAuthors = $derived(currentTab === 'toReview'
		? Array.from(
			new Map<string, AuthorFilterOption>(
				itemsForAuthorOptions
					.map((pr) => [pr.author?.login?.toLowerCase() || '', {
						login: pr.author?.login || '',
						name: pr.author?.name || pr.author?.login || '',
					}] as const)
					.filter(([login]) => Boolean(login))
			).values()
		).sort((left, right) =>
			left.login.localeCompare(right.login, undefined, { sensitivity: 'base' }) ||
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
		)
		: []);
	let availableRepos = $derived(Array.from(
		new Map<string, RepoFilterOption>(
			itemsForRepoOptions
				.filter((pr) => pr.repoFullName)
				.map((pr) => {
					const [owner = '', name = pr.repoFullName] = pr.repoFullName.split('/');
					return [
						pr.repoFullName,
						{
							fullName: pr.repoFullName,
							owner,
							ownerType: pr.repoOwner?.type || 'unknown',
							name,
						},
					] as const;
				})
		).values()
	).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.owner.localeCompare(right.owner, undefined, { sensitivity: 'base' })));
	let showSearchControls = $derived(!loading && !setupRequired && !errorMessage && currentItems.length > 0);
	let showTabToggle = $derived(!loading && !setupRequired && !errorMessage);
	let hasAuthorFilter = $derived(allAvailableAuthors.length > 1);
	let hasOwnerFilter = $derived(allAvailableOwners.length > 1);
	let hasRepoFilter = $derived(allAvailableRepos.length > 1);
	let hasMeaningfulFilters = $derived(hasAuthorFilter || hasOwnerFilter || hasRepoFilter);
	let searchActive = $derived(isSearchOpen || searchQuery.trim().length > 0);
	// Age filter is temporarily disabled. Restore the commented ageRange count when re-enabling it.
	// let filterCount = $derived(activeFilters.authors.length + activeFilters.owners.length + activeFilters.repos.length + Number(Boolean(activeFilters.ageRange)));
	let filterCount = $derived(activeFilters.authors.length + activeFilters.owners.length + activeFilters.repos.length + (activeFilters.includeDrafts ? 1 : 0));
	let filterActive = $derived(filterCount > 0);
	let preSearchItems = $derived.by(() => {
		let result = currentItems;
		if (!activeFilters.includeDrafts) {
			result = result.filter((pr) => !pr.isDraft);
		}
		if (activeFilters.authors.length > 0) {
			result = result.filter((pr) => activeFilters.authors.includes(pr.author?.login || ''));
		}
		if (activeFilters.repos.length > 0) {
			result = result.filter((pr) => activeFilters.repos.includes(pr.repoFullName));
		}
		if (activeFilters.owners.length > 0) {
			result = result.filter((pr) => activeFilters.owners.includes(pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || ''));
		}
		return result;
	});
	let fuseIndex = $derived.by(() => {
		const searchInput: SearchablePullRequest[] = preSearchItems.map((pr) => ({
			...pr,
			_jiraTicket: pr.branchName ? (pr.branchName.match(/([A-Z]+-\d+)/i)?.[1] || '') : '',
		}));
		return new Fuse<SearchablePullRequest>(searchInput, {
			keys: ['title', 'branchName', 'repoFullName', '_jiraTicket'],
			threshold: 0.3,
			ignoreLocation: true,
		});
	});
	let filteredItems = $derived.by(() => {
		if (!searchQuery.trim()) {
			return preSearchItems;
		}
		return fuseIndex.search(searchQuery).map(({ item }) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { _jiraTicket, ...pr } = item;
			return pr;
		});
	});

	$effect(() => {
		if (!filterPersistenceReady || typeof chrome === 'undefined') {
			return;
		}

		if (settings.persistFilters) {
			const nextFiltersByTab = {
				...filtersByTab,
				[currentTab]: cloneFilters(activeFilters),
			};
			void storageLocalSet({
				searchFilters: {
					tabs: {
						myPRs: nextFiltersByTab.myPRs,
						toReview: nextFiltersByTab.toReview,
					},
				},
			}).catch((error) => {
				console.error('Failed to persist filter state:', error);
			});
			return;
		}

		void storageLocalRemove(['searchFilters']).catch((error) => {
			console.error('Failed to clear persisted filter state:', error);
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
				<div class="border-b border-soft px-4 py-2.5 sm:px-4">
					<SearchFilter
						embedded={true}
						fullpageMode={isFullpageMode}
						hasAuthorFilter={hasAuthorFilter}
						hasOwnerFilter={hasOwnerFilter}
						hasRepoFilter={hasRepoFilter}
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
					{#if filteredItems.length === 0}
						<div class="py-8 text-center text-soft">
							<p>No PRs match your filters.</p>
							<button class="mt-2 text-sm text-(--accent) hover:underline" onclick={() => { searchQuery = ''; activeFilters = { ...DEFAULT_FILTERS }; }}>Clear filters</button>
						</div>
					{:else}
						<div class={cardListClasses}>
							{#each filteredItems as pr (pr.id)}
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
