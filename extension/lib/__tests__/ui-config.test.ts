import { describe, it, expect } from 'vitest';
import { normalizeSettings, DEFAULT_SETTINGS } from '@lib/ui-config';
import type { UiConfig } from '@lib/types';

describe('normalizeSettings', () => {
	it('returns defaults when called with undefined', () => {
		const result = normalizeSettings(undefined);
		expect(result).toEqual(DEFAULT_SETTINGS);
	});

	it('returns defaults when called with empty object', () => {
		const result = normalizeSettings({});
		expect(result).toEqual(DEFAULT_SETTINGS);
	});

	it('merges partial top-level settings', () => {
		const result = normalizeSettings({ jiraBaseUrl: 'https://jira.example.com', pinnedTab: 'toReview' });
		expect(result.jiraBaseUrl).toBe('https://jira.example.com');
		expect(result.pinnedTab).toBe('toReview');
		// defaults preserved
		expect(result.displayMode).toBe('popup');
		expect(result.pollingIntervalMs).toBe(600000);
	});

	it('merges partial ui config with defaults', () => {
		const result = normalizeSettings({ ui: { popupWidthRem: 32 } as Partial<UiConfig> as UiConfig });
		expect(result.ui.popupWidthRem).toBe(32);
		// other ui defaults preserved
		expect(result.ui.popupHeightRem).toBe(37.5);
		expect(result.ui.surfaceRadiusPx).toBe(10);
		expect(result.ui.smoothScroll).toBe(true);
	});

	it('fully overrides all settings', () => {
		const custom = {
			jiraBaseUrl: 'https://custom.atlassian.net',
			displayMode: 'fullpage' as const,
			pinnedTab: 'toReview' as const,
			visibleColumns: ['title'],
			pollingIntervalMs: 300000,
			persistFilters: false,
			badgeCountMode: 'filters' as const,
			ui: {
				pageMaxWidthRem: 80,
				popupWidthRem: 40,
				popupHeightRem: 50,
				popupInsetRem: 2,
				surfaceRadiusPx: 8,
				sectionRadiusPx: 16,
				fieldRadiusPx: 4,
				smoothScroll: false,
			},
		};
		const result = normalizeSettings(custom);
		expect(result).toEqual(custom);
	});

	it('does not mutate the input', () => {
		const input = { jiraBaseUrl: 'https://test.com' };
		const inputCopy = { ...input };
		normalizeSettings(input);
		expect(input).toEqual(inputCopy);
	});
});

describe('DEFAULT_SETTINGS', () => {
	it('has expected default values', () => {
		expect(DEFAULT_SETTINGS.displayMode).toBe('popup');
		expect(DEFAULT_SETTINGS.pinnedTab).toBe('myPRs');
		expect(DEFAULT_SETTINGS.pollingIntervalMs).toBe(600000);
		expect(DEFAULT_SETTINGS.persistFilters).toBe(true);
		expect(DEFAULT_SETTINGS.badgeCountMode).toBe('total');
		expect(DEFAULT_SETTINGS.jiraBaseUrl).toBe('');
	});
});
