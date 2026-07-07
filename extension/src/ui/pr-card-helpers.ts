/**
 * Pure helper functions for PR card rendering.
 *
 * Extracted from PrCard.svelte to enable unit testing
 * without requiring a Svelte component environment.
 */
import { extractJiraTicket, getJiraUrl, isValidHttpUrl } from '@lib/utils';
import type { PullRequest } from '@lib/types';

export function getCheckToneClass(className: string): string {
	switch (className) {
		case 'checks-success':
			return 'status-inline-success';
		case 'checks-failure':
			return 'status-inline-danger';
		case 'checks-pending':
			return 'status-inline-warning';
		default:
			return 'status-inline-neutral';
	}
}

export function getReviewToneClass(className: string): string {
	switch (className) {
		case 'status-approved':
			return 'status-inline-success';
		case 'status-changes':
			return 'status-inline-danger';
		default:
			return 'status-inline-warning';
	}
}

export function getDotToneClass(className: string): string {
	switch (className) {
		case 'checks-success':
		case 'status-approved':
			return 'status-dot-success';
		case 'checks-failure':
		case 'status-changes':
			return 'status-dot-danger';
		case 'checks-pending':
		case 'status-pending':
			return 'status-dot-warning';
		default:
			return 'status-dot-neutral';
	}
}

export function getBranchUrl(pr: PullRequest): string | null {
	if (!pr?.repoFullName || !pr?.branchName) {
		return null;
	}

	return `https://github.com/${pr.repoFullName}/tree/${encodeURIComponent(pr.branchName)}`;
}

export function getJiraLink(pr: PullRequest, jiraBaseUrl: string): { ticket: string; url: string } | null {
	const jiraTicket = extractJiraTicket(pr.branchName);
	if (!jiraTicket || !jiraBaseUrl) {
		return null;
	}

	const jiraUrl = getJiraUrl(jiraTicket, jiraBaseUrl);
	if (!isValidHttpUrl(jiraUrl)) {
		return null;
	}

	return { ticket: jiraTicket, url: jiraUrl };
}

export function getCardStatusClass(pr: PullRequest): string {
	if (pr.isDraft) {
		return 'pr-card-draft';
	}

	const checksStatus = pr.checks?.status;
	const checksOk = !checksStatus || checksStatus === 'success' || checksStatus === 'unknown';
	const reviewOk = pr.reviews?.status === 'approved';

	if (checksOk && reviewOk) {
		return 'pr-card-success';
	}

	if (!checksOk && !reviewOk) {
		return 'pr-card-danger';
	}

	return 'pr-card-warning';
}
