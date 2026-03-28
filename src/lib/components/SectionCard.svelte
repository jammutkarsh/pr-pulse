<script lang="ts">
	interface Props {
		className?: string;
		children?: import('svelte').Snippet;
	}

	let { className = '', children }: Props = $props();
	let hasPaddingOverride = $derived(/(^|\s)p(?:[trblxy])?-/.test(className));
	let classes = $derived(['surface-section', hasPaddingOverride ? '' : 'p-5', className].filter(Boolean).join(' '));
</script>

<section class={classes}>
	{@render children?.()}
</section>