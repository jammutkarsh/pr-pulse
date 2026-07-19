import { test, expect, completeOnboarding, openExtensionPage, destroyContext } from './fixtures';

test.describe.serial('Settings', () => {
	test('setup: complete onboarding', async ({ context, extensionId }) => {
		const page = await completeOnboarding(context, extensionId);
		await page.close();
	});

	test('settings page loads and shows all sections', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'settings/settings.html');

		await expect(page.getByText('GitHub Account')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('Default View')).toBeVisible();
		await expect(page.getByText('Jira Integration')).toBeVisible();
		await expect(page.getByText('Refresh Interval')).toBeVisible();
		await expect(page.getByText('Display Mode')).toBeVisible();
		await expect(page.getByText('Danger Zone')).toBeVisible();

		await page.close();
	});

	test('shows connected GitHub user', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'settings/settings.html');

		// Connected state: avatar visible and "Reconnect with a different token" button
		await expect(page.locator('img[alt="Avatar"]')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('button', { name: /reconnect/i })).toBeVisible();

		await page.close();
	});

	test('default view has My PRs and To Review options', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'settings/settings.html');

		await expect(page.getByText('My PRs').first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('To Review').first()).toBeVisible();

		await page.close();
	});

	test('jira integration has URL input', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'settings/settings.html');

		const jiraInput = page.locator('input[type="url"]');
		await expect(jiraInput).toBeVisible({ timeout: 10_000 });

		await jiraInput.fill('https://test.atlassian.net');
		await expect(jiraInput).toHaveValue('https://test.atlassian.net');

		await page.close();
	});

	test('refresh interval has select dropdown', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'settings/settings.html');

		const select = page.locator('select');
		await expect(select).toBeVisible({ timeout: 10_000 });

		const options = select.locator('option');
		const count = await options.count();
		expect(count).toBeGreaterThan(3);

		await page.close();
	});

	test('danger zone has reset button', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'settings/settings.html');

		await expect(page.getByRole('button', { name: /reset all/i })).toBeVisible({ timeout: 10_000 });

		await page.close();
	});

	test('back button exists', async ({ context, extensionId }) => {
		const page = await openExtensionPage(context, extensionId, 'settings/settings.html');

		await expect(page.getByRole('button', { name: /back to pr pulse/i })).toBeVisible({ timeout: 10_000 });

		await page.close();
	});

	test.afterAll(async () => {
		await destroyContext();
	});
});
