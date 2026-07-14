import type { PullRequest, StoredProviderConfig } from '../../../extension/lib/types';

// Static demo data shaped as real PullRequest objects so the actual extension
// components (PopupHeader, PrCard) render them exactly as they would in-browser.

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const avatar = (login: string) => `https://github.com/${login}.png?size=64`;

function pr(p: Partial<PullRequest> & Pick<PullRequest, 'id' | 'title' | 'repoFullName' | 'branchName'>): PullRequest {
	return {
		provider: 'github',
		url: `https://github.com/${p.repoFullName}/pull/${p.id.replace(/\D/g, '') || '1'}`,
		repoOwner: { login: p.repoFullName!.split('/')[0], type: 'org' },
		author: { login: 'octocat', name: 'You', avatarUrl: avatar('octocat') },
		state: 'open',
		changes: { additions: 0, deletions: 0, filesChanged: 1 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'approved', reviewers: [] },
		createdAt: hoursAgo(3),
		updatedAt: hoursAgo(1),
		isDraft: false,
		...p,
	} as PullRequest;
}

export const provider: StoredProviderConfig = {
	type: 'github',
	token: 'demo',
	user: { login: 'octocat', name: 'You', avatarUrl: avatar('octocat') },
};

export const myPRs: PullRequest[] = [
	pr({
		id: 'm1',
		title: 'feat: streaming token usage meter in the status bar',
		repoFullName: 'acme/web-app',
		branchName: 'feat/usage-meter',
		changes: { additions: 342, deletions: 58, filesChanged: 12 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'approved', reviewers: [] },
		createdAt: hoursAgo(2),
	}),
	pr({
		id: 'm2',
		title: 'fix: debounce search input to stop re-render storm',
		repoFullName: 'acme/web-app',
		branchName: 'fix/search-debounce',
		changes: { additions: 24, deletions: 11, filesChanged: 2 },
		checks: { status: 'failure', details: [] },
		reviews: { status: 'changes_requested', reviewers: [], openThreadCount: 3 },
		createdAt: hoursAgo(5),
	}),
	pr({
		id: 'm3',
		title: 'chore: bump vite to 8 and drop legacy polyfills',
		repoFullName: 'acme/design-system',
		branchName: 'chore/vite-8',
		changes: { additions: 9, deletions: 214, filesChanged: 6 },
		checks: { status: 'pending', details: [] },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(26),
	}),
	pr({
		id: 'm4',
		title: 'wip: extract PR card into reusable component',
		repoFullName: 'acme/web-app',
		branchName: 'wip/pr-card',
		changes: { additions: 88, deletions: 40, filesChanged: 4 },
		checks: { status: 'unknown', details: [] },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(72),
		isDraft: true,
	}),
];

export const reviewRequests: PullRequest[] = [
	pr({
		id: 'r1',
		title: 'perf: cache GitHub API responses per repo',
		repoFullName: 'acme/web-app',
		branchName: 'perf/api-cache',
		author: { login: 'gaearon', name: 'Maya', avatarUrl: avatar('gaearon') },
		changes: { additions: 156, deletions: 32, filesChanged: 5 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(0.7),
	}),
	pr({
		id: 'r2',
		title: 'feat: dark mode for the settings page',
		repoFullName: 'acme/design-system',
		branchName: 'feat/settings-dark',
		author: { login: 'sindresorhus', name: 'Devon', avatarUrl: avatar('sindresorhus') },
		changes: { additions: 210, deletions: 8, filesChanged: 9 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(3),
	}),
	pr({
		id: 'r3',
		title: 'refactor: move auth into a shared middleware',
		repoFullName: 'acme/api',
		branchName: 'refactor/auth-mw',
		author: { login: 'yyx990803', name: 'Sam', avatarUrl: avatar('yyx990803') },
		changes: { additions: 401, deletions: 377, filesChanged: 18 },
		checks: { status: 'failure', details: [] },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: hoursAgo(6),
	}),
];
