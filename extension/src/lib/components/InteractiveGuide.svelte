<script>
	import {
		Copy,
		FileDiff,
		FolderGit2,
		GitBranch,
		Ticket,
	} from "lucide-svelte";
	import SectionCard from "./SectionCard.svelte";

	let activeTooltip = $state(null);

	const tooltips = {
		title: "Opens Pull Request on GitHub",
		copyPR: "Copies PR link",
		repo: "Opens repository on GitHub",
		diff: "Opens PR files changed tab",
		jira: "Opens linked Jira ticket",
		branch: "Opens branch on GitHub",
		copyBranch: "Copies branch name",
		statusChecks: "Opens PR checks tab on GitHub",
		statusReview: "Shows review status",
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
	let legendHoverTone = $state(null); // 'success' | 'warning' | 'danger' | null

	const checkLabels = { success: 'All checks passed', warning: 'Checks pending', danger: 'Checks failed' };
	const reviewLabels = { success: 'Approved', warning: 'Review pending', danger: 'Changes requested' };

	let cardTitleDot = $derived(legendHoverTone ? `bg-(--${legendHoverTone})` : 'bg-(--success)');
	let cardCheckTone = $derived(legendHoverTone ? `status-inline-${legendHoverTone}` : 'status-inline-success');
	let cardCheckDot = $derived(legendHoverTone ? `status-dot-${legendHoverTone}` : 'status-dot-success');
	let cardCheckLabel = $derived(legendHoverTone ? checkLabels[legendHoverTone] : 'All checks passed');
	let cardReviewTone = $derived(legendHoverTone ? `status-inline-${legendHoverTone}` : 'status-inline-success');
	let cardReviewDot = $derived(legendHoverTone ? `status-dot-${legendHoverTone}` : 'status-dot-success');
	let cardReviewLabel = $derived(legendHoverTone ? reviewLabels[legendHoverTone] : 'Approved');

	let mouseX = $state(0);
	let mouseY = $state(0);

	function handleMousemove(e) {
		mouseX = e.clientX;
		mouseY = e.clientY;
	}
</script>

<svelte:window onmousemove={handleMousemove} />

<div class="relative mx-auto w-full select-none py-8">
	<!-- Tooltip Overlay -->
	{#if activeTooltip}
		<div
			class="pointer-events-none fixed z-50 max-w-50 -translate-x-1/2 -translate-y-[120%] rounded-lg border border-soft bg-(--bg-panel-strong) px-3 py-2 text-center text-xs text-white shadow-xl transition-opacity animate-in fade-in duration-200"
			style="left: {mouseX}px; top: {mouseY}px;"
		>
			{tooltips[activeTooltip]}
		</div>
	{/if}

	<div class="popup-content-width mx-auto w-full">
		<SectionCard className="p-3.5 relative">
			<div class="min-w-0 space-y-1.5">
				<div class="relative min-w-0 pr-6">
					<div class="flex min-w-0 items-start gap-1">
						<button
							class="unstyled-button flex min-w-0 items-start gap-1 hyperlink-button line-clamp-2 flex-1 overflow-hidden text-left text-sm font-semibold leading-[1.15rem] text-white hover:text-(--accent)"
							onmouseenter={() => (activeTooltip = "title")}
							onmouseleave={() => (activeTooltip = null)}
						>
							<span
								class={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-200 ${cardTitleDot}`}
							></span>
							feat(ui): implement modern interactive demo card
						</button>
					</div>
					<button
						class="unstyled-button metadata-copy-button absolute right-0 top-0 transition-colors hover:text-white"
						type="button"
						aria-label="Copy PR link"
						onmouseenter={() => (activeTooltip = "copyPR")}
						onmouseleave={() => (activeTooltip = null)}
					>
						<Copy class="metadata-copy-icon" />
					</button>
				</div>

				<div
					class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-soft"
				>
					<button
						class="unstyled-button action-chip"
						onmouseenter={() => (activeTooltip = "repo")}
						onmouseleave={() => (activeTooltip = null)}
						onclick={() =>
							window.open(
								"https://github.com/jammutkarsh/pr-pulse",
								"_blank",
							)}
					>
						<FolderGit2 class="metadata-repo-icon h-3.5 w-3.5" />
						<span class="hyperlink-text metadata-repo"
							>jammutkarsh/pr-pulse</span
						>
					</button>
					<span aria-hidden="true" class="text-dim">•</span>
					<button
						class="unstyled-button action-chip"
						onmouseenter={() => (activeTooltip = "diff")}
						onmouseleave={() => (activeTooltip = null)}
					>
						<FileDiff class="metadata-diff-icon h-3.5 w-3.5" />
						<span class="metadata-diff">
							<span class="metadata-diff-add">+42</span>
							<span class="metadata-diff-del">-12</span>
						</span>
					</button>
				</div>

				<div
					class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-soft"
				>
					<button
						class="unstyled-button action-chip"
						onmouseenter={() => (activeTooltip = "jira")}
						onmouseleave={() => (activeTooltip = null)}
					>
						<Ticket class="metadata-jira-icon h-3.5 w-3.5" />
						<span class="hyperlink-text metadata-jira">PULSE-1337</span>
					</button>
					<span aria-hidden="true" class="text-dim">•</span>
					<div class="flex items-center gap-0.5">
						<button
							class="unstyled-button action-chip"
							onmouseenter={() => (activeTooltip = "branch")}
							onmouseleave={() => (activeTooltip = null)}
						>
							<GitBranch class="metadata-branch-icon h-3.5 w-3.5" />
							<span class="hyperlink-text metadata-branch"
								>feat/PULSE-1337/interactive-demo</span
							>
						</button>
						<button
							class="unstyled-button metadata-copy-button"
							type="button"
							aria-label="Copy branch name"
							onmouseenter={() => (activeTooltip = "copyBranch")}
							onmouseleave={() => (activeTooltip = null)}
						>
							<Copy class="metadata-copy-icon" />
						</button>
					</div>
				</div>

				<div class="border-t border-soft pt-2.5">
					<div class="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
						<button
							class={`unstyled-button status-inline status-inline-button ${cardCheckTone} transition-all duration-200 hover:opacity-80`}
							onmouseenter={() => (activeTooltip = "statusChecks")}
							onmouseleave={() => (activeTooltip = null)}
						>
							<span class={`status-dot ${cardCheckDot} transition-colors duration-200`}></span>
							<span class="status-inline-label">{cardCheckLabel}</span>
						</button>
						<button
							class={`unstyled-button status-inline status-inline-button ${cardReviewTone} transition-all duration-200 hover:opacity-80`}
							onmouseenter={() => (activeTooltip = "statusReview")}
							onmouseleave={() => (activeTooltip = null)}
						>
							<span class={`status-dot ${cardReviewDot} transition-colors duration-200`}></span>
							<span class="status-inline-label">{cardReviewLabel}</span>
						</button>
					</div>
				</div>
			</div>
		</SectionCard>
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
