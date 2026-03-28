<script lang="ts">
	import { ArrowLeft, ArrowRight, LayoutPanelLeft } from 'lucide-svelte';
	import Button from '../../lib/components/Button.svelte';
	import RadioCard from '../../lib/components/RadioCard.svelte';
	import SectionCard from '../../lib/components/SectionCard.svelte';
	import type { Settings } from '../../../lib/types';

	type VoidCallback = () => void;

	interface Props {
		pinnedTab?: Settings['pinnedTab'];
		onPinnedTabChange?: (value: Settings['pinnedTab']) => void;
		onNext?: VoidCallback;
		onBack?: VoidCallback;
	}

	let {
		pinnedTab = 'myPRs',
		onPinnedTabChange = () => {},
		onNext = () => {},
		onBack = () => {}
	}: Props = $props();
</script>

<SectionCard className="p-6">
	<div class="mb-5 flex items-center gap-3">
		<div class="rounded-2xl bg-white/6 p-3 text-white">
			<LayoutPanelLeft class="h-5 w-5" />
		</div>
		<div>
			<h2 class="text-xl font-semibold text-white">Choose your default view</h2>
			<p class="text-sm text-soft">Pick the first tab the popup should show when you open the extension.</p>
		</div>
	</div>
	<div class="grid gap-3 md:grid-cols-2">
		<RadioCard name="pinnedTab" value="myPRs" currentValue={pinnedTab} title="My PRs" description="Track pull requests you authored and keep an eye on CI and review progress." icon="📤" onchange={onPinnedTabChange} />
		<RadioCard name="pinnedTab" value="toReview" currentValue={pinnedTab} title="To review" description="Prioritize the work queued up for your review workload and team coordination." icon="📥" onchange={onPinnedTabChange} />
	</div>
	<div class="mt-6 flex flex-wrap gap-3">
		<Button variant="secondary" onclick={onBack}><ArrowLeft class="h-4 w-4" />Back</Button>
		<Button onclick={onNext}>Continue<ArrowRight class="h-4 w-4" /></Button>
	</div>
</SectionCard>
