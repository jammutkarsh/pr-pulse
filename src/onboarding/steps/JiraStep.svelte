<script lang="ts">
	import { ArrowLeft, ArrowRight, Link2 } from 'lucide-svelte';
	import Button from '../../lib/components/Button.svelte';
	import SectionCard from '../../lib/components/SectionCard.svelte';
	import { isValidHttpUrl } from '../../../lib/utils';

	type VoidCallback = () => void;

	interface Props {
		jiraBaseUrl?: string;
		onJiraUrlChange?: (value: string) => void;
		onNext?: VoidCallback;
		onBack?: VoidCallback;
	}

	let {
		jiraBaseUrl = '',
		onJiraUrlChange = () => {},
		onNext = () => {},
		onBack = () => {}
	}: Props = $props();

	let previewUrl = $derived(jiraBaseUrl && isValidHttpUrl(jiraBaseUrl) ? `${jiraBaseUrl}/browse/JIRA-1234` : '');
</script>

<SectionCard className="p-6">
	<div class="mb-5 flex items-center gap-3">
		<div class="rounded-2xl bg-white/6 p-3 text-white">
			<Link2 class="h-5 w-5" />
		</div>
		<div>
			<h2 class="text-xl font-semibold text-white">Connect Jira</h2>
			<p class="text-sm text-soft">Map branch names to ticket links now, or skip and configure it later from settings.</p>
		</div>
	</div>
	<div class="space-y-4">
		<input class="field-input" type="url" value={jiraBaseUrl} oninput={(e) => onJiraUrlChange(e.currentTarget.value)} placeholder="https://company.atlassian.net/browse/PROJ-123" />
		<div class="rounded-lg border border-soft bg-(--bg-panel) p-4 text-sm text-soft">
			<div class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-dim">Preview</div>
			<div class="flex flex-wrap items-center gap-2">
				<code class="rounded-lg bg-white/6 px-2 py-1 text-white">feat/JIRA-1234/login-flow</code>
				<span>→</span>
				{#if previewUrl}
					<a class="text-(--accent) underline" href={previewUrl} target="_blank" rel="noopener noreferrer">JIRA-1234</a>
				{:else}
					<span>No Jira configured</span>
				{/if}
			</div>
		</div>
	</div>
	<div class="mt-6 flex flex-wrap gap-3">
		<Button variant="secondary" onclick={onBack}><ArrowLeft class="h-4 w-4" />Back</Button>
		<Button onclick={onNext}>Continue<ArrowRight class="h-4 w-4" /></Button>
	</div>
</SectionCard>
