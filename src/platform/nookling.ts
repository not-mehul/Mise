// ============================================================
// A dish for the nookling (style.md §14.1): once something is cooked, Mise
// offers to tell Nookling, which opens with a card asking whether to add the
// dish to the pet's Pantry. Only offered when Nookling is installed, and the
// link carries nothing but the recipe's name.
// ============================================================

import { AppLauncher } from '@capacitor/app-launcher';
import { buildLink } from './links';
import { isNative } from './output';

export function cookedLink(dish: string): string {
  return buildLink('nookling', 'cooked', { dish: dish.trim().slice(0, 120) }, 'mise');
}

/** Whether Nookling is on this phone. */
export async function hasNookling(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await AppLauncher.canOpenUrl({ url: 'nookling://' })).value;
  } catch {
    return false;
  }
}

/** Opens Nookling with the dish. False when it couldn't. */
export async function tellNookling(dish: string): Promise<boolean> {
  if (!isNative) return false;
  try {
    await AppLauncher.openUrl({ url: cookedLink(dish) });
    return true;
  } catch {
    return false;
  }
}
