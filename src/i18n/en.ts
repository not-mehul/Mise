// The interface strings. English is the reference: es, fr and de must have
// every key with the same placeholders (tests/unit/i18n.test.ts).
const en = {
  'app.tagline': 'Recipes from anywhere, cooked one step at a time.',

  'tabs.sections': 'Sections',
  'tabs.recipes': 'Recipes',
  'tabs.groceries': 'Groceries',
  'tabs.settings': 'Settings',

  'recipes.label': 'Your recipes',
  'recipes.emptyTitle': 'No recipes yet',
  'recipes.emptyBody': 'Share a recipe to Mise from Instagram, a website or your photos, or paste it in. You check it before it is saved.',
  'recipes.count': { one: '{count} recipe', other: '{count} recipes' },

  'groceries.label': 'Grocery list',
  'groceries.emptyTitle': 'Nothing to buy',
  'groceries.emptyBody': 'Add a recipe’s ingredients from its page, or type an item. Ticked items sink to the bottom of their aisle.',

  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeSystem': 'System',
  'settings.themeDusk': 'Dusk',
  'settings.themeDawn': 'Dawn',
  'settings.themeHint': 'System follows your phone’s light or dark setting.',
  'settings.dawnSwitch': 'Dawn theme',
  'settings.language': 'Language',
  'settings.languageSystem': 'Same as the phone',
  'settings.about': 'About',
  'settings.version': 'Version {version}',
  'settings.privacyTerm': 'Private.',
  'settings.privacy': 'Recipes stay on this device. Mise uses the network only to fetch a page you share with it.',

  'action.close': 'Close',
  'action.cancel': 'Cancel',
  'action.undo': 'Undo',
  'toast.saveFailed': 'Couldn’t save that change. Try again.',
} as const;

export default en;
