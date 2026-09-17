import type { PrSource, PullRequest } from '../../../extension/lib/types';

// Static demo data shaped as real PullRequest objects so the actual extension
// components (PopupHeader, PrCard) render them exactly as they would in-browser.

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const avatar = (login: string) => `https://github.com/${login}.png?size=64`;

function pr(p: Partial<PullRequest> & Pick<PullRequest, 'id' | 'title' | 'repoFullName' | 'branchName'>): PullRequest {
	return {
		provider: 'github',
		number: Number(p.id.replace(/\D/g, '')) || 1,
		url: `https://github.com/${p.repoFullName}/pull/${p.id.replace(/\D/g, '') || '1'}`,
		repoOwner: { login: p.repoFullName!.split('/')[0], type: 'org' },
		author: { login: 'octocat', name: 'You', avatarUrl: avatar('octocat') },
		state: 'open',
		changes: { additions: 0, deletions: 0, filesChanged: 1 },
		checks: { status: 'success' },
		reviews: { status: 'approved', reviewers: [] },
		createdAt: hoursAgo(3),
		updatedAt: hoursAgo(1),
		isDraft: false,
		...p,
	} as PullRequest;
}

export const myPRs: PullRequest[] = [
	pr({
		id: 'm1',
		title: 'fix: retry GitHub API calls because github.com is down again',
		repoFullName: 'acme/web-app',
		branchName: 'fix/github-is-down-again',
		changes: { additions: 342, deletions: 58, filesChanged: 12 },
		checks: { status: 'success' },
		reviews: { status: 'approved', reviewers: [] },
		createdAt: hoursAgo(2),
	}),
	pr({
		id: 'm2',
		title: 'chore: add exponential backoff, github.com/notifications timed out again',
		repoFullName: 'acme/web-app',
		branchName: 'chore/notifications-backoff',
		changes: { additions: 24, deletions: 11, filesChanged: 2 },
		checks: { status: 'failure' },
		reviews: { status: 'changes_requested', reviewers: [], openThreadCount: 3 },
		createdAt: hoursAgo(5),
	}),
	pr({
		id: 'm3',
		title: 'chore: cache the PR list so we stop re-loading github.com every 4 seconds',
		repoFullName: 'acme/design-system',
		branchName: 'chore/stop-reloading-github',
		changes: { additions: 9, deletions: 214, filesChanged: 6 },
		checks: { status: 'pending' },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(26),
	}),
	pr({
		id: 'm4',
		title: 'wip: this extension, because clicking through github.com six times a day was the bug',
		repoFullName: 'acme/web-app',
		branchName: 'wip/pr-pulse-itself',
		changes: { additions: 88, deletions: 40, filesChanged: 4 },
		checks: { status: 'unknown' },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(72),
		isDraft: true,
	}),
];

export const reviewRequests: PullRequest[] = [
	pr({
		id: 'r1',
		title: 'perf: stop waiting on githubstatus.com before starting the work day',
		repoFullName: 'acme/web-app',
		branchName: 'perf/githubstatus-cache',
		author: { login: 'gaearon', name: 'Maya', avatarUrl: avatar('gaearon') },
		changes: { additions: 156, deletions: 32, filesChanged: 5 },
		checks: { status: 'success' },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(0.7),
	}),
	pr({
		id: 'r2',
		title: 'feat: dark mode, so the 500 page at least looks intentional',
		repoFullName: 'acme/design-system',
		branchName: 'feat/pretty-500-page',
		author: { login: 'sindresorhus', name: 'Devon', avatarUrl: avatar('sindresorhus') },
		changes: { additions: 210, deletions: 8, filesChanged: 9 },
		checks: { status: 'success' },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(3),
	}),
	pr({
		id: 'r3',
		title: 'refactor: replace GitHub Actions with literally anything that finishes',
		repoFullName: 'acme/api',
		branchName: 'refactor/ditch-actions',
		author: { login: 'yyx990803', name: 'Sam', avatarUrl: avatar('yyx990803') },
		changes: { additions: 401, deletions: 377, filesChanged: 18 },
		checks: { status: 'failure' },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(6),
	}),
];

/** The third adapter at the PrSource seam, so the demo's fallback is not a separate code path. */
export const sampleSource: PrSource = {
	getAllPullRequests: async () => ({ myPRs, reviewRequests }),
};
