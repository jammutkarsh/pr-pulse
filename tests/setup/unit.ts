/**
 * Vitest setup for unit tests running in Node.
 *
 * Provides minimal stubs for browser extension APIs so that module-level
 * imports of `webextension-polyfill` don't crash in the Node environment.
 *
 * Individual tests should use `vi.mock(...)` for fine-grained control.
 */
import { vi } from 'vitest';

// Stub the webextension-polyfill default export so any `import browser from 'webextension-polyfill'`
// resolves to a no-op object instead of throwing.
vi.mock('webextension-polyfill', () => {
	const noop = () => {};
	const noopAsync = () => Promise.resolve({});
	const fakeEvent = {
		addListener: noop,
		removeListener: noop,
		hasListener: () => false,
	};

	return {
		default: {
			runtime: {
				sendMessage: noopAsync,
				getURL: (path: string) => `chrome-extension://fake-id/${path}`,
				onInstalled: fakeEvent,
				onStartup: fakeEvent,
				onMessage: fakeEvent,
			},
			storage: {
				local: {
					get: noopAsync,
					set: noopAsync,
					remove: noopAsync,
					clear: noopAsync,
				},
				onChanged: fakeEvent,
			},
			tabs: {
				create: noopAsync,
			},
			action: {
				setBadgeText: noopAsync,
				setBadgeBackgroundColor: noopAsync,
			},
			alarms: {
				get: noopAsync,
				create: noop,
				clear: noopAsync,
				onAlarm: fakeEvent,
			},
		},
	};
});
