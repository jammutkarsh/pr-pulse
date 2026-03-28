import type { Settings, UiConfig } from './types';

export const DEFAULT_UI_CONFIG: UiConfig = {
	pageMaxWidthRem: 56,
	popupWidthRem: 28,
	popupHeightRem: 37.5,
	popupInsetRem: 1,
	surfaceRadiusPx: 10,
	sectionRadiusPx: 20,
	fieldRadiusPx: 6,
	smoothScroll: true,
};

export const DEFAULT_SETTINGS: Settings = {
	jiraBaseUrl: '',
	displayMode: 'popup',
	pinnedTab: 'myPRs',
	visibleColumns: ['title', 'author', 'checks', 'reviewStatus', 'repo', 'changes', 'jira'],
	pollingIntervalMs: 600000,
	persistFilters: true,
	ui: DEFAULT_UI_CONFIG,
};

export function normalizeUiConfig(uiConfig?: Partial<UiConfig>): UiConfig {
	return {
		...DEFAULT_UI_CONFIG,
		...(uiConfig ?? {}),
	};
}

export function normalizeSettings(settings?: Partial<Settings>): Settings {
	return {
		...DEFAULT_SETTINGS,
		...(settings ?? {}),
		ui: normalizeUiConfig(settings?.ui),
	};
}

export function applyDocumentUiConfig(uiConfig?: Partial<UiConfig>): UiConfig {
	const resolvedConfig = normalizeUiConfig(uiConfig);

	if (typeof document === 'undefined') {
		return resolvedConfig;
	}

	const root = document.documentElement;
	root.style.setProperty('--app-max-width', `${resolvedConfig.pageMaxWidthRem}rem`);
	root.style.setProperty('--popup-width', `${resolvedConfig.popupWidthRem}rem`);
	root.style.setProperty('--popup-height', `${resolvedConfig.popupHeightRem}rem`);
	root.style.setProperty('--popup-inset', `${resolvedConfig.popupInsetRem}rem`);
	root.style.setProperty('--surface-radius', `${resolvedConfig.surfaceRadiusPx}px`);
	root.style.setProperty('--section-radius', `${resolvedConfig.sectionRadiusPx}px`);
	root.style.setProperty('--field-radius', `${resolvedConfig.fieldRadiusPx}px`);
	root.style.setProperty('--scroll-behavior', resolvedConfig.smoothScroll ? 'smooth' : 'auto');

	return resolvedConfig;
}