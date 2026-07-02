<script lang="ts">
	import {
		Check,
		Copy,
		ExternalLink,
		FileDiff,
		FolderGit2,
		GitBranch,
		Ticket,
		Clock,
	} from 'lucide-svelte';
	import SectionCard from '../lib/components/SectionCard.svelte';
	import {
		extractJiraTicket,
		getCheckStatusDisplay,
		getJiraUrl,
		getReviewStatusDisplay,
		isValidHttpUrl,
		safeParseInt,
		formatLocalDateTime,
		formatPrAge,
	} from '../../lib/utils';
	import type { PullRequest, Settings } from '../../lib/types';

	type PullRequestCardSettings = Pick<Settings, 'jiraBaseUrl'>;

	interface Props {
		pr: PullRequest;
		isFullpageMode?: boolean;
		settings?: PullRequestCardSettings;
		copiedItemId?: string | null;
		onOpenUrl?: (url: string) => void;
		onCopy?: (value: string, id: string) => void;
	}

	let {
		pr,
		isFullpageMode = false,
		settings = { jiraBaseUrl: '' },
		copiedItemId = null,
		onOpenUrl = () => {},
		onCopy = () => {}
	}: Props = $props();

	function getCheckToneClass(className: string) {
		switch (className) {
			case 'checks-success':
				return 'status-inline-success';
			case 'checks-failure':
				return 'status-inline-danger';
			case 'checks-pending':
				return 'status-inline-warning';
			default:
				return 'status-inline-neutral';
		}
	}

	function getReviewToneClass(className: string) {
		switch (className) {
			case 'status-approved':
				return 'status-inline-success';
			case 'status-changes':
				return 'status-inline-danger';
			default:
				return 'status-inline-warning';
		}
	}

	function getDotToneClass(className: string) {
		switch (className) {
			case 'checks-success':
			case 'status-approved':
				return 'status-dot-success';
			case 'checks-failure':
			case 'status-changes':
				return 'status-dot-danger';
			case 'checks-pending':
			case 'status-pending':
				return 'status-dot-warning';
			default:
				return 'status-dot-neutral';
		}
	}

	function getBranchUrl(pr: PullRequest) {
		if (!pr?.repoFullName || !pr?.branchName) {
			return null;
		}

		return `https://github.com/${pr.repoFullName}/tree/${encodeURIComponent(pr.branchName)}`;
	}

	function getJiraLink(pr: PullRequest) {
		const jiraTicket = extractJiraTicket(pr.branchName);
		if (!jiraTicket || !settings.jiraBaseUrl) {
			return null;
		}

		const jiraUrl = getJiraUrl(jiraTicket, settings.jiraBaseUrl);
		if (!isValidHttpUrl(jiraUrl)) {
			return null;
		}

		return { ticket: jiraTicket, url: jiraUrl };
	}

	function getCardStatusClass(pr: PullRequest) {
		if (pr.isDraft) {
			return 'pr-card-draft';
		}

		const checksStatus = pr.checks?.status;
		const checksOk = !checksStatus || checksStatus === 'success' || checksStatus === 'unknown';
		const reviewOk = pr.reviews?.status === 'approved';

		if (checksOk && reviewOk) {
			return 'pr-card-success';
		}

		if (!checksOk && !reviewOk) {
			return 'pr-card-danger';
		}

		return 'pr-card-warning';
	}

	let reviewDisplay = $derived(getReviewStatusDisplay(pr.reviews?.status, pr.reviews?.openThreadCount));
	let checkDisplay = $derived(getCheckStatusDisplay(pr.checks?.status));
	let jiraLink = $derived(getJiraLink(pr));
	let branchUrl = $derived(getBranchUrl(pr));
	let createdAtText = $derived(formatLocalDateTime(pr.createdAt));
	let statusRowClasses = $derived(isFullpageMode
		? 'flex flex-wrap gap-x-5 gap-y-1.5 text-xs'
		: 'flex min-w-0 items-center gap-2.5 text-xs');
	let checkStatusClasses = $derived(isFullpageMode
		? 'unstyled-button status-inline group'
		: 'unstyled-button status-inline min-w-0 group');
	let reviewUrl = $derived(
		pr.reviews?.status === 'changes_requested'
			? (pr.reviews?.changesRequestedReviewId
				? `${pr.url}#pullrequestreview-${pr.reviews.changesRequestedReviewId}`
				: `${pr.url}/files`)
			: pr.url
	);
</script>

<SectionCard className={`p-3.5 transition-opacity pr-card-status ${getCardStatusClass(pr)} ${pr.isDraft ? 'opacity-80' : ''}`}>
	<div class="min-w-0 space-y-1.5">
		<div class="relative min-w-0 pr-6">
			<div class="flex min-w-0 items-start gap-1.5">
				<button class="unstyled-button pr-title-link group flex min-w-0 flex-1 items-start gap-2.5 text-left text-white" onclick={() => onOpenUrl(pr.url)}>
					<img src={pr.author?.avatarUrl || '../icons/icon128.png'} alt={pr.author?.name || pr.author?.login} title={pr.author?.name || pr.author?.login} class="mt-0.5 h-5 w-5 rounded-full object-cover shrink-0" />
					<span class={`line-clamp-2 min-w-0 wrap-break-word group-hover:underline group-hover:text-(--accent) group-hover:decoration-(--accent) decoration-[0.14em] ${pr.isDraft ? 'text-soft/90' : ''}`}>
						{pr.title}
					</span>
				</button>
				{#if pr.isDraft}
					<span class="mt-0.5 inline-flex shrink-0 items-center rounded border border-soft/20 bg-soft/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-soft leading-none">Draft</span>
				{/if}
			</div>
			<button class="unstyled-button metadata-copy-button absolute right-0 top-0" type="button" onclick={() => onCopy(pr.url, `pr-${pr.id}`)} aria-label="Copy PR link" title="Copy PR link">
				{#if copiedItemId === `pr-${pr.id}`}
					<Check class="metadata-copy-icon text-(--success)" />
				{:else}
					<Copy class="metadata-copy-icon" />
				{/if}
			</button>
		</div>

		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-soft">
			<button class="unstyled-button action-chip" onclick={() => onOpenUrl(`https://github.com/${encodeURI(pr.repoFullName || '')}`)}>
				<FolderGit2 class="metadata-repo-icon h-3.5 w-3.5" />
				<span class="hyperlink-text metadata-repo">{pr.repoFullName}</span>
			</button>
			<span aria-hidden="true" class="text-dim">•</span>
			<button class="unstyled-button action-chip" onclick={() => onOpenUrl(`${pr.url}/changes`)}>
				<FileDiff class="metadata-diff-icon h-3.5 w-3.5" />
				<span class="metadata-diff">
					<span class="metadata-diff-add">+{safeParseInt(pr.changes?.additions, 0)}</span>
					<span class="metadata-diff-del">-{safeParseInt(pr.changes?.deletions, 0)}</span>
				</span>
			</button>
		</div>

		{#if jiraLink || branchUrl}
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-soft">
				{#if jiraLink}
				<button class="unstyled-button action-chip" onclick={() => onOpenUrl(jiraLink.url)}>
					<Ticket class="metadata-jira-icon h-3.5 w-3.5" />
					<span class="hyperlink-text metadata-jira">{jiraLink.ticket}</span>
				</button>
				{/if}
				{#if jiraLink && branchUrl}
					<span aria-hidden="true" class="text-dim">•</span>
				{/if}
				{#if branchUrl}
				<div class="flex items-center gap-0.5">
					<button class="unstyled-button action-chip" onclick={() => onOpenUrl(branchUrl)}>
						<GitBranch class="metadata-branch-icon h-3.5 w-3.5" />
						<span class="hyperlink-text metadata-branch">{pr.branchName}</span>
					</button>
					<button class="unstyled-button metadata-copy-button" type="button" onclick={() => onCopy(pr.branchName, `branch-${pr.id}`)} aria-label="Copy branch name" title="Copy branch name">
						{#if copiedItemId === `branch-${pr.id}`}
							<Check class="metadata-copy-icon text-(--success)" />
						{:else}
							<Copy class="metadata-copy-icon" />
						{/if}
					</button>
				</div>
				{/if}
			</div>
		{/if}

		<div class="border-t border-soft pt-2.5">
			<div class={statusRowClasses}>
				<button
					class={`${checkStatusClasses} ${getCheckToneClass(checkDisplay.className)}`}
					onclick={() => onOpenUrl(`${pr.url}/checks`)}
				>
					<span class={`status-dot ${getDotToneClass(checkDisplay.className)}`}></span>
					<span class="status-inline-label">{checkDisplay.label}</span>
					<ExternalLink class="status-link-icon h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
				</button>
				<button
				class={`unstyled-button status-inline min-w-0 group ${getReviewToneClass(reviewDisplay.className)}`}
					onclick={() => onOpenUrl(reviewUrl)}
				>
					<span class={`status-dot ${getDotToneClass(reviewDisplay.className)}`}></span>
					<span class="status-inline-label">{reviewDisplay.label}</span>
					<ExternalLink class="status-link-icon h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
				</button>
				<div class="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-none text-dim" title={createdAtText}>
					<Clock class="h-3 w-3" />
					<span>{formatPrAge(pr.createdAt)}</span>
				</div>
			</div>
		</div>
	</div>
</SectionCard>
