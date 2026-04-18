<script lang="ts">
	type Props = {
		className?: string;
		cardCount?: number;
	};

	let { className = '', cardCount = 3 }: Props = $props();
	let cards = $derived(Array.from({ length: cardCount }, (_, index) => index));
	let classes = $derived(['popup-skeleton', className].filter(Boolean).join(' '));
</script>

<div class={classes} aria-hidden="true">
	<div class="popup-skeleton__panel surface-card">
		<div class="popup-skeleton__header">
			<div class="popup-skeleton__identity">
				<div class="popup-skeleton__avatar skeleton-block"></div>
				<div class="popup-skeleton__identity-copy">
					<div class="popup-skeleton__line popup-skeleton__line--title skeleton-block"></div>
					<div class="popup-skeleton__line popup-skeleton__line--subtitle skeleton-block"></div>
				</div>
			</div>
			<div class="popup-skeleton__actions">
				<div class="popup-skeleton__icon skeleton-block"></div>
				<div class="popup-skeleton__icon skeleton-block"></div>
				<div class="popup-skeleton__icon skeleton-block"></div>
			</div>
		</div>

		<div class="popup-skeleton__tabs">
			<div class="popup-skeleton__tab popup-skeleton__tab--active skeleton-block"></div>
			<div class="popup-skeleton__tab skeleton-block"></div>
		</div>

		<div class="popup-skeleton__content">
			{#each cards as card (card)}
				<div class="popup-skeleton__item surface-section" data-card={card}>
					<div class="popup-skeleton__item-header">
						<div class="popup-skeleton__status-dot skeleton-block"></div>
						<div class="popup-skeleton__item-copy">
							<div class="popup-skeleton__line popup-skeleton__line--item-title skeleton-block"></div>
							<div class="popup-skeleton__line popup-skeleton__line--item-subtitle skeleton-block"></div>
						</div>
					</div>
					<div class="popup-skeleton__meta-row">
						<div class="popup-skeleton__pill popup-skeleton__pill--wide skeleton-block"></div>
						<div class="popup-skeleton__pill skeleton-block"></div>
					</div>
					<div class="popup-skeleton__meta-row popup-skeleton__meta-row--footer">
						<div class="popup-skeleton__pill skeleton-block"></div>
						<div class="popup-skeleton__pill skeleton-block"></div>
					</div>
				</div>
			{/each}
		</div>

		<div class="popup-skeleton__footer">
			<div class="popup-skeleton__line popup-skeleton__line--footer skeleton-block"></div>
		</div>
	</div>
</div>