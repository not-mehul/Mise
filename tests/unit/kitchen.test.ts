import { describe, expect, it } from "vitest";
import {
  mergeKitchen,
  normaliseKitchen,
  stock,
  takeOut,
  usedBy,
} from "../../src/domain/kitchen";
import { prepAhead, prepReminders, remindAt } from "../../src/domain/prep";
import { draftToRecipe, emptyDraft } from "../../src/domain/recipe";
import { cookableWith } from "../../src/domain/pantry";
import { normaliseSettings } from "../../src/domain/settings";

const recipe = (title: string, ingredients: string, steps = "Cook.") =>
  draftToRecipe({ ...emptyDraft(), title, ingredients, steps }, undefined);
const at = (iso: string) => new Date(iso);

describe("In the kitchen", () => {
  it("stocks things once each, newest first, leaving out staples", () => {
    let k = stock([], ["Lemons", "salt"], ["salt"], at("2026-01-01T10:00:00Z"));
    k = stock(k, ["lemon", "Rice"], ["salt"], at("2026-01-02T10:00:00Z"));
    expect(k.map((x) => x.item)).toEqual(["lemon", "Rice"]);
    expect(takeOut(k, ["rice"]).map((x) => x.key)).toEqual(["lemon"]);
  });

  it('knows what a recipe used, and feeds "What can I cook?"', () => {
    const risotto = recipe(
      "Risotto",
      "300 g arborio rice\n1 onion\n50 g parmesan",
    );
    const k = stock([], ["Rice", "Onions", "Lemons"], []);
    expect(usedBy(risotto, k).sort()).toEqual(["onion", "rice"]);
    const have = k.map((x) => x.key);
    expect(cookableWith([risotto], have, [])[0]!.missing).toEqual(["parmesan"]);
  });

  it("merges two copies, keeping what was taken out after it came in", () => {
    const mine = stock([], ["rice"], [], at("2026-01-01T10:00:00Z"));
    const theirs = stock([], ["rice", "eggs"], [], at("2026-01-01T09:00:00Z"));
    // They used the rice after this phone stocked it; this phone took the eggs out later.
    const merged = mergeKitchen(mine, { egg: "2026-01-01T11:00:00Z" }, theirs, {
      rice: "2026-01-01T12:00:00Z",
    });
    expect(merged.kitchen).toEqual([]);
    const kept = mergeKitchen(mine, {}, theirs, {});
    expect(kept.kitchen.map((x) => x.key).sort()).toEqual(["egg", "rice"]);
  });

  it("survives storage", () => {
    expect(
      normaliseKitchen([
        { key: "rice", item: "Rice", at: "2026-01-01T10:00:00Z" },
        { key: 2 },
        null,
      ]),
    ).toHaveLength(1);
    expect(normaliseSettings({}).kitchen).toEqual([]);
    expect(normaliseSettings({}).prepReminders).toBe(true);
  });
});

describe("Prep ahead", () => {
  it("finds steps to start well before cooking", () => {
    expect(prepAhead("Soak the beans overnight.")).toEqual({
      hours: 12,
      overnight: true,
    });
    expect(prepAhead("Marinate the chicken for at least 4 hours.")).toEqual({
      hours: 4,
      overnight: false,
    });
    expect(prepAhead("Chill the dough for 6–8 hours.")).toEqual({
      hours: 8,
      overnight: false,
    });
    expect(prepAhead("Refrigerate at least 24 hours.")).toEqual({
      hours: 24,
      overnight: true,
    });
    expect(prepAhead("Make the custard the day before.")).toEqual({
      hours: 12,
      overnight: true,
    });
  });

  it("leaves slow cooking and short waits alone", () => {
    expect(prepAhead("Braise for 4 hours until tender.")).toBeNull();
    expect(prepAhead("Let it rest for 2 hours.")).toBeNull();
    expect(prepAhead("Leave to prove for 1 hour.")).toBeNull();
  });

  it("reminds the evening before, or hours before a 6 pm meal", () => {
    expect(
      new Date(remindAt("2026-03-10", { hours: 12, overnight: true })),
    ).toEqual(new Date(2026, 2, 9, 20));
    expect(
      new Date(remindAt("2026-03-10", { hours: 4, overnight: false })),
    ).toEqual(new Date(2026, 2, 10, 14));
    // Too long to fit in the day: the evening before.
    expect(
      new Date(remindAt("2026-03-10", { hours: 14, overnight: false })),
    ).toEqual(new Date(2026, 2, 9, 20));
  });

  it("lists the reminders still to come for planned meals", () => {
    const beans = recipe(
      "Beans",
      "500 g beans",
      "Soak the beans overnight.\nSimmer for an hour.",
    );
    const plan = [
      {
        id: "a",
        date: "2026-03-10",
        recipeId: beans.id,
        servings: null,
        listed: false,
      },
      {
        id: "b",
        date: "2026-03-01",
        recipeId: beans.id,
        servings: null,
        listed: false,
      },
    ];
    const due = prepReminders(plan, [beans], new Date(2026, 2, 5).getTime());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      entryId: "a",
      title: "Beans",
      step: "Soak the beans overnight.",
      overnight: true,
    });
    expect(
      prepReminders(plan, [beans], new Date(2026, 2, 5).getTime())[0]!.id,
    ).toBe(due[0]!.id);
  });
});
