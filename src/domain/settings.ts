import type { Locale } from '../i18n/index.svelte';
import { AISLES, DEFAULT_STAPLES, groceryKey, type Aisle } from './groceries';
import { normaliseGone, normaliseKitchen, type KitchenItem } from './kitchen';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type LanguageSetting = Locale | 'system';

export interface Settings {
  theme: ThemeSetting;
  language: LanguageSetting;
  /** When the last backup was written (ISO time), for the weekly automatic one. */
  lastBackupAt?: string;
  /** Cooking mode speaks each step as you reach it. */
  readAloud: boolean;
  /** Cooking mode turns the volume keys into next and back (Android). */
  volumeKeys: boolean;
  /** Grocery items always in the pantry, by key: left unticked when adding from a recipe. */
  staples: string[];
  /** Aisles you moved items to, by key, used the next time they are added. */
  aisles: Record<string, Aisle>;
  /** The screen stays on while the grocery list is open. */
  listAwake: boolean;
  /** Cooking mode listens for "next", "back" and "repeat" (Android). */
  handsFree: boolean;
  /** A folder (Android storage access URI) where Mise keeps a copy to sync through, or none. */
  syncFolder?: { uri: string; name: string };
  /** When the copy in the sync folder was last merged (ISO time). */
  lastSyncAt?: string;
  /** "In the kitchen": what you have in, from ticked groceries and what you add (src/domain/kitchen.ts). */
  kitchen: KitchenItem[];
  /** When each thing last left the kitchen, so a synced copy doesn't bring it back. */
  kitchenGone: Record<string, string>;
  /** Steps that need doing ahead ("soak overnight") get a reminder the day before (Android). */
  prepReminders: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', language: 'system', readAloud: false, volumeKeys: true, staples: DEFAULT_STAPLES, aisles: {}, listAwake: false, handsFree: false, kitchen: [], kitchenGone: {}, prepReminders: true };

const THEMES: readonly ThemeSetting[] = ['system', 'light', 'dark'];
const LANGUAGES: readonly LanguageSetting[] = ['system', 'en', 'es', 'fr', 'de'];

/** Settings read back from storage, with anything unknown replaced by the default. */
export function normaliseSettings(value: unknown): Settings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof Settings, unknown>>;
  const settings: Settings = {
    theme: THEMES.includes(v.theme as ThemeSetting) ? (v.theme as ThemeSetting) : DEFAULT_SETTINGS.theme,
    language: LANGUAGES.includes(v.language as LanguageSetting) ? (v.language as LanguageSetting) : DEFAULT_SETTINGS.language,
    readAloud: typeof v.readAloud === 'boolean' ? v.readAloud : DEFAULT_SETTINGS.readAloud,
    volumeKeys: typeof v.volumeKeys === 'boolean' ? v.volumeKeys : DEFAULT_SETTINGS.volumeKeys,
    staples: Array.isArray(v.staples) ? [...new Set(v.staples.filter((s): s is string => typeof s === 'string').map(groceryKey).filter(Boolean))].slice(0, 200) : [...DEFAULT_STAPLES],
    aisles:
      v.aisles && typeof v.aisles === 'object'
        ? Object.fromEntries(Object.entries(v.aisles as Record<string, unknown>).filter((e): e is [string, Aisle] => AISLES.includes(e[1] as Aisle)).slice(0, 500))
        : {},
    listAwake: typeof v.listAwake === 'boolean' ? v.listAwake : DEFAULT_SETTINGS.listAwake,
    handsFree: typeof v.handsFree === 'boolean' ? v.handsFree : DEFAULT_SETTINGS.handsFree,
    kitchen: normaliseKitchen(v.kitchen),
    kitchenGone: normaliseGone(v.kitchenGone),
    prepReminders: typeof v.prepReminders === 'boolean' ? v.prepReminders : DEFAULT_SETTINGS.prepReminders,
  };
  const folder = v.syncFolder as Partial<{ uri: unknown; name: unknown }> | undefined;
  if (folder && typeof folder.uri === 'string' && /^content:\/\//.test(folder.uri)) settings.syncFolder = { uri: folder.uri, name: typeof folder.name === 'string' ? folder.name : '' };
  if (typeof v.lastSyncAt === 'string' && !Number.isNaN(Date.parse(v.lastSyncAt))) settings.lastSyncAt = v.lastSyncAt;
  if (typeof v.lastBackupAt === 'string' && !Number.isNaN(Date.parse(v.lastBackupAt))) settings.lastBackupAt = v.lastBackupAt;
  return settings;
}
