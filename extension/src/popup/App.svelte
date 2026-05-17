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
			drafts: 'exclude',
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
			drafts: filters.drafts,
		};
	}

	function getOwnersFromItems(items: PullRequest[]): OwnerFilterOption[] {
		// 1. Extract owner configurations from items
		const mappedOwners = items.map((pr) => {
			const ownerLogin = pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || '';
			const ownerType = pr.repoOwner?.type || 'unknown';
			return [ownerLogin.toLowerCase(), { login: ownerLogin, type: ownerType }] as const;
		});

		// 2. Filter out items with empty or invalid owner login
		const validOwners = mappedOwners.filter(([login]) => Boolean(login));

		// 3. De-duplicate owners using a Map
		const uniqueOwnersMap = new Map<string, OwnerFilterOption>(validOwners);
		const uniqueOwnersList = Array.from(uniqueOwnersMap.values());

		// 4. Sort the result alphabetically by login name
		uniqueOwnersList.sort((left, right) => left.login.localeCompare(right.login, undefined, { sensitivity: 'base' }));

		return uniqueOwnersList;
	}

	function getAuthorsFromItems(items: PullRequest[], isToReview: boolean): AuthorFilterOption[] {
		if (!isToReview) {
			return [];
		}

		// 1. Map items to author tuples
		const mappedAuthors = items.map((pr) => {
			const login = pr.author?.login || '';
			const name = pr.author?.name || login;
			return [login.toLowerCase(), { login, name }] as const;
		});

		// 2. Filter out empty/invalid author logins
		const validAuthors = mappedAuthors.filter(([login]) => Boolean(login));

		// 3. De-duplicate authors using a Map
		const uniqueAuthorsMap = new Map<string, AuthorFilterOption>(validAuthors);
		const uniqueAuthorsList = Array.from(uniqueAuthorsMap.values());

		// 4. Sort alphabetically by login, then name
		uniqueAuthorsList.sort((left, right) =>
			left.login.localeCompare(right.login, undefined, { sensitivity: 'base' }) ||
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
		);

		return uniqueAuthorsList;
	}

	function getReposFromItems(items: PullRequest[]): RepoFilterOption[] {
		// 1. Filter out PRs that don't have a repoFullName
		const prsWithRepos = items.filter((pr) => pr.repoFullName);

		// 2. Map PRs to repo tuple entries
		const mappedRepos = prsWithRepos.map((pr) => {
			const [owner = '', name = pr.repoFullName] = pr.repoFullName.split('/');
			const repoOption: RepoFilterOption = {
				fullName: pr.repoFullName,
				owner,
				ownerType: pr.repoOwner?.type || 'unknown',
				name,
			};
			return [pr.repoFullName, repoOption] as const;
		});

		// 3. De-duplicate repos using a Map
		const uniqueReposMap = new Map<string, RepoFilterOption>(mappedRepos);
		const uniqueReposList = Array.from(uniqueReposMap.values());

		// 4. Sort alphabetically by name, then owner
		uniqueReposList.sort((left, right) =>
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
			left.owner.localeCompare(right.owner, undefined, { sensitivity: 'base' })
		);

		return uniqueReposList;
	}

	function filterPullRequests(
		items: PullRequest[],
		filters: {
			authors?: string[];
			owners?: string[];
			repos?: string[];
			drafts?: 'only' | 'include' | 'exclude';
		}
	): PullRequest[] {
		let result = items;

		// 1. Filter by Drafts
		if (filters.drafts === 'exclude') {
			result = result.filter((pr) => !pr.isDraft);
		} else if (filters.drafts === 'only') {
			result = result.filter((pr) => pr.isDraft);
		}

		// 2. Filter by Author
		if (filters.authors && filters.authors.length > 0) {
			result = result.filter((pr) => {
				const authorLogin = pr.author?.login || '';
				return filters.authors!.includes(authorLogin);
			});
		}

		// 3. Filter by Repository
		if (filters.repos && filters.repos.length > 0) {
			result = result.filter((pr) => {
				return filters.repos!.includes(pr.repoFullName);
			});
		}

		// 4. Filter by Owner
		if (filters.owners && filters.owners.length > 0) {
			result = result.filter((pr) => {
				const ownerLogin = pr.repoOwner?.login || pr.repoFullName?.split('/')[0] || '';
				return filters.owners!.includes(ownerLogin);
			});
		}

		return result;
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
		const drafts = storedFilters.drafts === 'only' || storedFilters.drafts === 'include' ? storedFilters.drafts : 'exclude';

		return {
			...DEFAULT_FILTERS,
			authors,
			repos,
			owners,
			ageRange,
			drafts,
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
			const initialFilters = (await storageLocalGet<StoredFilterState | undefined>(['searchFilters'])).searchFilters;
			filtersByTab = normalizeStoredFilterState(initialFilters, currentTab);
			activeFilters = cloneFilters(filtersByTab[currentTab]);
		} else {
			await storageLocalRemove(['searchFilters']);
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
	let allAvailableOwners = $derived(getOwnersFromItems(filterPullRequests(currentItems, { drafts: activeFilters.drafts })));
	let allAvailableAuthors = $derived(getAuthorsFromItems(filterPullRequests(currentItems, { drafts: activeFilters.drafts }), currentTab === 'toReview'));
	let allAvailableRepos = $derived(getReposFromItems(filterPullRequests(currentItems, { drafts: activeFilters.drafts })));
	let itemsForAuthorOptions = $derived(filterPullRequests(currentItems, { owners: activeFilters.owners, repos: activeFilters.repos, drafts: activeFilters.drafts }));
	let itemsForOwnerOptions = $derived(filterPullRequests(currentItems, { authors: activeFilters.authors, repos: activeFilters.repos, drafts: activeFilters.drafts }));
	let itemsForRepoOptions = $derived(filterPullRequests(currentItems, { authors: activeFilters.authors, owners: activeFilters.owners, drafts: activeFilters.drafts }));
	let availableOwners = $derived(getOwnersFromItems(itemsForOwnerOptions));
	let availableAuthors = $derived(getAuthorsFromItems(itemsForAuthorOptions, currentTab === 'toReview'));
	let availableRepos = $derived(getReposFromItems(itemsForRepoOptions));
	let showSearchControls = $derived(!loading && !setupRequired && !errorMessage && currentItems.length > 0);
	let showTabToggle = $derived(!loading && !setupRequired && !errorMessage);
	let hasAuthorFilter = $derived(allAvailableAuthors.length > 1);
	let hasOwnerFilter = $derived(allAvailableOwners.length > 1);
	let hasRepoFilter = $derived(allAvailableRepos.length > 1);
	let hasMeaningfulFilters = true; // Always true because Draft filter is always available
	let searchActive = $derived(isSearchOpen || searchQuery.trim().length > 0);
	// Age filter is temporarily disabled. Restore the commented ageRange count when re-enabling it.
	// let filterCount = $derived(activeFilters.authors.length + activeFilters.owners.length + activeFilters.repos.length + Number(Boolean(activeFilters.ageRange)));
	let filterCount = $derived(activeFilters.authors.length + activeFilters.owners.length + activeFilters.repos.length + (activeFilters.drafts !== 'exclude' ? 1 : 0));
	let filterActive = $derived(filterCount > 0);
	let preSearchItems = $derived(filterPullRequests(currentItems, {
		authors: activeFilters.authors,
		owners: activeFilters.owners,
		repos: activeFilters.repos,
		drafts: activeFilters.drafts,
	}));
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
