<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { Check } from 'lucide-svelte';

	type RadioCardValue = string | boolean;

	interface Props {
		value?: RadioCardValue;
		currentValue?: RadioCardValue;
		title?: string;
		description?: string;
		icon?: string;
		iconComponent?: ComponentType;
		name?: string;
		onchange?: (value: RadioCardValue) => void;
	}

	let {
		value = '',
		currentValue = '',
		title = '',
		description = '',
		icon = '',
		iconComponent = undefined,
		name = '',
		onchange,
	}: Props = $props();

	let checked = $derived(currentValue === value);
	let cardClasses = $derived([
		'block cursor-pointer rounded-lg border p-4 transition',
		checked
			? 'border-(--accent) bg-(--accent-muted) shadow-[0_0_0_1px_rgba(55,148,255,0.18)]'
			: 'border-soft bg-(--bg-panel) hover:border-strong hover:bg-[#333337]',
	].join(' '));
	let indicatorClasses = $derived([
		'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition',
		checked ? 'border-(--accent) bg-(--accent) text-white' : 'border-soft text-transparent',
	].join(' '));

	function handleChange() {
		onchange?.(value);
	}
</script>

<label class={cardClasses}>
	<input class="sr-only" type="radio" {name} {value} checked={checked} onchange={handleChange} />
	<div class="flex items-start justify-between gap-4">
		<div class="space-y-3">
			<div class="flex items-center gap-3">
				{#if iconComponent}
					{@const IconComponent = iconComponent}
					<span class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-soft bg-white/6 text-white">
						<IconComponent class="h-5 w-5" />
					</span>
				{:else}
					<span class="text-2xl">{icon}</span>
				{/if}
				<div>
					<div class="text-sm font-semibold text-white">{title}</div>
				</div>
			</div>
			<p class="text-sm leading-[1.2rem] text-soft">{description}</p>
		</div>
		<div class={indicatorClasses}>
			<Check class="h-3.5 w-3.5" />
		</div>
	</div>
</label>