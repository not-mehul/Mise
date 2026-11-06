import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const CAPTION = `Crispy chilli oil eggs 🌶️
Save this for breakfast!

2 eggs
1 tbsp chilli oil
1 spring onion, sliced
Splash of soy sauce

Heat the chilli oil in a small pan over medium heat until it sizzles.
Crack in the eggs and fry for 3 minutes, spooning the oil over the whites.

#breakfast`;

async function pasteRecipe(page: Page, text: string) {
  await page.locator('#btnNewRecipe').click();
  await page.locator('#choicePaste').click();
  await page.locator('#pasteText').fill(text);
  await page.locator('#btnRead').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#viewRecipes .empty-title')).toBeVisible();
});

test('pastes a caption, sorts the leftover line and saves the recipe', async ({ page }) => {
  await pasteRecipe(page, CAPTION);
  await expect(page.locator('#editTitle')).toHaveValue('Crispy chilli oil eggs');
  await expect(page.locator('.unsorted .line')).toHaveText('Splash of soy sauce');
  await page.locator('.unsorted').getByRole('button', { name: 'Ingredient' }).click();
  await expect(page.locator('.unsorted')).toHaveCount(0);
  await expect(page.locator('#editIngredients')).toHaveValue(/Splash of soy sauce$/);
  await page.locator('#editServings').fill('2');
  await page.locator('#btnSaveRecipe').click();

  await expect(page.locator('#recipeTitle')).toHaveText('Crispy chilli oil eggs');
  await expect(page.locator('.ingredient')).toHaveCount(4);
  await expect(page.locator('.steps .timer')).toHaveText('3 minutes');

  // Scaling doubles the eggs.
  await page.getByRole('button', { name: 'More servings' }).click();
  await page.getByRole('button', { name: 'More servings' }).click();
  await expect(page.locator('.ingredient').first()).toContainText('4');

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);

  await page.locator('#btnBack').click();
  await expect(page.locator('#recipeList li')).toHaveCount(1);
  await expect(page.locator('#tabRecipes .badge')).toHaveText('1');
});

test('writes a recipe by hand and asks for what is missing', async ({ page }) => {
  await page.locator('#btnNewRecipe').click();
  await page.locator('#choiceWrite').click();
  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('.field-error').first()).toHaveText('Give the recipe a name.');
  await page.locator('#editTitle').fill('Tomato toast');
  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('.field-error')).toHaveText('Add at least one ingredient or step.');
  await page.locator('#editIngredients').fill('2 slices bread\n1 tomato\nSalt, to taste');
  await page.locator('#editSteps').fill('Toast the bread.\nRub with tomato and salt.');
  await page.locator('#editTags').fill('breakfast, quick');
  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('#recipeTitle')).toHaveText('Tomato toast');
  await expect(page.locator('.chip-tag')).toHaveText(['#breakfast', '#quick']);

  // Edit keeps the recipe and changes it.
  await page.locator('#btnEdit').click();
  await page.locator('#editTitle').fill('Pan con tomate');
  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('#recipeTitle')).toHaveText('Pan con tomate');

  // It survives a reload.
  await page.reload();
  await expect(page.locator('#recipeList li')).toHaveCount(1);
  await expect(page.locator('#recipeList')).toContainText('Pan con tomate');
});

test('searches, files into collections, and deletes with undo', async ({ page }) => {
  await pasteRecipe(page, 'Lentil soup\nIngredients\n200 g red lentils\n1 onion\nMethod\nSimmer everything for 25 minutes.');
  await page.locator('#btnSaveRecipe').click();
  await page.locator('#newCollection').fill('Weeknights');
  await page.locator('#newCollection').press('Enter');
  await expect(page.locator('.collections .chip')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btnBack').click();

  await pasteRecipe(page, 'Banana bread\nIngredients\n3 bananas\n250 g flour\nMethod\nBake for 1 hour.');
  await page.locator('#btnSaveRecipe').click();
  await page.locator('#btnBack').click();
  await expect(page.locator('#recipeList li')).toHaveCount(2);

  await page.locator('#recipeSearch').fill('lentils');
  await expect(page.locator('#recipeList li')).toHaveCount(1);
  await page.locator('#recipeSearch').fill('');
  await page.getByRole('radio', { name: 'Weeknights' }).click();
  await expect(page.locator('#recipeList')).toContainText('Lentil soup');
  await expect(page.locator('#recipeList li')).toHaveCount(1);
  await page.getByRole('radio', { name: 'All' }).click();

  await page.locator('#recipeList').getByText('Banana bread').click();
  await page.locator('#btnDelete').click();
  await expect(page.locator('#recipeList li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#recipeList li')).toHaveCount(2);
});

test('exports a backup and imports it again', async ({ page }) => {
  await pasteRecipe(page, 'Flatbread\nIngredients\n250 g flour\n150 ml water\nMethod\nKnead for 5 minutes.');
  await page.locator('#btnSaveRecipe').click();
  await page.locator('#tabSettings').click();
  const download = page.waitForEvent('download');
  await page.locator('#btnBackup').click();
  const file = await (await download).path();

  // A fresh browser profile has nothing; the backup brings the recipe back.
  await page.evaluate(() => indexedDB.deleteDatabase('mise'));
  await page.reload();
  await page.locator('#tabSettings').click();
  await page.locator('#importFile').setInputFiles(file);
  await expect(page.locator('.toast')).toContainText('Imported: 1 new, 0 updated');
  await page.locator('#tabRecipes').click();
  await expect(page.locator('#recipeList')).toContainText('Flatbread');
});
