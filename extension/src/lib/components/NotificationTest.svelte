<script lang="ts">
	import { BellRing } from 'lucide-svelte';
	import { BROWSER_LABEL, notificationsCreate } from '../../../lib/extension-api';
	import { DASHBOARD_URL } from '../../../lib/pr-notify';

	interface Props {
		className?: string;
	}

	let { className = '' }: Props = $props();

	// The OS can swallow a notification without any error reaching us, so the fallback line only shows
	// once one has actually been sent — before that there is nothing for the user to have missed.
	let sent = $state(false);
	let failure = $state('');

	async function sendTest() {
		failure = '';

		try {
			await notificationsCreate(`test|${DASHBOARD_URL}`, {
				title: 'Welcome to PR Pulse',
				message: 'Notifications are working.',
				action: 'Open PR Pulse',
			});
			sent = true;
		} catch (error) {
			console.error('Test notification failed:', error);
			failure = 'Could not send it. Turn notifications off and on again.';
		}
	}
</script>

<div class={`space-y-1 ${className}`}>
	<button class="inline-flex items-center gap-1.5 text-xs font-medium text-(--accent) hover:underline" onclick={sendTest}>
		<BellRing class="h-3.5 w-3.5" />
		Send test notification
	</button>
	{#if failure}
		<p class="text-xs text-(--danger)">{failure}</p>
	{:else if sent}
		<p class="text-xs text-soft">Didn't see it? Allow notifications for {BROWSER_LABEL} in your system settings.</p>
	{/if}
</div>
