<script>
	import { ArrowLeft, MonitorSmartphone, Sparkles } from 'lucide-svelte';
	import Button from '../../lib/components/Button.svelte';
	import RadioCard from '../../lib/components/RadioCard.svelte';
	import SectionCard from '../../lib/components/SectionCard.svelte';

	export let displayMode = 'popup';
	export let completingSetup = false;
	export let onDisplayModeChange = () => {};
	export let onComplete = () => {};
	export let onBack = () => {};
</script>

<SectionCard className="p-6">
	<div class="mb-5 flex items-center gap-3">
		<div class="rounded-2xl bg-white/6 p-3 text-white">
			<MonitorSmartphone class="h-5 w-5" />
		</div>
		<div>
			<h2 class="text-xl font-semibold text-white">Choose a display mode</h2>
			<p class="text-sm text-soft">Start compact in the popup or jump directly into a full-page workspace.</p>
		</div>
	</div>
	<div class="grid gap-3 md:grid-cols-2">
		<RadioCard name="displayMode" value="popup" currentValue={displayMode} title="Popup" description="A compact glanceable interface from the toolbar for quick daily use." icon="📱" on:change={(event) => onDisplayModeChange(event.detail)} />
		<RadioCard name="displayMode" value="fullpage" currentValue={displayMode} title="Full page" description="A broader canvas better suited for future filters, search, and richer organization." icon="🖥️" on:change={(event) => onDisplayModeChange(event.detail)} />
	</div>
	<div class="mt-6 flex flex-wrap gap-3">
		<Button variant="secondary" on:click={onBack}><ArrowLeft class="h-4 w-4" />Back</Button>
		<Button on:click={onComplete} disabled={completingSetup}>
			{completingSetup ? 'Finishing setup...' : 'Complete setup'}
			<Sparkles class="h-4 w-4" />
		</Button>
	</div>
</SectionCard>
