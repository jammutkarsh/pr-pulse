import { test, expect, openExtensionPage } from './fixtures';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

test.describe('Onboarding wizard', () => {
	test('completes full onboarding flow', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'onboarding/onboarding.html');

		// ── Step 1: GitHub ────────────────────────────────────────────
		await expect(page.getByText('Configure PR Pulse')).toBeVisible();
		await expect(page.getByText('Step 1 of 4')).toBeVisible();

		// Enter token — auto-fill or wait for manual entry
		if (GITHUB_TOKEN) {
			await page.locator('input.field-input').fill(GITHUB_TOKEN);
			await page.getByRole('button', { name: /test connection/i }).click();
		} else {
			console.log('\n⏳ Please enter your GitHub token and click "Test connection"...\n');
		}

		// Wait for successful connection — user card with avatar
		await page.locator('img[alt="Avatar"]').waitFor({ timeout: 120_000 });

		// Button text changes to "Continue" after connection
		await page.getByRole('button', { name: /continue/i }).click();

		// ── Step 2: Default View ──────────────────────────────────────
		await expect(page.getByText('Step 2 of 4')).toBeVisible();
		await expect(page.getByText('My PRs').first()).toBeVisible();
		await expect(page.getByText('To Review').first()).toBeVisible();

		await page.getByRole('button', { name: /continue/i }).click();

		// ── Step 3: Jira ─────────────────────────────────────────────
		await expect(page.getByText('Step 3 of 4')).toBeVisible();
		await page.getByRole('button', { name: /continue/i }).click();

		// ── Step 4: Display ──────────────────────────────────────────
		await expect(page.getByText('Step 4 of 4')).toBeVisible();
		await page.getByRole('button', { name: /complete setup/i }).click();

		// ── Completion ───────────────────────────────────────────────
		await expect(page.getByText('Setup complete')).toBeVisible({ timeout: 30_000 });

		await page.close();
	});

	test('restores session state on page refresh', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'onboarding/onboarding.html');

		// Enter token and connect
		if (GITHUB_TOKEN) {
			await page.locator('input.field-input').fill(GITHUB_TOKEN);
			await page.getByRole('button', { name: /test connection/i }).click();
		} else {
			console.log('\n⏳ Please enter your GitHub token and click "Test connection"...\n');
		}

		await page.locator('img[alt="Avatar"]').waitFor({ timeout: 120_000 });
		await page.getByRole('button', { name: /continue/i }).click();

		// Now on step 2 — refresh the page
		await expect(page.getByText('Step 2 of 4')).toBeVisible();
		await page.reload();

		// Should restore to step 2 (session storage persistence)
		await expect(page.getByText('Step 2 of 4')).toBeVisible({ timeout: 5000 });

		await page.close();
	});
});
