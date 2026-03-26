<script lang="ts">
	export let className = '';
	$: hasPaddingOverride = /(^|\s)p(?:[trblxy])?-/.test(className);
	$: classes = ['surface-section', hasPaddingOverride ? '' : 'p-5', className].filter(Boolean).join(' ');
</script>

<section class={classes}>
	<slot />
</section>