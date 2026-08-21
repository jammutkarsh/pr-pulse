<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Github,
		Star,
		ArrowRight,
		Zap,
		SearchCode,
		SlidersHorizontal,
		ShieldCheck,
		MousePointerClick,
		CircleQuestionMark,
		Gauge,
	} from 'lucide-svelte';
	import PopupDemo from './lib/PopupDemo.svelte';
	import { fetchUserPrs, fetchStars, RateLimitError } from './lib/github';
	import type { PrSourceResult } from '../../extension/lib/types';
	import { myPRs as sampleMy, reviewRequests as sampleReview } from './lib/mockData';
	import type { PullRequest } from '../../extension/lib/types';

	const logo = '/icon.png'; // served from website/public
	const CHROME = 'https://short.utkarshchourasia.in/prpulse';
	const FIREFOX = 'https://short.utkarshchourasia.in/prpulse-firefox';
	const REPO = 'https://github.com/jammutkarsh/pr-pulse';
	const DEFAULT_USER = 'jammutkarsh';
	const STORAGE_KEY = 'prpulse:last-username';
	const CACHE_TTL_MS = 60 * 60 * 1000; // 60 min — matches "refreshed every 60mins or on refresh"

	let usernameInput = $state(DEFAULT_USER);
	let activeUsername = $state(DEFAULT_USER);
	let myPRs = $state<PullRequest[]>([]);
	let reviewRequests = $state<PullRequest[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');
	let isSample = $state(false);
	let isRateLimited = $state(false);
	let stars = $state<number | null>(null);

	function saveUsername(name: string) {
		try {
			localStorage.setItem(STORAGE_KEY, name);
		} catch {
			/* storage may be unavailable (private mode) — ignore */
		}
	}

	// Cache PR results per username for CACHE_TTL_MS so repeat visits (and the
	// per-visitor GitHub rate limit) aren't burned on every reload. A manual
	// refresh (force) always bypasses this.
	const cacheKey = (name: string) => `prpulse:cache:${name}`;
	function readCache(name: string): PrSourceResult | null {
		try {
			const raw = localStorage.getItem(cacheKey(name));
			if (!raw) return null;
			const { data, ts } = JSON.parse(raw) as { data: PrSourceResult; ts: number };
			return Date.now() - ts > CACHE_TTL_MS ? null : data;
		} catch {
			return null;
		}
	}
	function writeCache(name: string, data: PrSourceResult) {
		try {
			localStorage.setItem(cacheKey(name), JSON.stringify({ data, ts: Date.now() }));
		} catch {
			/* ignore */
		}
	}

	function useSample(rateLimited = false) {
		activeUsername = DEFAULT_USER;
		myPRs = sampleMy;
		reviewRequests = sampleReview;
		isSample = true;
		isRateLimited = rateLimited;
		errorMessage = '';
	}

	async function load(name: string, { silent = false, force = false } = {}) {
		const username = name.trim().replace(/^@/, '');

		if (!force) {
			const cached = readCache(username);
			if (cached) {
				activeUsername = username;
				myPRs = cached.myPRs;
				reviewRequests = cached.reviewRequests;
				isSample = false;
				isRateLimited = false;
				errorMessage = '';
				loading = false;
				saveUsername(username);
				return;
			}
		}

		loading = true;
		activeUsername = username;
		errorMessage = '';
		isRateLimited = false;
		try {
			const result = await fetchUserPrs(username);
			// On the default landing load, fall back to sample data if the account
			// has nothing open — the hero should never look dead.
			if (silent && result.myPRs.length === 0 && result.reviewRequests.length === 0) {
				useSample();
				return;
			}
			activeUsername = username;
			myPRs = result.myPRs;
			reviewRequests = result.reviewRequests;
			isSample = false;
			saveUsername(username);
			writeCache(username, result);
		} catch (err) {
			// GitHub's anonymous rate limit is the one failure mode a visitor can't
			// do anything about — show sample data instead of a dead end, same as
			// the silent default-load fallback above.
			if (silent || err instanceof RateLimitError) {
				useSample(err instanceof RateLimitError);
				return;
			}
			activeUsername = username;
			myPRs = [];
			reviewRequests = [];
			isSample = false;
			errorMessage = err instanceof Error ? err.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!usernameInput.trim()) return;
		void load(usernameInput);
		// On mobile the popup is stacked below the form, off-screen — jump to it.
		// Desktop shows both side by side already, so leave that layout alone.
		if (window.matchMedia('(max-width: 1023px)').matches) {
			popupSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	onMount(() => {
		let saved = DEFAULT_USER;
		try {
			saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_USER;
		} catch {
			/* ignore */
		}
		usernameInput = saved;
		void load(saved, { silent: saved === DEFAULT_USER });
		void fetchStars().then((s) => (stars = s));

		if (!taxSection) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				taxVisible = entry.isIntersecting;
			},
			{ threshold: 0.15 },
		);
		observer.observe(taxSection);
		return () => observer.disconnect();
	});

	function fmtStars(n: number) {
		return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
	}

	// `wide` cards take the full last row — 7 items in a 3-column grid would otherwise leave a hole.
	const features: Array<{ tag: string; icon: typeof Zap; title: string; body: string; wide?: boolean }> = [
		{ tag: 'Speed', icon: MousePointerClick, title: 'Single Click, every repo', body: 'Everything that needs you in a single popup. No repo-hopping, no tab switching, no waiting on page loads.' },
		{ tag: 'Search', icon: SearchCode, title: 'Find it as you type', body: 'Fuzzy search across every repo by title, branch, author, or Jira ticket the moment you start typing.' },
		{ tag: 'Filters', icon: SlidersHorizontal, title: 'Filters that stay put', body: 'By owner, repo, author, draft state, and review status — remembered per tab, exactly how you left them.' },
		{ tag: 'Signal', icon: Zap, title: 'Status at a glance', body: 'CI checks and review state live on each card, color-coded. Know what to act on without opening anything.' },
		{ tag: 'Privacy', icon: ShieldCheck, title: 'Local-first, always', body: 'Your token and data stay in browser storage. PR Pulse talks straight to GitHub — no third-party server.' },
		{ tag: 'Reach', icon: Github, title: 'Chrome and Firefox', body: 'The same dashboard in both browsers. Free, open source, and shipped as a real extension.' },
		{
			tag: 'Scale',
			icon: Gauge,
			title: 'Built on GraphQL — 96 open PRs, 4 requests',
			body: 'Your agents opened 96 pull requests overnight. The dashboard still refreshes in at most 4 calls — GraphQL hands back every pull request with its checks and reviews already attached, so more pull requests make the answer bigger, never the number of calls.',
			wide: true,
		},
	];

	const tax = ['open github', 'pick a repo', 'find pull requests', 'check status', 'go back', 'switch repo'];
	// Animation beats for the before/after panels: every step shows a short
	// "loading" pause (page loads take time), then gets struck out.
	const TAX_LOAD = 0.75;
	const TAX_STEP = 0.75;
	const badgeCount = $derived(myPRs.length + reviewRequests.length);

	// The strike-through / chip animation plays once, the moment the section
	// actually scrolls into view — not at page load, which is long over by the
	// time a visitor scrolls down.
	let taxSection: HTMLElement | undefined = $state();
	let taxVisible = $state(false);
	let popupSection: HTMLElement | undefined = $state();

	// Every answer starts expanded — the page should read straight through without the visitor
	// having to click anything open.
	const faqs = [
		{
			q: 'Didn’t GitHub just ship this?',
			a: 'GitHub’s <a href="https://github.blog/changelog/2026-07-09-new-pull-requests-dashboard-is-now-generally-available/" class="text-[color:var(--accent)] underline decoration-1 underline-offset-2">native pull requests dashboard</a> is good — but it still lives behind a site visit, a search, and a set of filters you re-apply every time. PR Pulse was never about a prettier list. It’s about the feedback loop: single click from any tab, no page load, filters already where you left them. Fewer steps beats another place to go.',
		},
		{
			q: 'Can I see private PRs?',
			a: `Yes — <a href="${CHROME}" class="text-[color:var(--accent)] underline decoration-1 underline-offset-2">install PR Pulse</a> and connect a GitHub token during setup.`,
		},
		{
			q: 'Will it burn through my GitHub rate limit?',
			a: 'No. A refresh is 4 calls at most: a quick count first, then one each for the pull requests you opened, the ones waiting on your review, and the ones you already reviewed. <a href="https://docs.github.com/en/graphql" class="text-[color:var(--accent)] underline decoration-1 underline-offset-2">GraphQL</a> sends each list back complete — checks, reviewers and all — so 96 pull requests arrive in the same single call as 4.',
		},
		{ q: 'Which platforms do you support?', a: 'GitHub, right now. Feel free to raise a PR for others.' },
		{
			q: 'Is this free?',
			a: 'Yes — and <a href="https://github.com/jammutkarsh/pr-pulse" class="text-[color:var(--accent)] underline decoration-1 underline-offset-2">open-source</a> as well.',
		},
		{
			q: 'What’s the tech stack?',
			a: '<a href="https://svelte.dev" class="text-[color:var(--accent)] underline decoration-1 underline-offset-2">Svelte</a>, because React is too hyped and bloated.',
		},
	];
</script>

{#snippet installButtons(size: 'base' | 'lg')}
	<a
		href={CHROME}
		class={`inline-flex items-center justify-center gap-2.5 rounded-xl border border-(--border-strong) bg-(--bg-panel) font-semibold text-soft no-underline transition hover:text-white ${size === 'lg' ? 'px-6 py-3.5' : 'px-5 py-3'}`}
	>
		<img src="/chrome.svg" alt="" class="h-5 w-5" />
		Add to Chrome
	</a>
	<a
		href={FIREFOX}
		class={`inline-flex items-center justify-center gap-2.5 rounded-xl border border-(--border-strong) bg-(--bg-panel) font-semibold text-soft no-underline transition hover:text-white ${size === 'lg' ? 'px-6 py-3.5' : 'px-5 py-3'}`}
	>
		<img src="/firefox.png" alt="" class="h-5 w-5" />
		Add to Firefox
	</a>
{/snippet}

<div class="relative min-h-screen overflow-x-hidden">
	<div class="pointer-events-none absolute inset-x-0 top-0 h-225 grid-bg"></div>

	<div class="relative mx-auto max-w-6xl px-4 sm:px-6">
		<!-- nav -->
		<nav class="flex items-center justify-between gap-3 py-5">
			<span class="brand-mark relative flex items-center gap-2.5 font-semibold tracking-tight text-white">
				<img src={logo} alt="PR Pulse" class="h-8 w-8 rounded-lg" />
				<span class="text-[15px]">PR Pulse</span>
			</span>
			<a
				href={REPO}
				class="group inline-flex items-center gap-2 rounded-lg border border-soft px-3 py-2 text-sm text-soft no-underline transition hover:border-(--border-strong) hover:text-white"
			>
				<Github class="h-4 w-4" />
				<span>Star us on GitHub</span>
				{#if stars !== null}
					<span class="mono flex items-center gap-1 border-l border-soft pl-2 text-xs tabular-nums text-soft transition group-hover:border-(--border-strong) group-hover:text-white">
						<Star class="h-3 w-3 fill-(--warning) text-(--warning)" />{fmtStars(stars)}
					</span>
				{/if}
			</a>
		</nav>

		<!-- hero: thesis left, live product right -->
		<section class="grid items-center gap-10 pt-8 pb-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pt-14">
			<div class="min-w-0">
				<p class="eyebrow">PR Pulse · browser extension</p>
				<h1 class="display mt-5 text-5xl sm:text-6xl lg:text-7xl">
					Say No to<br />Navigation
				</h1>
				<p class="mt-6 max-w-lg text-base leading-relaxed text-soft sm:text-lg">
					Open GitHub, pick a repo, find pull requests, check status, go back, switch repo, repeat. PR Pulse puts every
					PR that needs you <span class="text-white">a single click away</span> — right in your toolbar.
				</p>

				<!-- signature: try it with your own PRs -->
				<form onsubmit={submit} class="mt-8 max-w-md">
					<label for="ghuser" class="eyebrow">See it with your own pull requests</label>
					<div class="mt-2 flex items-center gap-2 rounded-xl border border-(--border-strong) bg-(--bg-panel) p-1.5 focus-within:border-(--accent)">
						<span class="mono pl-2.5 text-soft">@</span>
						<input
							id="ghuser"
							class="mono min-w-0 flex-1 bg-transparent py-1.5 text-white outline-none placeholder:text-dim"
							bind:value={usernameInput}
							placeholder="your-github-username"
							autocomplete="off"
							spellcheck="false"
						/>
						<button type="submit" class="btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium">
							Show PRs <ArrowRight class="h-4 w-4" />
						</button>
					</div>
					<p class="mono mt-2 text-xs text-dim">Reads public pull requests. No sign-in, nothing stored.</p>
				</form>

				<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					{@render installButtons('base')}
				</div>
			</div>

			<!-- live popup -->
			<div bind:this={popupSection} class="flex min-w-0 flex-col gap-3 lg:items-end">
				<div class="glow relative mx-auto w-full max-w-105 lg:mx-0">
					<PopupDemo
						username={activeUsername}
						{myPRs}
						{reviewRequests}
						{loading}
						{errorMessage}
						{isSample}
						{isRateLimited}
						installUrl={CHROME}
						onRefresh={() => load(activeUsername, { silent: isSample, force: true })}
					/>
				</div>
			</div>
		</section>

		<section class="py-14 sm:py-16">
			<h2 class="display text-3xl sm:text-4xl">The Navigation Dance</h2>
			<p class="mt-4 max-w-xl text-soft">
				Checking on your pull requests means the same six-step ritual — every repo, every time. PR Pulse retires the
				whole routine.
			</p>
			<div
				bind:this={taxSection}
				class={`tax mt-9 grid gap-px overflow-hidden rounded-2xl border border-soft bg-(--border-soft) sm:grid-cols-2 ${taxVisible ? 'play' : ''}`}
			>
				<div class="bg-(--bg-panel) p-6 sm:p-7">
					<p class="eyebrow">Without PR Pulse · 6 steps</p>
					<ol class="mono mt-5 flex flex-col gap-2.5 text-sm">
						{#each tax as step, i (step)}
							<li class="flex items-baseline gap-3">
								<span class="text-dim">0{i + 1}</span>
								<span class="strike" style="--strike-delay:{i * TAX_STEP + TAX_LOAD}s; --step-delay:{i * TAX_STEP}s">{step}</span>
								<span
									class="load-dots"
									style="animation-delay:{i * TAX_STEP}s; animation-duration:{TAX_LOAD}s"
									aria-hidden="true"
								></span>
							</li>
						{/each}
					</ol>
				</div>
				<div class="flex flex-col bg-(--bg-panel) p-6 sm:p-7">
					<p class="eyebrow">With PR Pulse · 1 step</p>
					<div class="flex flex-1 flex-col items-center justify-center gap-5 py-8">
						<button
							type="button"
							class="relative cursor-pointer p-0"
							onclick={() => popupSection?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
						>
							<img src={logo} alt="PR Pulse toolbar icon" class="h-12 w-12 rounded-xl" />
							{#if badgeCount > 0}
								<span
									class="absolute -right-1.25 -bottom-1.25 rounded-[5px] bg-[#238636] px-1 text-[11px] leading-4 font-semibold text-white {taxVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}"
									style="transition: opacity 0.3s ease-out 0.055s, transform 0.3s ease-out 0.055s"
								>
									{badgeCount}
								</span>
							{/if}
						</button>
						<p class="mono text-xs text-dim">
							click to open PR Pulse
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- features -->
		<section class="py-14 sm:py-16">
			<h2 class="display text-3xl sm:text-4xl">Built to remove a ritual, not add a tool.</h2>
			<div class="mt-9 grid gap-px overflow-hidden rounded-2xl border border-soft bg-(--border-soft) sm:grid-cols-2 lg:grid-cols-3">
				{#each features as f (f.title)}
					<div class={`card-hover bg-(--bg-panel) p-6 sm:p-7 ${f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
						<div class="flex items-center justify-between">
							<f.icon class="h-5 w-5 text-(--accent)" />
							<span class="eyebrow">{f.tag}</span>
						</div>
						<h3 class="mt-4 font-semibold text-white">{f.title}</h3>
						<p class={`mt-2 text-sm leading-relaxed text-soft ${f.wide ? 'max-w-3xl' : ''}`}>{f.body}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- FAQ -->
		<section class="py-14 sm:py-16">
			<h2 class="display text-3xl sm:text-4xl">FAQ</h2>
			<div class="mt-9 divide-y divide-(--border-soft) overflow-hidden rounded-2xl border border-soft bg-(--bg-panel)">
				{#each faqs as f (f.q)}
					<details class="faq-item group" open>
						<summary class="flex cursor-pointer list-none items-center gap-4 p-6 font-semibold text-white marker:content-none sm:p-7">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-soft text-dim transition group-hover:border-(--border-strong) group-hover:text-white">
								<CircleQuestionMark class="h-3.5 w-3.5" />
							</span>
							<span class="flex-1">{f.q}</span>
							<span class="mono shrink-0 text-dim transition-transform duration-200 group-open:rotate-45">+</span>
						</summary>
						<div class="px-6 pb-6 sm:px-7 sm:pb-7">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<p class="max-w-3xl pl-10 text-sm leading-relaxed text-soft">{@html f.a}</p>
						</div>
					</details>
				{/each}
			</div>
		</section>

		<!-- closing CTA -->
		<section class="py-20 text-center sm:py-24">
			<h2 class="display mx-auto max-w-2xl text-4xl sm:text-5xl">Stop navigating.<br class="sm:hidden" /> Start shipping.</h2>
			<p class="mx-auto mt-5 max-w-md text-soft">Add PR Pulse and get your pull request radar back in a single click.</p>
			<div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
				{@render installButtons('lg')}
			</div>
		</section>

		<footer class="flex flex-col items-center justify-between gap-4 border-t border-soft py-8 text-sm text-dim sm:flex-row">
			<span class="mono flex items-center gap-2">
				<img src={logo} alt="" class="h-5 w-5 rounded" /> © {new Date().getFullYear()} PR Pulse · MIT
			</span>
			<div class="flex items-center gap-5">
				<a href="https://utkarshchourasia.in" class="text-soft no-underline hover:text-white">Utkarsh Chourasia</a>
				<a href={REPO} class="inline-flex items-center gap-1.5 text-soft no-underline hover:text-white">
					<Github class="h-4 w-4" /> Source
				</a>
			</div>
		</footer>
	</div>
</div>
