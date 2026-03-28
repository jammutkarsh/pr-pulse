<script lang="ts">
	import { GitPullRequest, Inbox } from 'lucide-svelte';
	import type { Settings } from '../../lib/types';

	interface Props {
		currentTab?: Settings['pinnedTab'];
		myPrCount?: number;
		reviewCount?: number;
		onTabChange?: (tab: Settings['pinnedTab']) => void;
	}

	let {
		currentTab = 'myPRs',
		myPrCount = 0,
		reviewCount = 0,
		onTabChange = () => {}
	}: Props = $props();
</script>

<div class="border-b border-soft px-4 py-2.5 sm:px-4">
	<div class="grid grid-cols-2 gap-1 rounded-lg bg-(--bg-muted) p-1">
		<button
			class={`unstyled-button rounded-md px-3 py-1.5 text-sm font-medium transition ${currentTab === 'myPRs' ? 'bg-(--bg-panel-strong) text-white shadow-sm' : 'text-soft hover:bg-[#3a3d41] hover:text-white'}`}
			onclick={() => onTabChange('myPRs')}
		>
			<div class="flex items-center justify-center gap-2">
				<GitPullRequest class="h-4 w-4" />
				<span>My PRs</span>
				<span class="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">{myPrCount}</span>
			</div>
		</button>
		<button
			class={`unstyled-button rounded-md px-3 py-1.5 text-sm font-medium transition ${currentTab === 'toReview' ? 'bg-(--bg-panel-strong) text-white shadow-sm' : 'text-soft hover:bg-[#3a3d41] hover:text-white'}`}
			onclick={() => onTabChange('toReview')}
		>
			<div class="flex items-center justify-center gap-2">
				<Inbox class="h-4 w-4" />
				<span>To Review</span>
				<span class="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">{reviewCount}</span>
			</div>
		</button>
	</div>
</div>
