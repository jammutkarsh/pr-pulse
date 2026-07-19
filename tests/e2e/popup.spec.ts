import { test, expect, completeOnboarding, openExtensionPage, destroyContext } from './fixtures';

test.describe.serial('Popup', () => {
	test('setup: complete onboarding', async ({ context, extensionId }) => {
		const page = await completeOnboarding(context, extensionId);
		await page.close();
	});

	test('popup loads and shows avatar', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'popup/popup.html');

		// The popup header is a <div>, not <header>. Look for the user avatar.
		const avatar = page.locator('img[alt="Avatar"]');
		await expect(avatar).toBeVisible({ timeout: 15_000 });

		await page.close();
	});

	test('popup shows tab buttons for My PRs and To Review', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'popup/popup.html');

		// Tab buttons use aria-label="Show My PRs (N)" and "Show To Review (N)"
		const myPrsTab = page.getByRole('button', { name: /show my prs/i });
		const toReviewTab = page.getByRole('button', { name: /show to review/i });

		await expect(myPrsTab).toBeVisible({ timeout: 15_000 });
		await expect(toReviewTab).toBeVisible();

		await page.close();
	});

	test('tab switching works', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'popup/popup.html');

		const toReviewTab = page.getByRole('button', { name: /show to review/i });
		await expect(toReviewTab).toBeVisible({ timeout: 15_000 });
		await toReviewTab.click();
		await page.waitForTimeout(500);

		const myPrsTab = page.getByRole('button', { name: /show my prs/i });
		await myPrsTab.click();
		await page.waitForTimeout(500);

		await page.close();
	});

	test('popup has settings and refresh buttons', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'popup/popup.html');

		await expect(page.getByRole('button', { name: /open settings/i })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /refresh pull requests/i })).toBeVisible();

		await page.close();
	});

	test('fullpage mode loads correctly', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'popup/popup.html?fullpage=1');

		// Avatar should be visible in fullpage mode too
		await expect(page.locator('img[alt="Avatar"]')).toBeVisible({ timeout: 15_000 });

		await page.close();
	});

	test.afterAll(async () => {
		await destroyContext();
	});
});
