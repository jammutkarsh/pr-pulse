<script lang="ts">
	import { ArrowRight, Eye, EyeOff, Github } from 'lucide-svelte';
	import Button from '../../lib/components/Button.svelte';
	import SectionCard from '../../lib/components/SectionCard.svelte';
	import type { StoredProviderConfig } from '../../../lib/types';

	type VoidCallback = () => void;
	type StringCallback = (value: string) => void;

	interface Props {
		token?: string;
		tokenVisible?: boolean;
		testingConnection?: boolean;
		providerData?: StoredProviderConfig | null;
		onTestConnection?: VoidCallback;
		onNext?: VoidCallback;
		onTokenChange?: StringCallback;
		onToggleTokenVisible?: VoidCallback;
	}

	let {
		token = '',
		tokenVisible = false,
		testingConnection = false,
		providerData = null,
		onTestConnection = () => {},
		onNext = () => {},
		onTokenChange = () => {},
		onToggleTokenVisible = () => {}
	}: Props = $props();

	function handlePrimaryAction() {
		if (providerData) {
			onNext();
			return;
		}
		onTestConnection();
	}
</script>

<SectionCard className="p-6">
	<div class="space-y-4">
		<div class="flex items-center gap-3">
			<div class="accent-surface rounded-lg border p-3 text-(--accent)">
				<Github class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-xl font-semibold text-white">Connect to GitHub</h2>
				<p class="text-sm text-soft">Authenticate once, then let the background worker keep your PRs fresh.</p>
			</div>
		</div>

		<div class="space-y-3">
			<div class="relative">
				<input class="field-input pr-12" type={tokenVisible ? 'text' : 'password'} value={token} oninput={(e) => onTokenChange(e.currentTarget.value)} placeholder="ghp_xxxxxxxxxxxxxxxxx" autocomplete="off" />
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 text-soft transition hover:text-white"
					onclick={onToggleTokenVisible}
					aria-label={tokenVisible ? 'Hide token' : 'Show token'}
					aria-pressed={tokenVisible}
					title={tokenVisible ? 'Hide token' : 'Show token'}
				>
					{#if tokenVisible}
						<EyeOff class="h-4 w-4" />
					{:else}
						<Eye class="h-4 w-4" />
					{/if}
				</button>
			</div>
			<p class="text-sm text-soft">Need a token? <a class="text-(--accent) underline" href="https://github.com/settings/tokens/new?scopes=repo&description=PR%20Pulse" target="_blank" rel="noopener noreferrer">Create one here</a>.</p>
		</div>

		{#if providerData}
			<div class="accent-surface rounded-lg border p-4">
				<div class="flex items-center gap-3">
					<img src={providerData.user.avatarUrl} alt="Avatar" class="h-12 w-12 rounded-2xl border border-soft object-cover" />
					<div>
						<div class="text-sm font-semibold text-white">{providerData.user.name || providerData.user.login}</div>
						<div class="text-xs text-soft">@{providerData.user.login}</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="flex flex-wrap gap-3">
			<Button onclick={handlePrimaryAction} disabled={testingConnection}>
				{testingConnection ? 'Testing connection...' : providerData ? 'Continue' : 'Test connection'}
				<ArrowRight class="h-4 w-4" />
			</Button>
		</div>
	</div>
</SectionCard>
