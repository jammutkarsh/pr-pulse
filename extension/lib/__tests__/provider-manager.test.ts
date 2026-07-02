import { describe, it, expect, beforeEach } from 'vitest';
import { providerManager } from '@lib/provider-manager';
import { ProviderError } from '@lib/errors';
import type { BaseProvider } from '@lib/providers/base-provider';
import type { PullRequest, ProviderType } from '@lib/types';

function makePR(id: string): PullRequest {
	return {
		id,
		provider: 'github',
		title: `PR ${id}`,
		url: `https://github.com/owner/repo/pull/${id}`,
		repoFullName: 'owner/repo',
		repoOwner: { login: 'owner', type: 'org' },
		branchName: 'main',
		author: { login: 'user', avatarUrl: '', name: 'User' },
		state: 'open',
		changes: { additions: 0, deletions: 0, filesChanged: 0 },
		checks: { status: 'success', details: [] },
		reviews: { status: 'pending', reviewers: [] },
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-01T00:00:00Z',
		isDraft: false,
	};
}

describe('ProviderManager', () => {
	beforeEach(() => {
		providerManager.setProvider(null as unknown as BaseProvider);
	});

	describe('createProvider', () => {
		it('creates a GitHub provider', () => {
			const provider = providerManager.createProvider('github', { token: 'test-token' });
			expect(provider).toBeDefined();
		});

		it('throws ProviderError for unknown type', () => {
			expect(() => providerManager.createProvider('unknown' as ProviderType, {})).toThrow(ProviderError);
		});

		it('includes registered types in error message', () => {
			try {
				providerManager.createProvider('bitbucket' as ProviderType, {});
			} catch (error) {
				expect(error).toBeInstanceOf(ProviderError);
				expect((error as ProviderError).code).toBe('UNKNOWN_PROVIDER');
				expect((error as ProviderError).message).toContain('github');
			}
		});
	});

	describe('setProvider / hasProvider', () => {
		it('hasProvider returns false initially', () => {
			expect(providerManager.hasProvider()).toBe(false);
		});

		it('hasProvider returns true after setProvider', () => {
			const provider = providerManager.createProvider('github', { token: 'test' });
			providerManager.setProvider(provider);
			expect(providerManager.hasProvider()).toBe(true);
		});
	});

	describe('getRegisteredTypes', () => {
		it('includes github', () => {
			expect(providerManager.getRegisteredTypes()).toContain('github');
		});
	});

	describe('fetchAllPullRequests', () => {
		it('throws when no provider configured', async () => {
			await expect(providerManager.fetchAllPullRequests()).rejects.toThrow(ProviderError);
		});

		it('deduplicates review requests from reviewedPRs', async () => {
			const shared = makePR('shared-1');
			const uniqueReview = makePR('review-only');
			const uniqueReviewed = makePR('reviewed-only');

			const mockProvider = {
				getMyPullRequests: async () => [makePR('my-1')],
				getReviewRequests: async () => [shared, uniqueReview],
				getReviewedPRs: async () => [shared, uniqueReviewed], // shared-1 is duplicated
			};

			providerManager.setProvider(mockProvider as unknown as BaseProvider);
			const result = await providerManager.fetchAllPullRequests();

			expect(result.myPRs).toHaveLength(1);
			// shared should appear once, plus uniqueReview and uniqueReviewed
			expect(result.reviewRequests).toHaveLength(3);
			const ids = result.reviewRequests.map(pr => pr.id);
			expect(ids).toContain('shared-1');
			expect(ids).toContain('review-only');
			expect(ids).toContain('reviewed-only');
			// No duplicates
			expect(new Set(ids).size).toBe(ids.length);
		});

		it('sets lastFetched to null (storage layer adds it)', async () => {
			const mockProvider = {
				getMyPullRequests: async () => [],
				getReviewRequests: async () => [],
				getReviewedPRs: async () => [],
			};

			providerManager.setProvider(mockProvider as unknown as BaseProvider);
			const result = await providerManager.fetchAllPullRequests();
			expect(result.lastFetched).toBeNull();
		});
	});
});
