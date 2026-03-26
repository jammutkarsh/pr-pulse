<script>
	import { CheckCircle2 } from 'lucide-svelte';
	import Button from '../../lib/components/Button.svelte';
	import SectionCard from '../../lib/components/SectionCard.svelte';
	import InteractiveGuide from '../../lib/components/InteractiveGuide.svelte';

	export let displayMode = 'popup';
	export let syncedPrCount = 0;
	export let onClose = () => {};
</script>

<SectionCard className="p-6">
	<div class="flex flex-col items-center gap-5 text-center">
		<div class="accent-surface rounded-full border p-4 text-(--accent)">
			<CheckCircle2 class="h-10 w-10" />
		</div>
		<div class="space-y-2">
			<h2 class="text-2xl font-semibold text-white">Get familiar with PR Pulse</h2>
			<p class="text-sm text-soft">Hover over the elements in the sample card below to see how it works.</p>
			{#if syncedPrCount > 0}
				<div class="inline-flex items-center gap-1.5 rounded-full border border-(--accent-border) bg-(--accent-muted) px-3 py-1 text-xs font-medium text-(--accent)">
					<span>Synced {syncedPrCount} PR{syncedPrCount !== 1 ? 's' : ''}</span>
				</div>
			{/if}
		</div>
		<div class="space-y-4">
			<InteractiveGuide />
		</div>
		{#if displayMode === 'popup'}
			<div class="flex flex-col items-center gap-2 mt-4">
				<Button on:click={onClose}>Close Setup</Button>
				<span class="text-sm text-soft">Pin the extension and click on it to open.</span>
			</div>
		{:else}
			<div class="mt-4">
				<Button on:click={onClose}>Open PR Pulse</Button>
			</div>
		{/if}
	</div>
</SectionCard>
