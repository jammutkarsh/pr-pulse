<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	const BASE_CLASSES = 'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,148,255,0.24)] disabled:cursor-not-allowed disabled:opacity-60';

	const VARIANT_CLASSES = {
		primary: 'bg-(--accent) text-white hover:bg-(--accent-strong)',
		secondary: 'border border-soft bg-(--bg-muted) text-white hover:border-strong hover:bg-[#3a3d41]',
		ghost: 'bg-transparent text-soft hover:bg-(--bg-muted) hover:text-white',
		danger: 'border danger-surface text-(--danger) hover:bg-[rgba(241,76,76,0.2)]',
	} as const;

	const SIZE_CLASSES = {
		sm: 'h-9 px-3 text-xs',
		md: 'h-10 px-4 text-sm',
		lg: 'h-11 px-5 text-sm',
		icon: 'h-9 w-9 px-0 text-sm',
	} as const;

	type ButtonVariant = keyof typeof VARIANT_CLASSES;
	type ButtonSize = keyof typeof SIZE_CLASSES;

	interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
		variant?: ButtonVariant;
		size?: ButtonSize;
		className?: string;
		children?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		className = '',
		disabled = false,
		children,
		...rest
	}: Props = $props();

	let classes = $derived([BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].filter(Boolean).join(' '));
</script>

<button type={type} class={classes} {disabled} {...rest}>
	{@render children?.()}
</button>