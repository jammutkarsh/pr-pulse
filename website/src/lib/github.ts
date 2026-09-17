import type { PrSource, PrSourceResult, PullRequest } from '../../../extension/lib/types';

// Live, unauthenticated GitHub reads. Public data only — no token ships to the
// browser. Unauthenticated limit is 60 req/hr PER visitor IP, so a handful of
// loads per visitor is well within budget. We cap page size and enrich
// best-effort to keep the call count small.

const API = 'https://api.github.com';
const PER_PAGE = 6;

export class RateLimitError extends Error {}

interface SearchItem {
	number: number;
	title: string;
	html_url: string;
	created_at: string;
	updated_at: string;
	draft?: boolean;
	user: { login: string; avatar_url: string };
	repository_url: string;
	pull_request?: { url: string };
}

async function search(q: string): Promise<SearchItem[]> {
	const url = `${API}/search/issues?q=${encodeURIComponent(q)}&per_page=${PER_PAGE}&sort=updated`;
	const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
	if (res.status === 403 || res.status === 429) {
		throw new RateLimitError('GitHub limits anonymous API requests from your network.');
	}
	if (!res.ok) throw new Error(`GitHub request failed (${res.status}).`);
	const data = (await res.json()) as { items?: SearchItem[] };
	return data.items ?? [];
}

function toPr(item: SearchItem): PullRequest {
	const repoFullName = item.repository_url.replace(`${API}/repos/`, '');
	return {
		id: `${item.html_url}`,
		provider: 'github',
		number: item.number,
		title: item.title,
		url: item.html_url,
		repoFullName,
		repoOwner: { login: repoFullName.split('/')[0], type: 'unknown' },
		branchName: '',
		author: { login: item.user.login, name: item.user.login, avatarUrl: item.user.avatar_url },
		state: 'open',
		changes: { additions: 0, deletions: 0, filesChanged: 0 },
		checks: { status: 'unknown' },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: item.created_at,
		updatedAt: item.updated_at,
		isDraft: !!item.draft,
	};
}

// Fill in diff size + branch from the PR detail endpoint. Best-effort: any
// failure just leaves the search-derived fields in place.
async function enrich(prs: PullRequest[], items: SearchItem[]) {
	await Promise.allSettled(
		items.map(async (item, i) => {
			if (!item.pull_request?.url) return;
			const res = await fetch(item.pull_request.url, { headers: { Accept: 'application/vnd.github+json' } });
			if (!res.ok) return;
			const d = (await res.json()) as {
				additions?: number;
				deletions?: number;
				changed_files?: number;
				draft?: boolean;
				head?: { ref?: string };
			};
			prs[i].changes = {
				additions: d.additions ?? 0,
				deletions: d.deletions ?? 0,
				filesChanged: d.changed_files ?? 0,
			};
			prs[i].branchName = d.head?.ref ?? '';
			prs[i].isDraft = !!d.draft;
		}),
	);
}

export async function fetchStars(repo = 'jammutkarsh/pr-pulse'): Promise<number | null> {
	try {
		const res = await fetch(`${API}/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json' } });
		if (!res.ok) return null;
		const data = (await res.json()) as { stargazers_count?: number };
		return data.stargazers_count ?? null;
	} catch {
		return null;
	}
}

/** The second adapter at the PrSource seam: unauthenticated REST instead of the extension's GraphQL. */
export function publicGitHubSource(username: string): PrSource {
	return { getAllPullRequests: () => fetchUserPrs(username) };
}

async function fetchUserPrs(rawUsername: string): Promise<PrSourceResult> {
	const username = rawUsername.trim().replace(/^@/, '');
	if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username)) {
		throw new Error('That does not look like a GitHub username.');
	}

	const [mineItems, reviewItems] = await Promise.all([
		search(`type:pr state:open author:${username}`),
		search(`type:pr state:open review-requested:${username}`),
	]);

	const myPRs = mineItems.map(toPr);
	const reviewRequests = reviewItems.map(toPr);
	await Promise.allSettled([enrich(myPRs, mineItems), enrich(reviewRequests, reviewItems)]);
	return { myPRs, reviewRequests };
}
