import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The web build fetches pages with fetch(), so these pages are served by
// Playwright with CORS allowed. On Android the request is native.
const PAGE = 'https://recipes.example/lemon-pasta?utm_source=share';
const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Lemon pasta',
  author: { '@type': 'Person', name: 'Ana Ruiz' },
  recipeYield: '2 servings',
  totalTime: 'PT20M',
  recipeIngredient: ['200 g spaghetti', '1 lemon', '30 g parmesan'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil the pasta for 10 minutes.' }, { '@type': 'HowToStep', text: 'Toss with lemon and parmesan.' }],
};
const HTML = `<!doctype html><html><head><title>Lemon pasta</title><script type="application/ld+json">${JSON.stringify(SCHEMA)}</script></head><body></body></html>`;

async function serve(page: Page, url: RegExp | string, body: string, status = 200) {
  await page.route(url, (route) => route.fulfill({ status, body, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' } }));
}

async function openLink(page: Page, url: string) {
  await page.locator('#btnNewRecipe').click();
  await page.locator('#choiceLink').click();
  await page.locator('#linkInput').fill(url);
  await page.locator('#btnReadLink').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#viewRecipes .empty-title')).toBeVisible();
});

test('imports a recipe page, then offers the saved one for the same link', async ({ page }) => {
  await serve(page, /recipes\.example/, HTML);
  await openLink(page, PAGE);

  // The review screen, with nothing saved yet.
  await expect(page.locator('#recipeEditor h2')).toHaveText('Check the recipe');
  await expect(page.locator('#editTitle')).toHaveValue('Lemon pasta');
  await page.locator('#ingModeText').click();
  await expect(page.locator('#editIngredients')).toHaveValue('200 g spaghetti\n1 lemon\n30 g parmesan');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('#recipeTitle')).toHaveText('Lemon pasta');
  await expect(page.locator('.source a')).toHaveText('Ana Ruiz');

  // The same page again, with different tracking: Mise offers the saved recipe.
  await page.locator('#tabRecipes').click();
  await openLink(page, 'https://recipes.example/lemon-pasta/');
  await expect(page.locator('#savedNotice')).toContainText('You already saved Lemon pasta from this link.');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('#btnOpenSaved').click();
  await expect(page.locator('#recipeTitle')).toHaveText('Lemon pasta');
});

test('a pasted link is fetched like a typed one, and nothing is kept without saving', async ({ page }) => {
  await serve(page, /recipes\.example/, HTML);
  await page.locator('#btnNewRecipe').click();
  await page.locator('#choicePaste').click();
  await page.locator('#pasteText').fill(PAGE);
  await page.locator('#btnRead').click();
  await expect(page.locator('#editTitle')).toHaveValue('Lemon pasta');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#viewRecipes .empty-title')).toBeVisible();
});

test('asks for the caption when Instagram keeps it to itself', async ({ page }) => {
  await serve(page, /instagram\.com/, '<html><head><title>Login • Instagram</title></head></html>');
  await openLink(page, 'https://www.instagram.com/reel/C9xYz1ab/?igsh=xyz');
  await expect(page.locator('#pasteReason')).toContainText('Instagram didn’t share this caption');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('#pasteText').fill('Iced coffee\nIngredients\n200 ml milk\n2 shots espresso\nMethod\nPour over ice.');
  await page.locator('#btnRead').click();
  await page.locator('#btnSaveRecipe').click();
  await expect(page.locator('#recipeTitle')).toHaveText('Iced coffee');
  await expect(page.locator('.source a')).toHaveAttribute('href', 'https://www.instagram.com/reel/C9xYz1ab/');
});

test('says when a page cannot be opened, and keeps the link', async ({ page }) => {
  await serve(page, /recipes\.example/, 'gone', 500);
  await openLink(page, PAGE);
  await expect(page.locator('.field-error')).toContainText('Couldn’t open that page');
  await expect(page.locator('#linkInput')).toHaveValue(PAGE);
});

test('photos are read in the Android app; the web offers paste', async ({ page }) => {
  await page.locator('#btnNewRecipe').click();
  await page.locator('#choicePhotos').click();
  await expect(page.locator('#photosWebNotice')).toContainText('Reading photos works in the Android app.');
});
