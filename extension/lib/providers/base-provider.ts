import type { ProviderConfig, PullRequest, User } from '../types';

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
}
