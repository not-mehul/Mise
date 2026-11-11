import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tabRecipes')).toHaveAttribute('aria-selected', 'true');
});

test('opens on an empty recipe collection and moves between tabs', async ({ page }) => {
  await expect(page.locator('#viewRecipes .empty-title')).toHaveText('No recipes yet');
  await page.locator('#tabPlan').click();
  await expect(page.locator('#viewPlan')).toBeVisible();
  await page.locator('#tabGroceries').click();
  await expect(page.locator('#viewGroceries .empty-title')).toHaveText('Nothing to buy');
  await page.locator('#tabSettings').click();
  await expect(page.locator('#viewSettings')).toBeVisible();
});

test('remembers the theme and language across a reload', async ({ page }) => {
  await page.locator('#tabSettings').click();
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#languageSelect').selectOption('fr');
  await expect(page.locator('#tabRecipes')).toHaveText(/Recettes/);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#tabRecipes')).toHaveText(/Recettes/);
});

test('the header switch flips between Dusk and Dawn', async ({ page }) => {
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.locator('.theme-toggle').click();
  await expect(html).not.toHaveAttribute('data-theme', before ?? '');
});

for (const theme of ['dark', 'light'] as const) {
  test(`has no accessibility violations in ${theme === 'dark' ? 'Dusk' : 'Dawn'}`, async ({ page }) => {
    await page.locator('#tabSettings').click();
    await page.locator(`[data-theme-option="${theme}"]`).click();
    for (const tab of ['#tabRecipes', '#tabPlan', '#tabGroceries', '#tabSettings']) {
      await page.locator(tab).click();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, tab).toEqual([]);
    }
  });
}

test('hides easter eggs, counts them once, and lists the count in Settings', async ({ page }) => {
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
    await page.keyboard.press(key);
  }
  await expect(page.locator('.toast[data-kind="celebrate"]')).toHaveText('Cookies for the whole kitchen. Easter egg found: 1 of 3.');

  for (let i = 0; i < 7; i++) await page.locator('.t-page-title').click();
  await expect(page.locator('.toast[data-kind="celebrate"]')).toHaveText('Mise en place: everything in its place. Easter egg found: 2 of 3.');

  // Found again, it just plays.
  for (let i = 0; i < 7; i++) await page.locator('.t-page-title').click();
  await expect(page.locator('.toast[data-kind="celebrate"]')).toHaveText('Mise en place: everything in its place.');

  await page.locator('#tabSettings').click();
  await expect(page.locator('#eggCount')).toHaveText('Easter eggs: 2 of 3 found');
});
