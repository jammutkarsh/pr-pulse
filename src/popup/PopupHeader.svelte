<script lang="ts">
	import { onMount } from 'svelte';
	import { Expand, GitPullRequest, Inbox, ListFilter, RefreshCw, Search, Settings2 } from 'lucide-svelte';
	import Button from '../lib/components/Button.svelte';
	import type { Settings, StoredProviderConfig } from '../../lib/types';

	const ACTIVE_CONTROL_CLASSES = '!text-(--accent) [filter:drop-shadow(0_0_1px_rgba(55,148,255,0.7))_drop-shadow(0_0_10px_rgba(55,148,255,0.35))] hover:!text-(--accent)';
	type VoidCallback = () => void;
	type TabChangeCallback = (tab: Settings['pinnedTab']) => void;

	interface Props {
		provider?: StoredProviderConfig | null;
		isFullpageMode?: boolean;
		refreshInProgress?: boolean;
		showCompactIdentity?: boolean;
		showTabToggle?: boolean;
		showSearchControls?: boolean;
		searchActive?: boolean;
		filterActive?: boolean;
		currentTab?: Settings['pinnedTab'];
		myPrCount?: number;
		reviewCount?: number;
		onOpenUrl?: (url: string) => void;
		onTabChange?: TabChangeCallback;
		onToggleSearch?: VoidCallback;
		onRefresh?: VoidCallback;
		onOpenFullscreen?: VoidCallback;
		onOpenSettings?: VoidCallback;
	}

	let {
		provider = null,
		isFullpageMode = false,
		refreshInProgress = false,
		showCompactIdentity = false,
		showTabToggle = false,
		showSearchControls = false,
		searchActive = false,
		filterActive = false,
		currentTab = 'myPRs',
		myPrCount = 0,
		reviewCount = 0,
		onOpenUrl = () => {},
		onTabChange = () => {},
		onToggleSearch = () => {},
		onRefresh = () => {},
		onOpenFullscreen = () => {},
		onOpenSettings = () => {}
	}: Props = $props();

	let headerElement = $state<HTMLDivElement | null>(null);
	let headerWidth = $state(0);
	let loginVisibilityThreshold = $derived(showTabToggle ? (isFullpageMode ? 640 : 470) : showSearchControls ? 380 : 320);
	let showLoginLine = $derived(headerWidth >= loginVisibilityThreshold);
	let headerControlIcon = $derived(!searchActive && filterActive ? ListFilter : Search);
	let headerControlLabel = $derived(searchActive ? 'Close search and filters' : !searchActive && filterActive ? 'Open search and active filters' : 'Open search and filters');

	onMount(() => {
		if (typeof ResizeObserver === 'undefined' || !headerElement) {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			headerWidth = entries[0]?.contentRect.width ?? 0;
		});

		observer.observe(headerElement);
		headerWidth = headerElement.clientWidth;

		return () => {
			observer.disconnect();
		};
	});
</script>

<div class="border-b border-soft px-4 py-3 sm:px-4">
	<div bind:this={headerElement} class="flex items-center justify-between gap-3">
		<button
			class={`unstyled-button group flex min-w-0 items-center text-left transition ${showCompactIdentity ? 'gap-2' : 'gap-3'}`}
			onclick={() => provider?.user && onOpenUrl(`https://github.com/${provider.user.login}`)}
			aria-label={provider?.user?.login ? `Open ${provider.user.login} on GitHub` : 'Open profile'}
			title={provider?.user?.login ? `@${provider.user.login}` : 'PR Pulse'}
		>
			<img src={provider?.user?.avatarUrl || '../icons/icon128.png'} alt="Avatar" class="h-9 w-9 rounded-md border border-soft object-cover" />
			<div class={`min-w-0 ${showCompactIdentity ? 'max-w-28' : ''}`}>
				<div class={`truncate font-semibold text-white transition group-hover:text-(--accent) ${showCompactIdentity ? 'text-[13px] leading-4' : 'text-sm'}`}>
					{provider?.user?.name || 'PR Pulse'}
				</div>
				{#if showLoginLine}
					<div class={`truncate text-soft transition group-hover:text-(--accent) ${showCompactIdentity ? 'text-[11px] leading-4' : 'text-xs'}`}>
						{provider?.user?.login ? `@${provider.user.login}` : 'Pull request radar'}
					</div>
				{/if}
			</div>
		</button>
		<div class="flex items-center gap-1.5">
			{#if showTabToggle}
				<Button
					className={currentTab === 'myPRs' ? ACTIVE_CONTROL_CLASSES : 'hover:text-(--accent)'}
					size="icon"
					variant="ghost"
					onclick={() => onTabChange('myPRs')}
					aria-label={`Show My PRs (${myPrCount})`}
					title={`My PRs (${myPrCount})`}
				>
					<span class="relative inline-flex">
						<GitPullRequest class="h-4 w-4" />
						<span class="absolute -right-2 -top-2 min-w-4 rounded-full bg-black/60 px-1 text-center text-[10px] font-semibold leading-4 text-white">{myPrCount}</span>
					</span>
				</Button>
				<Button
					className={currentTab === 'toReview' ? ACTIVE_CONTROL_CLASSES : 'hover:text-(--accent)'}
					size="icon"
					variant="ghost"
					onclick={() => onTabChange('toReview')}
					aria-label={`Show To Review (${reviewCount})`}
					title={`To Review (${reviewCount})`}
				>
					<span class="relative inline-flex">
						<Inbox class="h-4 w-4" />
						<span class="absolute -right-2 -top-2 min-w-4 rounded-full bg-black/60 px-1 text-center text-[10px] font-semibold leading-4 text-white">{reviewCount}</span>
					</span>
				</Button>
			{/if}
			{#if showSearchControls}
				<Button className={searchActive || filterActive ? ACTIVE_CONTROL_CLASSES : 'hover:text-(--accent)'} size="icon" variant="ghost" onclick={onToggleSearch} aria-label={headerControlLabel} title={headerControlLabel}>
					{@const SvelteComponent = headerControlIcon}
					<SvelteComponent class="h-4 w-4" />
				</Button>
			{/if}
			<Button className="hover:text-(--accent)" size="icon" variant="ghost" onclick={onRefresh} disabled={refreshInProgress} aria-label="Refresh pull requests" title="Refresh pull requests">
				<RefreshCw class={`h-4 w-4 ${refreshInProgress ? 'animate-spin' : ''}`} />
			</Button>
			{#if !isFullpageMode}
				<Button className="hover:text-(--accent)" size="icon" variant="ghost" onclick={onOpenFullscreen} aria-label="Open full page view" title="Open full page view">
					<Expand class="h-4 w-4" />
				</Button>
			{/if}
			<Button className="hover:text-(--accent)" size="icon" variant="ghost" onclick={onOpenSettings} aria-label="Open settings" title="Open settings">
				<Settings2 class="h-4 w-4" />
			</Button>
		</div>
	</div>
</div>
