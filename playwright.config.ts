import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 120_000,
	retries: 0,
	fullyParallel: false,
	workers: 1,
	reporter: 'list',
	use: {
		headless: false,
	},
	projects: [
		{
			name: 'chromium-extension',
		},
	],
});
