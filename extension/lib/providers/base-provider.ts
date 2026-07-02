import type { ProviderConfig, PullRequest, PullRequestChecks, PullRequestReviews, User } from '../types';

export abstract class BaseProvider {
	name = 'base';
	displayName = 'Base Provider';
	baseUrl = '';
	token = '';

	constructor(config: ProviderConfig = {}) {
		this.token = config.token || '';
	}

	abstract authenticate(): Promise<User>;
	abstract getUser(): Promise<User>;
	abstract getMyPullRequests(): Promise<PullRequest[]>;
	abstract getReviewRequests(): Promise<PullRequest[]>;
	abstract getReviewedPRs(): Promise<PullRequest[]>;
	abstract getPullRequestDetails(repoFullName: string, prNumber: number): Promise<unknown>;
	abstract getCheckStatus(repoFullName: string, commitSha: string): Promise<PullRequestChecks>;
	abstract getReviewStatus(repoFullName: string, prNumber: number, requestedReviewers?: string[]): Promise<PullRequestReviews>;
}
