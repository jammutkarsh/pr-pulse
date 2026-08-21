<script lang="ts">
	import { Minimize2, Loader } from 'lucide-svelte';
	import PopupHeader from '../../../extension/src/popup/PopupHeader.svelte';
	import PrCard from '../../../extension/src/popup/PrCard.svelte';
	import SearchFilter from '../../../extension/src/popup/SearchFilter.svelte';
	import AttributionFooter from '../../../extension/src/lib/components/AttributionFooter.svelte';
	import type { PullRequest, PopupFilters, PopupTab, StoredProviderConfig } from '../../../extension/lib/types';
	import {
		createDefaultFilters,
		createDefaultFiltersByTab,
		createPrView,
		switchTab,
	} from '../../../extension/lib/pr-view';

	interface Props {
		username: string;
		myPRs: PullRequest[];
		reviewRequests: PullRequest[];
		loading?: boolean;
		errorMessage?: string;
		isSample?: boolean;
		isRateLimited?: boolean;
		installUrl?: string;
		onRefresh?: () => void;
	}

	let {
		username,
		myPRs,
		reviewRequests,
		loading = false,
		errorMessage = '',
		isSample = false,
		isRateLimited = false,
		installUrl = 'https://github.com/jammutkarsh/pr-pulse',
		onRefresh = () => {},
	}: Props = $props();

	type Tab = PopupTab;

	let fullpage = $state(false);
	let currentTab = $state<Tab>('myPRs');
	let isSearchOpen = $state(false);
	let isFilterOpen = $state(false);
	let searchQuery = $state('');
	let filtersByTab = $state(createDefaultFiltersByTab());
	let activeFilters = $state<PopupFilters>(createDefaultFilters());

	const settings = { jiraBaseUrl: '' };

	let provider = $derived<StoredProviderConfig>({
		type: 'github',
		token: 'demo',
		user: { login: username, name: `@${username}`, avatarUrl: `https://github.com/${username}.png?size=64` },
	});

	let currentItems = $derived(currentTab === 'myPRs' ? myPRs : reviewRequests);

	// Reset filters + search whenever the underlying account changes.
	let dataKey = $derived(`${username}:${myPRs.length}:${reviewRequests.length}`);
	let lastDataKey = '';
	$effect(() => {
		if (dataKey !== lastDataKey) {
			lastDataKey = dataKey;
			filtersByTab = createDefaultFiltersByTab();
			activeFilters = createDefaultFilters();
			searchQuery = '';
		}
	});

	// One view module, shared with the extension popup — no second copy to drift from.
	let view = $derived(createPrView(currentItems, activeFilters, searchQuery, currentTab));
	let filteredItems = $derived(view.items);
	let searchActive = $derived(isSearchOpen || searchQuery.trim().length > 0);
	let filterActive = $derived(view.filterCount > 0);

	let showSearchControls = $derived(!loading && !errorMessage);

	function toggleSearch() {
		if (!isSearchOpen) {
			isSearchOpen = true;
			return;
		}
		isSearchOpen = false;
		isFilterOpen = false;
	}
	function handleTabChange(tab: Tab) {
		if (tab === currentTab) return;
		const switched = switchTab(filtersByTab, currentTab, activeFilters, tab);
		filtersByTab = switched.stash;
		activeFilters = switched.filters;
		currentTab = tab;
		isFilterOpen = false;
	}
	function openUrl(url: string) {
		window.open(url, '_blank', 'noopener');
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') fullpage = false;
	}
	let emptyText = $derived(
		currentTab === 'myPRs'
			? `No open pull requests authored by @${username}.`
			: `Nothing is waiting on @${username}’s review right now.`,
	);
</script>

<svelte:window on:keydown={onKey} />

{#snippet popup()}
	<div class={`surface-card overflow-hidden ${fullpage ? '' : 'flex h-full flex-col'}`}>
		<PopupHeader
			{provider}
			isFullpageMode={fullpage}
			refreshInProgress={loading}
			showCompactIdentity={isSearchOpen}
			showTabToggle={true}
			{showSearchControls}
			{isSearchOpen}
			{searchActive}
			{filterActive}
			{currentTab}
			myPrCount={myPRs.length}
			reviewCount={reviewRequests.length}
			onOpenUrl={openUrl}
			onTabChange={handleTabChange}
			onToggleSearch={toggleSearch}
			onRefresh={() => onRefresh()}
			onOpenFullscreen={() => (fullpage = true)}
			onOpenSettings={() => openUrl(installUrl)}
		/>

		{#if showSearchControls && isSearchOpen}
			<div class="border-b border-soft px-2.5 py-1.5 sm:px-2.5">
				<SearchFilter
					embedded={true}
					fullpageMode={fullpage}
					options={view.options}
					isToReviewTab={currentTab === 'toReview'}
					bind:query={searchQuery}
					bind:activeFilters
					bind:isSearchOpen
					bind:isFilterOpen
				/>
			</div>
		{/if}

		<div class={`px-4 py-3 sm:px-4 ${fullpage ? 'min-h-[70vh]' : 'min-h-0 flex-1 overflow-auto'}`}>
			{#if loading}
				<div class="flex min-h-50 flex-col items-center justify-center gap-3 text-soft">
					<Loader class="h-5 w-5 animate-spin text-(--accent)" />
					<span>Fetching @{username}’s pull requests…</span>
				</div>
			{:else if errorMessage}
				<div class="flex min-h-50 flex-col items-center justify-center gap-3 px-6 text-center text-soft">
					<span class="text-(--danger)">{errorMessage}</span>
					<button class="text-sm text-(--accent) hover:underline" onclick={() => onRefresh()}>Try again</button>
				</div>
			{:else if filteredItems.length === 0}
				<div class="flex min-h-50 items-center justify-center px-6 text-center text-soft">
					{searchQuery.trim() || filterActive ? 'No PRs match your search and filters.' : emptyText}
				</div>
			{:else}
				<div class={fullpage ? 'grid gap-3 xl:grid-cols-2' : 'flex flex-col gap-3 pr-1'}>
					{#each filteredItems as pr (pr.id)}
						<PrCard {pr} isFullpageMode={fullpage} {settings} onOpenUrl={openUrl} />
					{/each}
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-center gap-2 border-t border-soft px-4 py-2.5 text-xs text-soft">
			{#if isSample && isRateLimited}
				<span class="text-dim">
					GitHub rate-limited this network — showing sample data.
					<a href={installUrl} target="_blank" rel="noopener" class="text-(--accent) hover:underline">Install the extension</a>
					to use your own token instead.
				</span>
			{:else if isSample}
				<span class="text-dim">Sample data — enter your username above for the real thing</span>
			{:else}
				<span>Live from GitHub · {filteredItems.length} shown</span>
			{/if}
		</div>
	</div>
{/snippet}

{#if fullpage}
	<!-- Fixed overlay = the extension's full-page tab, reproduced on the site.
	     Exit lives in its own sticky bar so it never overlaps the popup header. -->
	<div class="fixed inset-0 z-50 overflow-auto bg-(--bg-base)">
		<div class="sticky top-0 z-10 flex items-center justify-end border-b border-soft bg-(--bg-panel)/85 px-6 py-3 backdrop-blur">
			<button
				class="unstyled-button inline-flex items-center gap-1.5 rounded-lg border border-soft bg-(--bg-panel-strong) px-3 py-2 text-sm text-soft hover:text-white"
				onclick={() => (fullpage = false)}
			>
				<Minimize2 class="h-4 w-4" /> Exit full screen <span class="text-dim">Esc</span>
			</button>
		</div>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-6">
			{@render popup()}
			<AttributionFooter />
		</div>
	</div>
{:else}
	<div class="flex h-150 w-full max-w-105 flex-col">
		{@render popup()}
	</div>
{/if}
