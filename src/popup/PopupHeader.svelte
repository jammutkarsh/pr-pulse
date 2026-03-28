<script lang="ts">
	import { Expand, ListFilter, RefreshCw, Search, Settings2 } from 'lucide-svelte';
	import Button from '../lib/components/Button.svelte';
	import type { StoredProviderConfig } from '../../lib/types';

	const ACTIVE_CONTROL_CLASSES = '!text-(--accent) [filter:drop-shadow(0_0_1px_rgba(55,148,255,0.7))_drop-shadow(0_0_10px_rgba(55,148,255,0.35))] hover:!text-(--accent)';
	type VoidCallback = () => void;

	interface Props {
		provider?: StoredProviderConfig | null;
		isFullpageMode?: boolean;
		refreshInProgress?: boolean;
		showCompactIdentity?: boolean;
		showSearchControls?: boolean;
		searchActive?: boolean;
		filterActive?: boolean;
		onOpenUrl?: (url: string) => void;
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
		showSearchControls = false,
		searchActive = false,
		filterActive = false,
		onOpenUrl = () => {},
		onToggleSearch = () => {},
		onRefresh = () => {},
		onOpenFullscreen = () => {},
		onOpenSettings = () => {}
	}: Props = $props();

	let headerControlIcon = $derived(!searchActive && filterActive ? ListFilter : Search);
	let headerControlLabel = $derived(!searchActive && filterActive ? 'Open search and active filters' : 'Toggle search');
</script>

<div class="border-b border-soft px-4 py-3 sm:px-4">
	<div class="flex items-center justify-between gap-3">
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
				<div class={`truncate text-soft transition group-hover:text-(--accent) ${showCompactIdentity ? 'text-[11px] leading-4' : 'text-xs'}`}>
					{provider?.user?.login ? `@${provider.user.login}` : 'Pull request radar'}
				</div>
			</div>
		</button>
		<div class="flex items-center gap-1.5">
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
