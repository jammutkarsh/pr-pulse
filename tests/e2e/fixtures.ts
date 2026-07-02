/**
 * Playwright fixtures for PR Pulse browser extension E2E tests.
 *
 * Loads the built Chrome extension via a shared persistent context.
 * The browser context persists across all tests in a serial describe block,
 * so onboarding state carries over to popup/settings tests.
 *
 * Token entry:
 *   - If GITHUB_TOKEN env var is set, onboarding auto-fills it.
 *   - If not (or if auto-fill fails), the test pauses and waits for you
 *     to complete onboarding manually in the visible Chrome window.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx npm run test:e2e        # fully automated
 *   npm run test:e2e                              # interactive — enter token manually
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(__dirname, '../../dist/chrome');

// ── Shared context (singleton across tests) ───────────────────────

let _context: BrowserContext | null = null;
let _extensionId: string | null = null;

async function ensureContext(): Promise<{ context: BrowserContext; extensionId: string }> {
	if (_context && _extensionId) {
		return { context: _context, extensionId: _extensionId };
	}

	_context = await chromium.launchPersistentContext('', {
		headless: false,
		args: [
			`--disable-extensions-except=${extensionPath}`,
			`--load-extension=${extensionPath}`,
			'--no-first-run',
			'--disable-gpu',
		],
	});

	let [background] = _context.serviceWorkers();
	if (!background) {
		background = await _context.waitForEvent('serviceworker');
	}
	_extensionId = background.url().split('/')[2];

	return { context: _context, extensionId: _extensionId };
}

async function destroyContext(): Promise<void> {
	if (_context) {
		await _context.close();
		_context = null;
		_extensionId = null;
	}
}

// ── Re-export test with shared fixtures ───────────────────────────

export const test = base.extend<{
	context: BrowserContext;
	extensionId: string;
}>({
	// eslint-disable-next-line no-empty-pattern
	context: async ({}, use) => {
		const { context } = await ensureContext();
		await use(context);
		// Don't close here — shared across tests
	},
	// The context dependency ensures extensionId resolves after context is ready.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	extensionId: async ({ context: _context }, use) => {
		const { extensionId } = await ensureContext();
		await use(extensionId);
	},
});

export { expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Open an extension page in a new tab.
 */
export async function openExtensionPage(
	context: BrowserContext,
	extensionId: string,
	path: string,
): Promise<Page> {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/${path}`);
	return page;
}

/**
 * Run the full onboarding flow.
 *
 * If GITHUB_TOKEN is set, auto-fills and clicks through.
 * If not, opens the onboarding page and waits up to 2 minutes
 * for you to complete it manually in the browser.
 */
export async function completeOnboarding(
	context: BrowserContext,
	extensionId: string,
): Promise<Page> {
	const page = await openExtensionPage(context, extensionId, 'onboarding/onboarding.html');
	const token = process.env.GITHUB_TOKEN;

	if (token) {
		// Auto-fill token
		await page.locator('input.field-input').fill(token);
		await page.getByRole('button', { name: /test connection/i }).click();

		// Wait for user card
		await page.locator('img[alt="Avatar"]').waitFor({ timeout: 20000 });

		// Click through steps 1→2→3→4→complete
		await page.getByRole('button', { name: /continue/i }).click();
		// Step 2: Default View → Continue
		await page.getByRole('button', { name: /continue/i }).click();
		// Step 3: Jira → Continue
		await page.getByRole('button', { name: /continue/i }).click();
		// Step 4: Display → Complete setup
		await page.getByRole('button', { name: /complete setup/i }).click();
	} else {
		// No token — let user complete manually
		console.log('\n⏳ No GITHUB_TOKEN set. Please complete onboarding manually in the browser window...\n');
	}

	// Wait for completion (generous timeout for manual entry)
	await page.getByText('Setup complete').waitFor({ timeout: 120_000 });

	return page;
}

/**
 * Clean up the shared browser context. Call in test.afterAll.
 */
export { destroyContext };
