<script lang="ts">
	import { ArrowLeft, ArrowRight, Bell, BellOff } from 'lucide-svelte';
	import Button from '../../lib/components/Button.svelte';
	import RadioCard from '../../lib/components/RadioCard.svelte';
	import SectionCard from '../../lib/components/SectionCard.svelte';
	import type { Settings } from '../../../lib/types';
	import NotificationTest from '../../lib/components/NotificationTest.svelte';

	type VoidCallback = () => void;

	interface Props {
		notificationsEnabled?: Settings['notificationsEnabled'];
		onNotificationsChange?: (value: boolean) => void;
		onNext?: VoidCallback;
		onBack?: VoidCallback;
	}

	let {
		notificationsEnabled = null,
		onNotificationsChange = () => {},
		onNext = () => {},
		onBack = () => {}
	}: Props = $props();
</script>

<SectionCard className="p-6">
	<div class="step-row">
		<div class="step-icon">
			<Bell class="h-5 w-5" />
		</div>
		<div>
			<h2 class="step-heading">Stay in the loop</h2>
			<p class="desc">Get told when a PR needs you, without watching the toolbar badge. Your filters do not apply.</p>
		</div>
	</div>
	<div class="grid gap-3 md:grid-cols-2">
		<RadioCard name="notificationsEnabled" value={true} currentValue={notificationsEnabled ?? ''} title="Turn on" description="Review requests, review verdicts, CI failures and closed PRs. Your browser asks to confirm." iconComponent={Bell} onchange={() => onNotificationsChange(true)} />
		<RadioCard name="notificationsEnabled" value={false} currentValue={notificationsEnabled ?? ''} title="Not now" description="Stay quiet. The toolbar badge still updates, and you can turn these on later in Settings." iconComponent={BellOff} onchange={() => onNotificationsChange(false)} />
	</div>
	{#if notificationsEnabled}
		<NotificationTest className="mt-3" />
	{/if}
	<div class="step-actions">
		<Button variant="secondary" onclick={onBack}><ArrowLeft class="h-4 w-4" />Back</Button>
		<Button onclick={onNext}>Continue<ArrowRight class="h-4 w-4" /></Button>
	</div>
</SectionCard>
