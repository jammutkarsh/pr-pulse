import type { ProviderConfig, PullRequest, PullRequestChecks, PullRequestReviews, User } from '../types';

export class BaseProvider {
	name = 'base';
	displayName = 'Base Provider';
	baseUrl = '';
	token = '';

	constructor(config: ProviderConfig = {}) {
		this.token = config.token || '';
	}

	async authenticate(): Promise<User> {
		throw new Error('authenticate() not implemented');
	}

	async getUser(): Promise<User> {
		throw new Error('getUser() not implemented');
	}

	async getMyPullRequests(): Promise<PullRequest[]> {
		throw new Error('getMyPullRequests() not implemented');
	}

	async getReviewRequests(): Promise<PullRequest[]> {
		throw new Error('getReviewRequests() not implemented');
	}

	async getPullRequestDetails(repoFullName: string, prNumber: number): Promise<unknown> {
		void repoFullName;
		void prNumber;
		throw new Error('getPullRequestDetails() not implemented');
	}

	async getCheckStatus(repoFullName: string, commitSha: string): Promise<PullRequestChecks> {
		void repoFullName;
		void commitSha;
		throw new Error('getCheckStatus() not implemented');
	}

	async getReviewStatus(repoFullName: string, prNumber: number): Promise<PullRequestReviews> {
		void repoFullName;
		void prNumber;
		throw new Error('getReviewStatus() not implemented');
	}
}