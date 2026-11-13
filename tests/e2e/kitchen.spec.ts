import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const RISOTTO = `Risotto
Serves 2

Ingredients
300 g arborio rice
1 onion
50 g parmesan

Method
Soften the onion.
Stir in the rice and stock until creamy.`;

const BEANS = `Black beans
Serves 4

Ingredients
500 g black beans
1 onion

Method
Soak the beans overnight.
Simmer for an hour.`;

async function saveRecipe(page: Page, text: string) {
  await page.locator("#tabRecipes").click();
  await page.locator("#btnNewRecipe").click();
  await page.locator("#choicePaste").click();
  await page.locator("#pasteText").fill(text);
  await page.locator("#btnRead").click();
  await page.locator("#btnSaveRecipe").click();
  await expect(page.locator("#recipeTitle")).toBeVisible();
}

/** With text at 200% (WCAG 1.4.4) the page never scrolls sideways. */
async function fits(page: Page, where: string) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const over = await page.evaluate(
    () =>
      document.scrollingElement!.scrollWidth -
      document.scrollingElement!.clientWidth,
  );
  expect(over, where).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#viewRecipes .empty-title")).toBeVisible();
});

test('ticked groceries go into the kitchen, feed "What can I cook?", and cooking uses them up', async ({
  page,
}) => {
  await saveRecipe(page, RISOTTO);
  await page.locator("#btnAddGroceries").click();
  await page.locator("#btnAddToList").click();
  await page.locator("#tabGroceries").click();
  await page.locator('[data-key="arborio rice"] input').check();
  await page.locator('[data-key="onion"] input').check();

  await page.locator("#tabRecipes").click();
  await page.locator("#btnBack").click();
  await page.locator("#btnWhatCanICook").click();
  await expect(page.locator("#kitchenList li")).toHaveText([
    "onion",
    "arborio rice",
  ]);
  await expect(page.locator("#cookableList")).toContainText(
    "Missing 1: parmesan",
  );
  expect(
    (await new AxeBuilder({ page }).include("#viewRecipes").analyze())
      .violations,
  ).toEqual([]);

  // Typed things can be kept too; a chip takes one out.
  await page.locator("#pantryInput").fill("parmesan");
  await page.locator("#kitchenKeep").click();
  await expect(page.locator("#kitchenList li")).toHaveCount(3);
  await expect(page.locator("#cookableList")).toContainText(
    "You have everything",
  );
  await page
    .getByRole("button", { name: "Remove parmesan from the kitchen" })
    .click();
  await expect(page.locator("#kitchenList li")).toHaveCount(2);

  // Unticking puts it back on the list and out of the kitchen.
  await page.locator("#tabGroceries").click();
  await page.locator('[data-key="onion"] input').uncheck();
  await page.locator('[data-key="onion"] input').check();

  // Cook it and log it: what it used leaves the kitchen.
  await page.locator("#tabRecipes").click();
  await page.locator("#btnWhatCanICook").click();
  await expect(page.locator("#kitchenList li")).toHaveText([
    "onion",
    "arborio rice",
  ]);
  await page
    .locator("#cookableList")
    .getByRole("button", { name: /Risotto/ })
    .first()
    .click();
  await page.locator("#btnCook").click();
  for (
    let i = 0;
    i < 6 && !(await page.locator("#btnMarkCooked").isVisible());
    i++
  )
    await page.locator("#btnNextStep").click();
  await page.locator("#btnMarkCooked").click();
  await expect(page.locator(".toast")).toContainText(
    "2 things used up from the kitchen",
  );
  await page.locator("#btnBack").click();
  await page.locator("#btnWhatCanICook").click();
  await expect(page.locator("#kitchenList")).toHaveCount(0);
  await expect(page.locator("#viewRecipes")).toContainText(
    "Groceries you tick off land here",
  );
});

test("a planned meal shows the steps to start ahead", async ({ page }) => {
  await saveRecipe(page, BEANS);
  await page.locator("#tabPlan").click();
  await page
    .getByRole("button", { name: /^Add a recipe to/ })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Black beans" }).click();
  await expect(page.locator(".prep")).toHaveText(
    "Start the day before: Soak the beans overnight.",
  );
});

test("every tab fits with text at 200%", async ({ page }) => {
  await saveRecipe(page, BEANS);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await fits(page, "recipe");
  await page.locator("#btnBack").click();
  await page.locator("#btnWhatCanICook").click();
  await fits(page, "recipes");
  for (const tab of ["#tabPlan", "#tabGroceries", "#tabSettings"]) {
    await page.locator(tab).click();
    await fits(page, tab);
  }
});
