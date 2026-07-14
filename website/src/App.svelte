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
	} from 'lucide-svelte';
	import PopupDemo from './lib/PopupDemo.svelte';
	import { fetchUserPrs, fetchStars, RateLimitError, type UserPrs } from './lib/github';
	import { myPRs as sampleMy, reviewRequests as sampleReview } from './lib/mockData';
	import type { PullRequest } from '../../extension/lib/types';

	const logo = '/icon.png'; // served from website/public
	const CHROME = 'https://short.utkarshchourasia.in/prpulse';
	const FIREFOX = 'https://short.utkarshchourasia.in/prpulse-firefox';
	const REPO = 'https://github.com/jammutkarsh/pr-pulse';
	const DEFAULT_USER = 'jammutkarsh';
	const STORAGE_KEY = 'prpulse:last-username';
	const CACHE_TTL_MS = 60 * 60 * 1000; // 60 min — matches "refreshed every 60mins or on refresh"

	// Brand SVG marks (simple-icons paths), rendered white on the install buttons.
	const CHROME_PATH =
		'M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z';
	const FIREFOX_PATH =
		'M8.824 7.287c.008 0 .004 0 0 0zm-2.8-1.4c.006 0 .003 0 0 0zm16.754 2.161c-.505-1.215-1.53-2.528-2.333-2.943.654 1.283 1.033 2.57 1.177 3.53l.002.02c-1.314-3.278-3.544-4.6-5.366-7.477-.091-.147-.184-.292-.273-.446a3.545 3.545 0 01-.13-.24 2.118 2.118 0 01-.172-.46.03.03 0 00-.027-.03.038.038 0 00-.021 0l-.006.001a.037.037 0 00-.01.005L15.624 0c-2.585 1.515-3.657 4.168-3.932 5.856a6.197 6.197 0 00-2.305.587.297.297 0 00-.147.37c.057.162.24.24.396.17a5.622 5.622 0 012.008-.523l.067-.005a5.847 5.847 0 011.957.222l.095.03a5.816 5.816 0 01.616.228c.08.036.16.073.238.112l.107.055a5.835 5.835 0 01.368.211 5.953 5.953 0 012.034 2.104c-.62-.437-1.733-.868-2.803-.681 4.183 2.09 3.06 9.292-2.737 9.02a5.164 5.164 0 01-1.513-.292 4.42 4.42 0 01-.538-.232c-1.42-.735-2.593-2.121-2.74-3.806 0 0 .537-2 3.845-2 .357 0 1.38-.998 1.398-1.287-.005-.095-2.029-.9-2.817-1.677-.422-.416-.622-.616-.8-.767a3.47 3.47 0 00-.301-.227 5.388 5.388 0 01-.032-2.842c-1.195.544-2.124 1.403-2.8 2.163h-.006c-.46-.584-.428-2.51-.402-2.913-.006-.025-.343.176-.389.206-.406.29-.787.616-1.136.974-.397.403-.76.839-1.085 1.303a9.816 9.816 0 00-1.562 3.52c-.003.013-.11.487-.19 1.073-.013.09-.026.181-.037.272a7.8 7.8 0 00-.069.667l-.002.034-.023.387-.001.06C.386 18.795 5.593 24 12.016 24c5.752 0 10.527-4.176 11.463-9.661.02-.149.035-.298.052-.448.232-1.994-.025-4.09-.753-5.844z';

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
	function readCache(name: string): UserPrs | null {
		try {
			const raw = localStorage.getItem(cacheKey(name));
			if (!raw) return null;
			const { data, ts } = JSON.parse(raw) as { data: UserPrs; ts: number };
			return Date.now() - ts > CACHE_TTL_MS ? null : data;
		} catch {
			return null;
		}
	}
	function writeCache(name: string, data: UserPrs) {
		try {
			localStorage.setItem(cacheKey(name), JSON.stringify({ data, ts: Date.now() }));
		} catch {
			/* ignore */
		}
	}

	function useSample() {
		activeUsername = DEFAULT_USER;
		myPRs = sampleMy;
		reviewRequests = sampleReview;
		isSample = true;
		isRateLimited = false;
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
			if (silent) {
				useSample();
				return;
			}
			activeUsername = username;
			myPRs = [];
			reviewRequests = [];
			isSample = false;
			isRateLimited = err instanceof RateLimitError;
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
				if (entry.isIntersecting) {
					taxVisible = true;
					observer.disconnect();
				}
			},
			{ threshold: 0.4 },
		);
		observer.observe(taxSection);
		return () => observer.disconnect();
	});

	function fmtStars(n: number) {
		return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
	}

	const features = [
		{ tag: 'Speed', icon: MousePointerClick, title: 'Single Click, every repo', body: 'Everything that needs you in a single popup. No repo-hopping, no tab switching, no waiting on page loads.' },
		{ tag: 'Search', icon: SearchCode, title: 'Find it as you type', body: 'Fuzzy search across every repo by title, branch, author, or Jira ticket the moment you start typing.' },
		{ tag: 'Filters', icon: SlidersHorizontal, title: 'Filters that stay put', body: 'By owner, repo, author, draft state, and review status — remembered per tab, exactly how you left them.' },
		{ tag: 'Signal', icon: Zap, title: 'Status at a glance', body: 'CI checks and review state live on each card, color-coded. Know what to act on without opening anything.' },
		{ tag: 'Privacy', icon: ShieldCheck, title: 'Local-first, always', body: 'Your token and data stay in browser storage. PR Pulse talks straight to GitHub — no third-party server.' },
		{ tag: 'Reach', icon: Github, title: 'Chrome and Firefox', body: 'The same dashboard in both browsers. Free, open source, and shipped as a real extension.' },
	];

	const tax = ['open github', 'pick a repo', 'find pull requests', 'check status', 'go back', 'switch repo'];

	// The strike-through / chip animation plays once, the moment the section
	// actually scrolls into view — not at page load, which is long over by the
	// time a visitor scrolls down.
	let taxSection: HTMLElement | undefined = $state();
	let taxVisible = $state(false);
	let popupSection: HTMLElement | undefined = $state();

	const faqs = [
		{
			q: 'Didn’t GitHub just ship this?',
			a: 'GitHub’s <a href="https://github.blog/changelog/2026-07-09-new-pull-requests-dashboard-is-now-generally-available/" class="text-[color:var(--accent)] underline decoration-1 underline-offset-2">native pull requests dashboard</a> is good — but it still lives behind a site visit, a search, and a set of filters you re-apply every time. PR Pulse was never about a prettier list. It’s about the feedback loop: single click from any tab, no page load, filters already where you left them. Fewer steps beats another place to go.',
		},
		{
			q: 'Can I see private PRs?',
			a: `Yes — <a href="${CHROME}" class="text-[color:var(--accent)] underline decoration-1 underline-offset-2">install PR Pulse</a> and connect a GitHub token during setup. The token and every request stay on your device — nothing routes through a server.`,
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
		class={`btn-brand inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold text-white no-underline ${size === 'lg' ? 'px-6 py-3.5' : 'px-5 py-3'}`}
	>
		<svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true"><path fill="currentColor" d={CHROME_PATH} /></svg>
		Add to Chrome
	</a>
	<a
		href={FIREFOX}
		class={`btn-brand inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold text-white no-underline ${size === 'lg' ? 'px-6 py-3.5' : 'px-5 py-3'}`}
	>
		<svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true"><path fill="currentColor" d={FIREFOX_PATH} /></svg>
		Add to Firefox
	</a>
{/snippet}

<div class="relative min-h-screen overflow-x-hidden">
	<div class="pointer-events-none absolute inset-x-0 top-0 h-[900px] grid-bg"></div>

	<div class="relative mx-auto max-w-6xl px-4 sm:px-6">
		<!-- nav -->
		<nav class="flex items-center justify-between gap-3 py-5">
			<span class="brand-mark relative flex items-center gap-2.5 font-semibold tracking-tight text-white">
				<img src={logo} alt="PR Pulse" class="h-8 w-8 rounded-lg" />
				<span class="text-[15px]">PR Pulse</span>
			</span>
			<a
				href={REPO}
				class="group inline-flex items-center gap-2 rounded-lg border border-soft px-3 py-2 text-sm text-soft no-underline transition hover:border-[color:var(--border-strong)] hover:text-white"
			>
				<Github class="h-4 w-4" />
				<span>Star us on GitHub</span>
				{#if stars !== null}
					<span class="mono flex items-center gap-1 border-l border-soft pl-2 text-xs tabular-nums text-soft transition group-hover:border-[color:var(--border-strong)] group-hover:text-white">
						<Star class="h-3 w-3 fill-[color:var(--warning)] text-[color:var(--warning)]" />{fmtStars(stars)}
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
					<div class="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--bg-panel)] p-1.5 focus-within:border-[color:var(--accent)]">
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
				<div class="glow relative mx-auto w-full max-w-[420px] lg:mx-0">
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
			<div bind:this={taxSection} class={`tax mono mt-9 flex flex-col items-start gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5 sm:gap-y-2 ${taxVisible ? 'play' : ''}`}>
				{#each tax as step, i}
					<span class="strike" style="--strike-delay:{i * 0.55}s">{step}</span>
					<span class="tax-arrow text-dim" style="--arrow-delay:{i * 0.55 + 0.5}s" aria-hidden="true">→</span>
				{/each}
				<span class="single-click-anim brand-chip inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-semibold" style="animation-delay:{tax.length * 0.55 + 0.5}s">
					<MousePointerClick class="h-4 w-4" /> Single Click
					<span class="single-click-sparkle"></span>
					<span class="single-click-sparkle"></span>
					<span class="single-click-sparkle"></span>
					<span class="single-click-sparkle"></span>
					<span class="single-click-sparkle"></span>
					<span class="single-click-sparkle"></span>
				</span>
			</div>
		</section>

		<!-- features -->
		<section class="py-14 sm:py-16">
			<h2 class="display text-3xl sm:text-4xl">Built to remove a ritual, not add a tool.</h2>
			<div class="mt-9 grid gap-px overflow-hidden rounded-2xl border border-soft bg-[color:var(--border-soft)] sm:grid-cols-2 lg:grid-cols-3">
				{#each features as f (f.title)}
					<div class="card-hover bg-[color:var(--bg-panel)] p-6 sm:p-7">
						<div class="flex items-center justify-between">
							<f.icon class="h-5 w-5 text-[color:var(--accent)]" />
							<span class="eyebrow">{f.tag}</span>
						</div>
						<h3 class="mt-4 font-semibold text-white">{f.title}</h3>
						<p class="mt-2 text-sm leading-relaxed text-soft">{f.body}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- FAQ -->
		<section class="py-14 sm:py-16">
			<h2 class="display text-3xl sm:text-4xl">FAQ</h2>
			<div class="mt-9 divide-y divide-[color:var(--border-soft)] overflow-hidden rounded-2xl border border-soft bg-[color:var(--bg-panel)]">
				{#each faqs as f, i (f.q)}
					<details class="faq-item group" open={i === 0}>
						<summary class="flex cursor-pointer list-none items-center gap-4 p-6 font-semibold text-white marker:content-none sm:p-7">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-soft text-dim transition group-hover:border-[color:var(--border-strong)] group-hover:text-white">
								<CircleQuestionMark class="h-3.5 w-3.5" />
							</span>
							<span class="flex-1">{f.q}</span>
							<span class="mono shrink-0 text-dim transition-transform duration-200 group-open:rotate-45">+</span>
						</summary>
						<div class="px-6 pb-6 sm:px-7 sm:pb-7">
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
