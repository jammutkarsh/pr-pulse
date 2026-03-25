export type ProviderType = 'github' | 'gitlab' | 'bitbucket';

export interface User {
	login: string;
	avatarUrl: string;
	name: string;
}

export interface PullRequestAuthor {
	login: string;
	avatarUrl: string;
	name: string;
}

export interface PullRequestChanges {
	additions: number;
	deletions: number;
	filesChanged: number;
}

export interface PullRequestCheckDetail {
	name: string;
	status: string;
	conclusion: string | null;
}

export interface PullRequestChecks {
	status: 'success' | 'failure' | 'pending' | 'unknown';
	details: PullRequestCheckDetail[];
}

export interface PullRequestReviewer {
	login: string;
	avatarUrl: string;
	state: string;
}

export interface PullRequestReviews {
	status: 'approved' | 'changes_requested' | 'pending';
	reviewers: PullRequestReviewer[];
	pendingReviewers?: string[];
}

export interface PullRequest {
	id: string;
	provider: ProviderType;
	title: string;
	url: string;
	repoFullName: string;
	branchName: string;
	author: PullRequestAuthor;
	state: string;
	changes: PullRequestChanges;
	checks: PullRequestChecks;
	reviews: PullRequestReviews;
	createdAt: string;
	updatedAt: string;
	_prNumber?: number;
	_repoFullName?: string;
}

export interface ProviderConfig {
	token?: string;
	baseUrl?: string;
}

export interface StoredProviderConfig extends ProviderConfig {
	type: ProviderType;
	user?: User;
}

export interface Settings {
	jiraBaseUrl: string;
	displayMode: 'popup' | 'fullpage';
	pinnedTab: 'myPRs' | 'toReview';
	visibleColumns: string[];
	pollingIntervalMs: number;
}

export interface PullRequestData {
	myPRs: PullRequest[];
	reviewRequests: PullRequest[];
	lastFetched: number | null;
}

export type RuntimeMessage =
	| { type: 'PROVIDER_CONFIGURED' }
	| { type: 'REFRESH_PRS' }
	| { type: 'GET_PRS' }
	| { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
	| { type: 'SETTINGS_UPDATED'; settings: Partial<Settings> }
	| { type: 'CLEAR_ALL' };

export interface ProviderErrorDetails {
	statusCode?: number;
	retryable?: boolean;
	provider?: string;
}