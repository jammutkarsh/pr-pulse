import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubProvider } from '@lib/providers/github-provider';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: { 'content-type': 'application/json', ...init.headers },
	});
}

function searchIssue(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: 1,
		number: 42,
		title: 'Add feature',
		html_url: 'https://github.com/owner/repo/pull/42',
		repository_url: 'https://api.github.com/repos/owner/repo',
		user: { login: 'author', avatar_url: 'https://avatar/author' },
		state: 'open',
		created_at: '2025-01-01T00:00:00Z',
		updated_at: '2025-01-02T00:00:00Z',
		draft: false,
		...overrides,
	};
}

function prDetailsResponse(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		head: { ref: 'feature-branch', sha: 'abc123' },
		base: { repo: { owner: { login: 'owner', type: 'Organization' } } },
		additions: 10,
		deletions: 2,
		changed_files: 3,
		requested_reviewers: [],
		draft: false,
		...overrides,
	};
}

describe('GitHubProvider', () => {
	let provider: GitHubProvider;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		provider = new GitHubProvider({ token: 'test-token' });
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getUser', () => {
		it('maps user fields and token expiration header', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(
					{ login: 'octocat', avatar_url: 'https://avatar', name: 'The Octocat' },
					{ headers: { 'github-authentication-token-expiration': '2026-01-01' } },
				),
			);

			const user = await provider.getUser();

			expect(user).toEqual({
				login: 'octocat',
				avatarUrl: 'https://avatar',
				name: 'The Octocat',
				tokenExpiration: '2026-01-01',
			});
		});

		it('falls back to login when name is missing', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ login: 'octocat', avatar_url: '' }));
			const user = await provider.getUser();
			expect(user.name).toBe('octocat');
			expect(user.tokenExpiration).toBeNull();
		});

		it('throws a retryable ProviderError on 5xx', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Server error' }, { status: 500 }));

			await expect(provider.getUser()).rejects.toMatchObject({
				code: 'API_ERROR',
				details: { statusCode: 500, retryable: true, provider: 'github' },
			});
		});

		it('throws a non-retryable ProviderError on 404', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, { status: 404 }));

			await expect(provider.getUser()).rejects.toMatchObject({
				code: 'API_ERROR',
				details: { statusCode: 404, retryable: false },
			});
		});
	});

	describe('getRepoOwner', () => {
		it('returns unknown owner for empty repoFullName without calling fetch', async () => {
			const owner = await provider.getRepoOwner('');
			expect(owner).toEqual({ login: '', type: 'unknown' });
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('caches results per repoFullName', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ owner: { login: 'owner', type: 'User' } }));

			const first = await provider.getRepoOwner('owner/repo');
			const second = await provider.getRepoOwner('owner/repo');

			expect(first).toEqual({ login: 'owner', type: 'user' });
			expect(second).toEqual(first);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('falls back to the repo name segment when owner login is missing', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({}));
			const owner = await provider.getRepoOwner('owner/repo');
			expect(owner).toEqual({ login: 'owner', type: 'unknown' });
		});
	});

	describe('ETag caching via #request', () => {
		it('reuses cached data when the API returns 304', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ check_runs: [{ name: 'ci', status: 'completed', conclusion: 'success' }] }, { headers: { etag: '"v1"' } }),
			);
			const first = await provider.getCheckStatus('owner/repo', 'sha1');
			expect(first.status).toBe('success');

			fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
			const second = await provider.getCheckStatus('owner/repo', 'sha1');

			expect(second).toEqual(first);
			const secondCallHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
			expect(secondCallHeaders['If-None-Match']).toBe('"v1"');
		});
	});

	describe('getCheckStatus', () => {
		it('returns unknown for empty sha without calling fetch', async () => {
			const result = await provider.getCheckStatus('owner/repo', '');
			expect(result).toEqual({ status: 'unknown', details: [] });
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('returns unknown when there are no check runs', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ check_runs: [] }));
			const result = await provider.getCheckStatus('owner/repo', 'sha1');
			expect(result).toEqual({ status: 'unknown', details: [] });
		});

		it('returns failure when any run has a failing conclusion', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					check_runs: [
						{ name: 'lint', status: 'completed', conclusion: 'success' },
						{ name: 'test', status: 'completed', conclusion: 'failure' },
					],
				}),
			);
			const result = await provider.getCheckStatus('owner/repo', 'sha1');
			expect(result.status).toBe('failure');
		});

		it('returns pending when a run is still in progress', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					check_runs: [{ name: 'build', status: 'in_progress', conclusion: null }],
				}),
			);
			const result = await provider.getCheckStatus('owner/repo', 'sha1');
			expect(result.status).toBe('pending');
		});

		it('returns success when all runs completed successfully', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					check_runs: [
						{ name: 'lint', status: 'completed', conclusion: 'success' },
						{ name: 'test', status: 'completed', conclusion: 'skipped' },
					],
				}),
			);
			const result = await provider.getCheckStatus('owner/repo', 'sha1');
			expect(result.status).toBe('success');
		});
	});

	describe('getReviewStatus', () => {
		it('returns pending when there are no reviews and no requested reviewers', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse([]));
			const result = await provider.getReviewStatus('owner/repo', 42);
			expect(result.status).toBe('pending');
			expect(result.reviewers).toEqual([]);
		});

		it('returns pending while reviewers are still requested', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, state: 'APPROVED', user: { login: 'alice', avatar_url: '' } }]));
			const result = await provider.getReviewStatus('owner/repo', 42, ['bob']);
			expect(result.status).toBe('pending');
			expect(result.pendingReviewers).toEqual(['bob']);
		});

		it('returns approved when all non-pending reviewers approved', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse([
					{ id: 1, state: 'APPROVED', user: { login: 'alice', avatar_url: '' } },
					{ id: 2, state: 'COMMENTED', user: { login: 'carol', avatar_url: '' } },
				]),
			);
			const result = await provider.getReviewStatus('owner/repo', 42);
			expect(result.status).toBe('approved');
			expect(result.reviewers).toHaveLength(1);
		});

		it('returns changes_requested and counts open threads', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse([
					{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'alice', avatar_url: '' } },
					{ id: 2, state: 'CHANGES_REQUESTED', user: { login: 'alice', avatar_url: '' } },
				]),
			);
			fetchMock.mockResolvedValueOnce(
				jsonResponse([{ in_reply_to_id: undefined }, { in_reply_to_id: 5 }, { in_reply_to_id: undefined }]),
			);

			const result = await provider.getReviewStatus('owner/repo', 42);

			expect(result.status).toBe('changes_requested');
			expect(result.changesRequestedReviewId).toBe(2);
			expect(result.openThreadCount).toBe(2);
		});

		it('excludes re-requested reviewers from the verdict even if they previously reviewed', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, state: 'APPROVED', user: { login: 'alice', avatar_url: '' } }]));
			const result = await provider.getReviewStatus('owner/repo', 42, ['alice']);
			expect(result.reviewers).toEqual([]);
			expect(result.status).toBe('pending');
		});
	});

	describe('getPullRequestDetails', () => {
		it('maps PR detail fields and caches the repo owner', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(prDetailsResponse({ requested_reviewers: [{ login: 'bob' }] })));

			const details = await provider.getPullRequestDetails('owner/repo', 42);

			expect(details).toMatchObject({
				branchName: 'feature-branch',
				changes: { additions: 10, deletions: 2, filesChanged: 3 },
				repoOwner: { login: 'owner', type: 'org' },
				requestedReviewers: ['bob'],
				isDraft: false,
			});

			// repoOwner cache is now warm — getRepoOwner shouldn't call fetch again.
			const owner = await provider.getRepoOwner('owner/repo');
			expect(owner).toEqual({ login: 'owner', type: 'org' });
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
	});

	describe('getMyPullRequests / #fetchPRsWithQuery', () => {
		it('fetches, enriches, and transforms search results', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ items: [searchIssue()] })) // search
				.mockResolvedValueOnce(jsonResponse(prDetailsResponse())) // pr details
				.mockResolvedValueOnce(jsonResponse({ check_runs: [{ name: 'ci', status: 'completed', conclusion: 'success' }] })) // checks
				.mockResolvedValueOnce(jsonResponse([])); // reviews

			const prs = await provider.getMyPullRequests();

			expect(prs).toHaveLength(1);
			expect(prs[0]).toMatchObject({
				id: 'github-1',
				provider: 'github',
				title: 'Add feature',
				repoFullName: 'owner/repo',
				branchName: 'feature-branch',
				checks: { status: 'success', details: [{ name: 'ci', status: 'completed', conclusion: 'success' }] },
				reviews: { status: 'pending', reviewers: [] },
				author: { login: 'author', avatarUrl: 'https://avatar/author', name: 'author' },
			});
		});

		it('falls back to a minimal PR when detail enrichment fails', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ items: [searchIssue({ draft: true })] })) // search
				.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, { status: 500 })) // pr details fails
				.mockResolvedValueOnce(jsonResponse({ owner: { login: 'owner', type: 'Organization' } })); // getRepoOwner fallback

			const prs = await provider.getReviewRequests();

			expect(prs).toHaveLength(1);
			expect(prs[0]).toMatchObject({
				id: 'github-1',
				isDraft: true,
				changes: { additions: 0, deletions: 0, filesChanged: 0 },
				checks: { status: 'unknown', details: [] },
				reviews: { status: 'pending', reviewers: [] },
				repoOwner: { login: 'owner', type: 'org' },
			});
		});
	});
});
