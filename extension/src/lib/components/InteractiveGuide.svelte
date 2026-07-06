<script lang="ts">
	import { onMount } from 'svelte';
	import { storage } from '../../../lib/storage';
	import type { PullRequest } from '../../../lib/types';
	import PrCard from '../../popup/PrCard.svelte';
	import { copyToClipboard, isValidHttpUrl } from '../../../lib/utils';
	import { tabsCreate } from '../../../lib/extension-api';

	let activeTooltip = $state<string | null>(null);
	let realPr = $state<PullRequest | null>(null);
	let copiedItemId = $state<string | null>(null);

	const tooltips: Record<string, string> = {
		title: "Opens Pull Request on GitHub",
		copyPR: "Copies PR link",
		repo: "Opens repository on GitHub",
		diff: "Opens PR files changed tab",
		jira: "Opens linked Jira ticket",
		branch: "Opens branch on GitHub",
		copyBranch: "Copies branch name",
		statusChecks: "Opens PR checks tab on GitHub",
		statusReview: "Opens review on GitHub",
	};

	// Context-aware color legend based on which element is hovered
	const legendSets = {
		default: [
			{ tone: "status-inline-success", dot: "status-dot-success", label: "Passed / Approved" },
			{ tone: "status-inline-warning", dot: "status-dot-warning", label: "Pending / In review" },
			{ tone: "status-inline-danger", dot: "status-dot-danger", label: "Failed / Blocked" },
		],
		title: [
			{ tone: "status-inline-success", dot: "status-dot-success", label: "Ready to merge" },
			{ tone: "status-inline-warning", dot: "status-dot-warning", label: "Something is broken" },
			{ tone: "status-inline-danger", dot: "status-dot-danger", label: "Everything is broken" },
		],
		statusChecks: [
			{ tone: "status-inline-success", dot: "status-dot-success", label: "All checks passed" },
			{ tone: "status-inline-warning", dot: "status-dot-warning", label: "Checks pending" },
			{ tone: "status-inline-danger", dot: "status-dot-danger", label: "Checks failed" },
		],
		statusReview: [
			{ tone: "status-inline-success", dot: "status-dot-success", label: "Approved" },
			{ tone: "status-inline-warning", dot: "status-dot-warning", label: "Review pending" },
			{ tone: "status-inline-danger", dot: "status-dot-danger", label: "Changes requested" },
		],
	};

	let activeLegend = $derived(legendSets[activeTooltip] || legendSets.default);

	// When hovering a legend pill, override card colors and text
	let legendHoverTone = $state<string | null>(null);

	let mouseX = $state(0);
	let mouseY = $state(0);

	function handleMousemove(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
	}

	function handleMouseover(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const guideNode = target.closest('[data-guide-id]');
		if (guideNode) {
			activeTooltip = guideNode.getAttribute('data-guide-id');
		} else {
			activeTooltip = null;
		}
	}

	async function handleCopy(value: string, id: string) {
		await copyToClipboard(value);
		copiedItemId = id;
		setTimeout(() => {
			if (copiedItemId === id) {
				copiedItemId = null;
			}
		}, 1000);
	}

	onMount(async () => {
		try {
			const data = await storage.getPullRequests();
			if (data.myPRs && data.myPRs.length > 0) {
				realPr = data.myPRs[0];
			} else if (data.reviewRequests && data.reviewRequests.length > 0) {
				realPr = data.reviewRequests[0];
			}
		} catch {
			// ignore
		}
	});

	const mockPr: PullRequest = {
		id: 'mock-pr',
		url: 'https://github.com/jammutkarsh/pr-pulse/pull/1',
		title: 'feat(ui): implement modern interactive demo card',
		createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
		isDraft: false,
		provider: 'github',
		state: 'open',
		updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
		author: { login: 'demo', name: 'Demo Author', avatarUrl: '../icons/icon128.png' },
		repoFullName: 'jammutkarsh/pr-pulse',
		repoOwner: { login: 'jammutkarsh', type: 'user' },
		branchName: 'feat/PULSE-1337/interactive-demo',
		changes: { additions: 42, deletions: 12, filesChanged: 3 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'approved', reviewers: [], openThreadCount: 0 },
	};

	let displayPr = $derived.by(() => {
		const pr = { ...(realPr || mockPr) };
		
		if (legendHoverTone === 'success') {
			pr.checks = { ...pr.checks, status: 'success' };
			pr.reviews = { ...pr.reviews, status: 'approved' };
		} else if (legendHoverTone === 'warning') {
			pr.checks = { ...pr.checks, status: 'pending' };
			pr.reviews = { ...pr.reviews, status: 'pending' };
		} else if (legendHoverTone === 'danger') {
			pr.checks = { ...pr.checks, status: 'failure' };
			pr.reviews = { ...pr.reviews, status: 'changes_requested' };
		}
		
		return pr;
	});
</script>

<svelte:window onmousemove={handleMousemove} />

<div class="relative mx-auto w-full select-none py-8">
	<!-- Tooltip Overlay -->
	{#if activeTooltip}
		<div
			class="pointer-events-none fixed z-50 max-w-50 -translate-x-1/2 translate-y-[-120%] rounded-lg border border-soft bg-(--bg-panel-strong) px-3 py-2 text-center text-xs text-white shadow-xl transition-opacity animate-in fade-in duration-200"
			style="left: {mouseX}px; top: {mouseY}px;"
		>
			{tooltips[activeTooltip]}
		</div>
	{/if}

	<!-- svelte-ignore a11y_mouse_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="mx-auto w-full max-w-xl" onmouseover={handleMouseover}>
		<PrCard pr={displayPr} isFullpageMode={true} {copiedItemId} onOpenUrl={(url: string) => { if (isValidHttpUrl(url)) void tabsCreate({ url }); }} onCopy={handleCopy} />
	</div>

	<!-- Context-aware color legend — content changes based on hover, position stays fixed -->
	<div class="guide-legend-shell mx-auto mt-6 grid w-full grid-cols-3 gap-4 text-xs">
		{#each activeLegend as item, i (item.label)}
			<button
				type="button"
				class="unstyled-button flex min-h-10 w-full min-w-0 cursor-default items-center justify-center rounded-md px-2 py-1.5 transition-all duration-200 hover:bg-white/5"
				onmouseenter={() => (legendHoverTone = ['success', 'warning', 'danger'][i])}
				onmouseleave={() => (legendHoverTone = null)}
			>
				<span class={`status-inline ${item.tone} min-w-0`}>
					<span class={`status-dot ${item.dot} shrink-0`}></span>
					<span class="truncate">{item.label}</span>
				</span>
			</button>
		{/each}
	</div>
</div>
