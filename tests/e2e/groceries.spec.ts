import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PANCAKES = `Pancakes
Serves 2

Ingredients
200 g plain flour
2 eggs
300 ml milk
30 g butter
Pinch of salt

Method
Whisk everything together.
Fry in butter.`;

const OMELETTE = `Omelette
Serves 1

Ingredients
3 eggs
1 tbsp butter
50 g cheddar

Method
Beat the eggs and cook in the butter.`;

async function saveRecipe(page: Page, text: string) {
  await page.locator('#tabRecipes').click();
  await page.locator('#btnNewRecipe').click();
  await page.locator('#choicePaste').click();
  await page.locator('#pasteText').fill(text);
  await page.locator('#btnRead').click();
  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('#recipeTitle')).toBeVisible();
}

async function addAll(page: Page) {
  await page.locator('#btnAddGroceries').click();
  await page.locator('#btnAddToList').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#viewRecipes .empty-title')).toBeVisible();
});

test('adds two recipes, merges them by aisle, and shops', async ({ page }) => {
  await saveRecipe(page, PANCAKES);
  await page.locator('#btnAddGroceries').click();
  // Salt is a staple, so it starts unticked.
  await expect(page.locator('#btnAddToList')).toHaveText('Add 4 items');
  await expect(page.locator('.pick-item').filter({ hasText: 'salt' }).locator('input')).not.toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('#btnAddToList').click();
  await expect(page.locator('.toast')).toContainText('Added 4 items to groceries');

  await page.locator('#btnBack').click();
  await saveRecipe(page, OMELETTE);
  // Two omelettes.
  await page.getByRole('button', { name: 'More servings' }).click();
  await addAll(page);
  await page.locator('.toast').getByRole('button', { name: 'View' }).click();

  await expect(page.locator('#tabGroceries .badge')).toHaveText('5');
  await expect(page.locator('.aisle h3')).toHaveText(['Dairy and eggs', 'Pantry']);
  await expect(page.locator('[data-key="egg"] .name')).toHaveText('8 eggs');
  await expect(page.locator('[data-key="butter"] .name')).toHaveText('30 g + 2 tbsp butter');
  await expect(page.locator('[data-key="butter"] .from')).toHaveText('Pancakes, Omelette');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Tick in the shop: it sinks to the bottom of its aisle.
  await page.locator('[data-key="egg"] input').check();
  await expect(page.locator('#groceryCount')).toHaveText('4 to buy');
  await expect(page.locator('section[aria-labelledby="aisle-dairy"] .grocery').last()).toHaveAttribute('data-key', 'egg');
  await page.locator('#btnClearTicked').click();
  await expect(page.locator('[data-key="egg"]')).toHaveCount(0);
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-key="egg"]')).toHaveCount(1);
});

test('types items, moves one to another aisle and remembers it', async ({ page }) => {
  await page.locator('#tabGroceries').click();
  await expect(page.locator('#viewGroceries .empty-title')).toHaveText('Nothing to buy');
  await page.locator('#groceryInput').fill('2 lemons');
  await page.locator('#groceryInput').press('Enter');
  await page.locator('#groceryInput').fill('kitchen roll');
  await page.locator('#btnAddGrocery').click();
  await expect(page.locator('.aisle h3')).toHaveText(['Fruit and veg', 'Other']);
  await expect(page.locator('[data-key="lemon"] .name')).toHaveText('2 lemons');

  await page.getByRole('button', { name: 'More for kitchen roll' }).click();
  await page.getByRole('radio', { name: 'Pantry' }).click();
  await page.locator('#switchStaple').click();
  await expect(page.locator('#switchStaple')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#btnRemoveGrocery').click();
  await expect(page.locator('[data-key="kitchen roll"]')).toHaveCount(0);

  // Added again, it goes where it was moved.
  await page.locator('#groceryInput').fill('Kitchen roll');
  await page.locator('#groceryInput').press('Enter');
  await expect(page.locator('section[aria-labelledby="aisle-pantry"] [data-key="kitchen roll"]')).toHaveCount(1);

  // The staple shows in Settings and can be removed there.
  await page.locator('#tabSettings').click();
  await expect(page.locator('#staplesList')).toContainText('kitchen roll');
  await page.getByRole('button', { name: 'Remove kitchen roll' }).click();
  await expect(page.locator('#staplesList')).not.toContainText('kitchen roll');
  await page.locator('#stapleInput').fill('Rice');
  await page.locator('#stapleInput').press('Enter');
  await expect(page.locator('#staplesList')).toContainText('rice');
});

test('shares what is left as text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    // Headless Chromium has no share sheet; Mise falls back to the clipboard.
    Object.defineProperty(navigator, 'share', { value: undefined });
  });
  await page.reload();
  await page.locator('#tabGroceries').click();
  for (const item of ['2 lemons', '200 g butter', 'bread']) {
    await page.locator('#groceryInput').fill(item);
    await page.locator('#groceryInput').press('Enter');
  }
  await page.locator('[data-key="bread"] input').check();
  await page.locator('#btnShareList').click();
  await expect(page.locator('.toast')).toContainText('List copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Grocery list\n\nFruit and veg\n- 2 lemons\n\nDairy and eggs\n- 200 g butter');
});
