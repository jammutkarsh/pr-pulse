import type { ProviderConfig, ProviderPullRequests, User } from '../types';

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
	// One call, not three: the provider sizes each view's query from a shared count probe, so it needs
	// to own the whole refresh rather than exposing three independently-callable fetches.
	abstract getAllPullRequests(): Promise<ProviderPullRequests>;
}
