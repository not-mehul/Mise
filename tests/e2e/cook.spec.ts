import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const RECIPE = `Chilli oil eggs
Serves 2

Ingredients
2 eggs
1 tbsp chilli oil
1 spring onion, sliced

Method
Heat the chilli oil in a small pan until it sizzles.
Crack in the eggs and fry for 3 minutes.
Scatter over the spring onion and serve.`;

async function saveRecipe(page: Page) {
  await page.locator('#btnNewRecipe').click();
  await page.locator('#choicePaste').click();
  await page.locator('#pasteText').fill(RECIPE);
  await page.locator('#btnRead').click();
  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('#recipeTitle')).toHaveText('Chilli oil eggs');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#viewRecipes .empty-title')).toBeVisible();
  await saveRecipe(page);
});

test('cooks a recipe step by step with a timer, then logs it', async ({ page }) => {
  // Doubled servings carry into cooking mode.
  await page.getByRole('button', { name: 'More servings' }).click();
  await page.getByRole('button', { name: 'More servings' }).click();
  await page.locator('#btnCook').click();

  await expect(page.locator('#cookTitle')).toHaveText('Chilli oil eggs');
  await expect(page.locator('#cookProgress')).toHaveText('Mise en place');
  await expect(page.locator('.gather-item').first()).toContainText('4');
  await page.locator('.gather-item').first().click();
  await expect(page.locator('.gather-item.have')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.locator('#btnNextStep').click();
  await expect(page.locator('#cookProgress')).toHaveText('Step 1 of 3');
  await expect(page.locator('#stepText')).toHaveText('Heat the chilli oil in a small pan until it sizzles.');
  await expect(page.locator('.needs li')).toHaveText(['2 tbsp chilli oil']);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#cookProgress')).toHaveText('Step 2 of 3');
  await expect(page.locator('.needs li')).toHaveText(['4 eggs']);
  await page.getByRole('button', { name: 'Start 3 min' }).click();
  await expect(page.locator('#timerTray .timer-chip')).toHaveCount(1);
  await expect(page.locator('#timerTray [role=timer]')).toHaveText(/^[23]:\d\d$/);
  await expect(page.locator('.timer-running')).toBeVisible();
  await page.getByRole('button', { name: 'Pause the Step 2 timer' }).click();
  await expect(page.getByRole('button', { name: 'Resume the Step 2 timer' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Jump from the list of steps.
  await page.locator('#btnAllSteps').click();
  await page.getByRole('button', { name: /Step 3/ }).click();
  await expect(page.locator('#cookProgress')).toHaveText('Step 3 of 3');
  await expect(page.locator('#btnNextStep')).toHaveText('Finish');
  await page.locator('#btnNextStep').click();

  await expect(page.locator('#cookProgress')).toHaveText('Done');
  await page.getByRole('radio', { name: '4 out of 5' }).click();
  await page.locator('#cookNote').fill('More chilli next time');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('#btnMarkCooked').click();

  await expect(page.locator('#recipeTitle')).toBeVisible();
  await expect(page.locator('#cookedCount')).toContainText('Cooked once');
  await expect(page.locator('#cookLog li')).toHaveCount(1);
  await expect(page.locator('#cookLog li')).toContainText('4 servings');
  await expect(page.locator('#cookLog li')).toContainText('More chilli next time');

  // The paused timer stays pinned outside cooking mode until it is stopped.
  await expect(page.locator('#timerTray .timer-chip')).toContainText('Chilli oil eggs');
  await page.getByRole('button', { name: 'Stop the Step 2 timer' }).click();
  await expect(page.locator('#timerTray')).toHaveCount(0);

  // The entry can be deleted, and the deletion undone.
  await page.getByRole('button', { name: /Delete the entry from/ }).click();
  await expect(page.locator('#cookLog')).toHaveCount(0);
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#cookLog li')).toHaveCount(1);
});

test('a timer rings when it runs out', async ({ page }) => {
  await page.locator('#btnCook').click();
  await page.locator('#btnNextStep').click();
  await page.locator('#btnNextStep').click();
  await page.clock.install();
  await page.getByRole('button', { name: 'Start 3 min' }).click();
  await page.clock.runFor(181_000);
  await expect(page.locator('#timerTray .timer-chip.done')).toHaveCount(1);
  await expect(page.locator('.toast')).toContainText('the Step 2 timer is done');
  await page.getByRole('button', { name: 'Clear the Step 2 timer' }).click();
  await expect(page.locator('#timerTray')).toHaveCount(0);
});

test('closing keeps your place, and swiping or tapping the edges moves', async ({ page }) => {
  await page.locator('#btnCook').click();
  await page.locator('#btnNextStep').click();
  const box = (await page.locator('.cook-page').boundingBox())!;
  // Tap the right edge for the next step, the left edge for the one before.
  await page.mouse.click(box.x + box.width - 10, box.y + 40);
  await expect(page.locator('#cookProgress')).toHaveText('Step 2 of 3');
  await page.mouse.click(box.x + 10, box.y + 40);
  await expect(page.locator('#cookProgress')).toHaveText('Step 1 of 3');
  await page.keyboard.press('ArrowRight');

  await page.locator('#btnCookClose').click();
  await expect(page.locator('#recipeTitle')).toBeVisible();
  await page.locator('#btnCook').click();
  await expect(page.locator('#cookProgress')).toHaveText('Step 2 of 3');
  await expect(page.locator('.toast')).toContainText('Picked up at step 2');

  // Leaving from the end starts afresh next time.
  await page.locator('#btnNextStep').click();
  await page.locator('#btnNextStep').click();
  await page.locator('#btnLeaveCook').click();
  await page.locator('#btnCook').click();
  await expect(page.locator('#cookProgress')).toHaveText('Mise en place');
});

test('read aloud and the volume key setting live in Settings', async ({ page }) => {
  await page.locator('#tabSettings').click();
  await expect(page.locator('#switchReadAloud')).toHaveAttribute('aria-checked', 'false');
  await page.locator('#switchReadAloud').click();
  await expect(page.locator('#switchReadAloud')).toHaveAttribute('aria-checked', 'true');
  // Volume keys exist only on Android.
  await expect(page.locator('#switchVolumeKeys')).toHaveCount(0);
  await page.locator('#tabRecipes').click();
  await page.locator('#btnCook').click();
  await expect(page.locator('#btnReadAloud')).toHaveAttribute('aria-pressed', 'true');
});
