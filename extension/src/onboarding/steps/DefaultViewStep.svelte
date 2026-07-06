<script lang="ts">
	import { ArrowLeft, ArrowRight, GitPullRequest, Inbox, LayoutPanelLeft } from 'lucide-svelte';
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
	<div class="step-row">
		<div class="step-icon">
			<LayoutPanelLeft class="h-5 w-5" />
		</div>
		<div>
			<h2 class="step-heading">Choose your default view</h2>
			<p class="desc">Pick the first tab the popup should show when you open the extension.</p>
		</div>
	</div>
	<div class="grid gap-3 md:grid-cols-2">
		<RadioCard name="pinnedTab" value="myPRs" currentValue={pinnedTab} title="My PRs" description="Track pull requests you authored and keep an eye on CI and review progress." iconComponent={GitPullRequest} onchange={onPinnedTabChange} />
		<RadioCard name="pinnedTab" value="toReview" currentValue={pinnedTab} title="To review" description="Prioritize the work queued up for your review workload and team coordination." iconComponent={Inbox} onchange={onPinnedTabChange} />
	</div>
	<div class="step-actions">
		<Button variant="secondary" onclick={onBack}><ArrowLeft class="h-4 w-4" />Back</Button>
		<Button onclick={onNext}>Continue<ArrowRight class="h-4 w-4" /></Button>
	</div>
</SectionCard>
