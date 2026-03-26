<script>
	import { Expand, RefreshCw, Settings2 } from 'lucide-svelte';
	import Button from '../lib/components/Button.svelte';

	export let provider = null;
	export let isFullpageMode = false;
	export let refreshInProgress = false;
	export let onOpenUrl = () => {};
	export let onRefresh = () => {};
	export let onOpenFullscreen = () => {};
	export let onOpenSettings = () => {};
</script>

<div class="border-b border-soft px-4 py-3 sm:px-4">
	<div class="flex items-center justify-between gap-3">
		<button class="unstyled-button group flex min-w-0 items-center gap-3 text-left transition" on:click={() => provider?.user && onOpenUrl(`https://github.com/${provider.user.login}`)}>
			<img src={provider?.user?.avatarUrl || '../icons/icon128.png'} alt="Avatar" class="h-9 w-9 rounded-md border border-soft object-cover" />
			<div class="min-w-0">
				<div class="truncate text-sm font-semibold text-white transition group-hover:text-(--accent)">{provider?.user?.name || 'PR Pulse'}</div>
				<div class="truncate text-xs text-soft transition group-hover:text-(--accent)">{provider?.user?.login ? `@${provider.user.login}` : 'Pull request radar'}</div>
			</div>
		</button>
		<div class="flex items-center gap-2">
			<Button className="hover:text-(--accent)" size="icon" variant="ghost" on:click={onRefresh} disabled={refreshInProgress} aria-label="Refresh pull requests" title="Refresh pull requests">
				<RefreshCw class={`h-4 w-4 ${refreshInProgress ? 'animate-spin' : ''}`} />
			</Button>
			{#if !isFullpageMode}
				<Button className="hover:text-(--accent)" size="icon" variant="ghost" on:click={onOpenFullscreen} aria-label="Open full page view" title="Open full page view">
					<Expand class="h-4 w-4" />
				</Button>
			{/if}
			<Button className="hover:text-(--accent)" size="icon" variant="ghost" on:click={onOpenSettings} aria-label="Open settings" title="Open settings">
				<Settings2 class="h-4 w-4" />
			</Button>
		</div>
	</div>
</div>
