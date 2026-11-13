// "In the kitchen" as the app changes it: groceries ticked off come in,
// cooking takes out what the recipe used, and you can add or remove by hand.

import { stock, takeOut, trimGone, usedBy } from "../domain/kitchen";
import type { Recipe } from "../domain/recipe";
import { settings } from "./settings.svelte";

export const kitchen = {
  get items() {
    return settings.current.kitchen;
  },

  /** Puts things in (staples are left out: they're always had). */
  add(items: readonly string[]): void {
    const next = stock(
      settings.current.kitchen,
      items,
      settings.current.staples,
    );
    const added = next.map((k) => k.key);
    const gone = Object.fromEntries(
      Object.entries(settings.current.kitchenGone).filter(
        ([key]) => !added.includes(key),
      ),
    );
    settings.update({ kitchen: next, kitchenGone: gone });
  },

  remove(keys: readonly string[]): void {
    if (!keys.length) return;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a timestamp, not state
    const now = new Date().toISOString();
    settings.update({
      kitchen: takeOut(settings.current.kitchen, keys),
      kitchenGone: trimGone({
        ...settings.current.kitchenGone,
        ...Object.fromEntries(keys.map((k) => [k, now])),
      }),
    });
  },

  clear(): void {
    this.remove(settings.current.kitchen.map((k) => k.key));
  },

  /** Takes out what a recipe used. Returns how many things that was. */
  cooked(recipe: Recipe): number {
    const used = usedBy(recipe, settings.current.kitchen);
    this.remove(used);
    return used.length;
  },
};
