<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		delay?: number;
		children?: Snippet;
	}

	let {
		text,
		delay = 500,
		children,
	}: Props = $props();

	let isVisible = $state(false);
	let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

	function clearTooltipTimer() {
		if (tooltipTimer !== null) {
			clearTimeout(tooltipTimer);
			tooltipTimer = null;
		}
	}

	function showWithDelay() {
		clearTooltipTimer();
		tooltipTimer = setTimeout(() => {
			isVisible = true;
			tooltipTimer = null;
		}, delay);
	}

	function hideTooltip() {
		clearTooltipTimer();
		isVisible = false;
	}

	// Guarded: SSR (website prerender reuses this component) has no timers to
	// clear and hits a Svelte SSR bug registering onDestroy through this nested
	// snippet chain. No behavior change in the extension — always browser there.
	if (typeof document !== 'undefined') {
		onDestroy(() => {
			clearTooltipTimer();
		});
	}
</script>

<span
	class="relative inline-flex shrink-0"
	role="presentation"
	onmouseenter={showWithDelay}
	onmouseleave={hideTooltip}
	onfocusin={showWithDelay}
	onfocusout={hideTooltip}
>
	{@render children?.()}
	{#if isVisible}
		<span role="tooltip" class="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-soft bg-(--bg-panel-strong) px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
			{text}
		</span>
	{/if}
</span>