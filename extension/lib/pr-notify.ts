import type { PrSourceResult, PullRequest, PullRequestData } from './types';

// What changed since the last poll, and what to say about it. Kept pure and polyfill-free for the
// same reason `pr-view.ts` is: the rules are the interesting part, and none of them need a browser.
// The service worker only wires this to `notifications.create`.
//
// Filters are deliberately not consulted. A filter is a preference about what the dashboard shows,
// not a statement about what is worth interrupting you for.

export type NotifyKind = 'review_requested' | 'approved' | 'changes_requested' | 'ci_failed' | 'ci_recovered' | 'closed';

/** Where a grouped notification points. The worker swaps it for a `runtime.getURL`, which this module cannot call. */
export const DASHBOARD_URL = 'popup/popup.html?fullpage=1';

export interface NotifySpec {
	kind: NotifyKind;
	/**
	 * `${kind}|${url}`. The click target rides inside the id because MV3 can tear the worker down
	 * between firing a notification and the user clicking it — an in-memory map would not survive.
	 * Re-notifying about the same PR reuses the id, so the OS replaces rather than stacks.
	 */
	id: string;
	title: string;
	message: string;
	/** Label for button 0. Button 1 is always Dismiss, added by the caller. */
	action: string;
	/** The dimmed third line: how big the PR is. Absent on grouped notifications, which span several. */
	detail?: string;
	url: string;
}

interface Event {
	kind: NotifyKind;
	pr: PullRequest;
	title: string;
	message: string;
	action: string;
	url: string;
}

/** How big the change is, in the shape a diff is usually read: `+30 −40 · 3 files`. */
function sizeOf(pr: PullRequest): string {
	const { additions, deletions, filesChanged } = pr.changes;
	const files = filesChanged ? ` · ${filesChanged} file${filesChanged === 1 ? '' : 's'}` : '';

	return `+${additions} −${deletions}${files}`;
}

function byId(items: PullRequest[] | undefined): Map<string, PullRequest> {
	return new Map((items || []).map((pr) => [pr.id, pr]));
}

function label(pr: PullRequest): string {
	return `${pr.repoFullName} #${pr.number}`;
}

/** Whoever's verdict this is. The reviewer list is already deduped to one entry per login. */
function reviewerWith(pr: PullRequest, state: string): string {
	const reviewer = pr.reviews.reviewers?.find((entry) => entry.state === state);
	return reviewer ? `@${reviewer.login}` : 'A reviewer';
}

function reviewRequestEvent(pr: PullRequest, since: number): Event {
	// A PR that did not exist at the last poll is a new ask on new work; an older one means someone
	// added you to something already in flight. Same notification, different sentence.
	const isNew = Date.parse(pr.createdAt) > since;
	const verb = isNew ? 'opened a PR for your review' : 'requested your review';

	return {
		kind: 'review_requested',
		pr,
		title: label(pr),
		message: `@${pr.author.login} ${verb} · ${pr.title}`,
		action: 'Review',
		url: pr.url,
	};
}

function reviewStatusEvent(previous: PullRequest, next: PullRequest): Event | null {
	if (previous.reviews.status === next.reviews.status) {
		return null;
	}

	if (next.reviews.status === 'approved') {
		return {
			kind: 'approved',
			pr: next,
			title: label(next),
			message: `${reviewerWith(next, 'APPROVED')} approved your pull request`,
			action: 'Open',
			url: next.url,
		};
	}

	if (next.reviews.status === 'changes_requested') {
		const open = next.reviews.openThreadCount;
		const threads = open ? ` · ${open} open thread${open === 1 ? '' : 's'}` : '';

		return {
			kind: 'changes_requested',
			pr: next,
			title: label(next),
			message: `${reviewerWith(next, 'CHANGES_REQUESTED')} requested changes${threads}`,
			action: 'Open',
			// The deep link to the first thread still needing an answer, when the provider found one.
			url: next.reviews.firstUnresolvedThreadUrl || next.url,
		};
	}

	// Falling back to `pending` — a re-request, or a dismissed review. Nothing to interrupt anyone for.
	return null;
}

function checksEvent(previous: PullRequest, next: PullRequest): Event | null {
	const from = previous.checks.status;
	const to = next.checks.status;

	// `unknown` means "no rollup", not "no failures". Treating it as a state would fire on every PR
	// the moment CI is first configured, and again whenever the rollup is briefly missing.
	if (from === to || from === 'unknown' || to === 'unknown') {
		return null;
	}

	if (to === 'failure') {
		return {
			kind: 'ci_failed',
			pr: next,
			title: label(next),
			message: `Checks failed · ${next.title}`,
			action: 'Open',
			url: next.url,
		};
	}

	if (from === 'failure' && to === 'success') {
		return {
			kind: 'ci_recovered',
			pr: next,
			title: label(next),
			message: 'Checks are passing again',
			action: 'Open',
			url: next.url,
		};
	}

	return null;
}

function collectEvents(previous: PullRequestData, next: PrSourceResult, me: string, since: number): Event[] {
	const events: Event[] = [];

	const previousReviewRequests = byId(previous.reviewRequests);
	for (const pr of next.reviewRequests || []) {
		// `reviewRequests` also carries PRs you have already reviewed (the provider merges
		// `reviewed-by:@me` into this list). Only an outstanding request is news.
		if (previousReviewRequests.has(pr.id) || !pr.reviews.pendingReviewers?.includes(me)) {
			continue;
		}

		events.push(reviewRequestEvent(pr, since));
	}

	const nextMine = byId(next.myPRs);
	for (const [id, previousPr] of byId(previous.myPRs)) {
		const nextPr = nextMine.get(id);

		if (!nextPr) {
			// Only your own PRs. A PR leaving `reviewRequests` usually just means the request was
			// withdrawn, which is not worth a notification.
			// ponytail: the search is `state:open`, so merged and closed are indistinguishable without a
			// second query. Add a `nodes(ids:)` lookup for the vanished ids if the wording matters.
			events.push({
				kind: 'closed',
				pr: previousPr,
				title: label(previousPr),
				message: 'No longer open — merged or closed',
				action: 'Open',
				url: previousPr.url,
			});
			continue;
		}

		const review = reviewStatusEvent(previousPr, nextPr);
		if (review) events.push(review);

		const checks = checksEvent(previousPr, nextPr);
		if (checks) events.push(checks);
	}

	return events;
}

function unique<T>(values: T[]): T[] {
	return Array.from(new Set(values));
}

const GROUP_HEADLINE: Record<NotifyKind, (count: number) => string> = {
	review_requested: (count) => `${count} PRs need your review`,
	approved: (count) => `${count} of your PRs were approved`,
	changes_requested: (count) => `${count} of your PRs need changes`,
	ci_failed: (count) => `Checks failed on ${count} of your PRs`,
	ci_recovered: (count) => `Checks are passing again on ${count} of your PRs`,
	closed: (count) => `${count} of your PRs are no longer open`,
};

/** What the batch has in common, if anything — the one detail worth keeping when the titles are gone. */
function groupDetail(events: Event[]): string {
	const repos = unique(events.map((event) => event.pr.repoFullName));
	if (repos.length === 1) {
		return `in ${repos[0]}`;
	}

	const authors = unique(events.map((event) => event.pr.author.login));
	if (authors.length === 1) {
		return `from @${authors[0]}`;
	}

	return `across ${repos.length} repos`;
}

function group(kind: NotifyKind, events: Event[]): NotifySpec {
	return {
		kind,
		id: `${kind}|${DASHBOARD_URL}`,
		title: GROUP_HEADLINE[kind](events.length),
		message: groupDetail(events),
		action: 'Open PR Pulse',
		url: DASHBOARD_URL,
	};
}

/**
 * The diff, as notifications. One per changed PR, except that several changes of the same kind in one
 * refresh collapse into a single count — a morning's backlog should be one line, not fifteen.
 */
export function notificationsFor(previous: PullRequestData, next: PrSourceResult, me: string): NotifySpec[] {
	// Nothing to diff against: a fresh install, or the first poll after a reset. Every open PR would
	// otherwise announce itself at once.
	if (previous.lastFetched === null || !me) {
		return [];
	}

	const events = collectEvents(previous, next, me, previous.lastFetched);
	const byKind = new Map<NotifyKind, Event[]>();

	for (const event of events) {
		const bucket = byKind.get(event.kind);
		if (bucket) {
			bucket.push(event);
		} else {
			byKind.set(event.kind, [event]);
		}
	}

	return Array.from(byKind, ([kind, bucket]) => {
		if (bucket.length > 1) {
			return group(kind, bucket);
		}

		const [event] = bucket;
		return {
			kind,
			id: `${kind}|${event.url}`,
			title: event.title,
			message: event.message,
			action: event.action,
			detail: sizeOf(event.pr),
			url: event.url,
		};
	});
}
