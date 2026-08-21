export type ProviderType = 'github';

export interface User {
	login: string;
	avatarUrl: string;
	name: string;
	tokenExpiration?: string | null;
}

export interface PullRequestAuthor {
	login: string;
	avatarUrl: string;
	name: string;
}

export interface PullRequestRepoOwner {
	login: string;
	type: 'org' | 'user' | 'unknown';
}

export interface PullRequestChanges {
	additions: number;
	deletions: number;
	filesChanged: number;
}

export interface PullRequestChecks {
	status: 'success' | 'failure' | 'pending' | 'unknown';
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
	openThreadCount?: number;
	changesRequestedReviewId?: number;
}

export interface PullRequest {
	id: string;
	provider: ProviderType;
	title: string;
	url: string;
	repoFullName: string;
	repoOwner: PullRequestRepoOwner;
	branchName: string;
	author: PullRequestAuthor;
	state: string;
	changes: PullRequestChanges;
	checks: PullRequestChecks;
	reviews: PullRequestReviews;
	createdAt: string;
	updatedAt: string;
	isDraft: boolean;
}

/** What every pull-request source hands back, whatever it reads from. */
export interface PrSourceResult {
	myPRs: PullRequest[];
	reviewRequests: PullRequest[];
}

/** The seam: fetching pull requests. Token identity is a separate concern and deliberately absent. */
export interface PrSource {
	getAllPullRequests(): Promise<PrSourceResult>;
}

export interface ProviderConfig {
	token?: string;
	baseUrl?: string;
}

export interface StoredProviderConfig extends ProviderConfig {
	type: ProviderType;
	user?: User;
	isTokenInvalid?: boolean;
}

export interface UiConfig {
	pageMaxWidthRem: number;
	popupWidthRem: number;
	popupHeightRem: number;
	popupInsetRem: number;
	surfaceRadiusPx: number;
	sectionRadiusPx: number;
	fieldRadiusPx: number;
	smoothScroll: boolean;
}

export interface Settings {
	jiraBaseUrl: string;
	displayMode: 'popup' | 'fullpage';
	pinnedTab: 'myPRs' | 'toReview';
	visibleColumns: string[];
	pollingIntervalMs: number;
	persistFilters: boolean;
	badgeCountMode: 'total' | 'filters';
	ui: UiConfig;
}

export interface PullRequestData {
	myPRs: PullRequest[];
	reviewRequests: PullRequest[];
	lastFetched: number | null;
}

export type PopupTab = Settings['pinnedTab'];

export type FiltersByTab = Record<PopupTab, PopupFilters>;

export interface PopupFilters {
	authors: string[];
	owners: string[];
	repos: string[];
	ageRange: string;
	drafts: 'only' | 'include' | 'exclude';
	showReviewed: boolean;
}

export type StoredFilters = Partial<PopupFilters>;

export interface StoredFilterState {
	tabs?: Partial<Record<PopupTab, StoredFilters>>;
	/** Pre-per-tab shape, still on disk for anyone who has not opened the popup since. */
	activeFilters?: StoredFilters;
}

export interface PopupAuthorFilterOption {
	login: string;
	name: string;
}

export interface PopupOwnerFilterOption {
	login: string;
	type: PullRequestRepoOwner['type'];
}

export interface PopupRepoFilterOption {
	fullName: string;
	owner: string;
	ownerType: PullRequestRepoOwner['type'];
	name: string;
}

export type RuntimeMessage =
	| { type: 'PROVIDER_CONFIGURED' }
	| { type: 'REFRESH_PRS' }
	| { type: 'GET_PRS' }
	| { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
	| { type: 'SETTINGS_UPDATED'; settings: Partial<Settings> }
	| { type: 'UPDATE_BADGE_COUNT'; count: number }
	| { type: 'CLEAR_ALL' };

export interface ProviderErrorDetails {
	statusCode?: number;
	retryable?: boolean;
	provider?: string;
}
