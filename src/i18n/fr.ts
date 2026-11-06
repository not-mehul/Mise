import type { Messages } from './index.svelte';

const fr: Messages = {
  'app.tagline': 'Des recettes de partout, cuisinées une étape à la fois.',

  'tabs.sections': 'Sections',
  'tabs.recipes': 'Recettes',
  'tabs.groceries': 'Courses',
  'tabs.settings': 'Réglages',

  'recipes.label': 'Vos recettes',
  'recipes.emptyTitle': 'Pas encore de recettes',
  'recipes.emptyBody': 'Partagez une recette avec Mise depuis Instagram, un site ou vos photos, ou collez-la. Vous la vérifiez avant de l’enregistrer.',
  'recipes.count': { one: '{count} recette', other: '{count} recettes' },

  'groceries.label': 'Liste de courses',
  'groceries.emptyTitle': 'Rien à acheter',
  'groceries.emptyBody': 'Ajoutez les ingrédients depuis la page d’une recette, ou saisissez un article. Ce qui est coché descend en bas de son rayon.',

  'settings.appearance': 'Apparence',
  'settings.theme': 'Thème',
  'settings.themeSystem': 'Système',
  'settings.themeDusk': 'Dusk',
  'settings.themeDawn': 'Dawn',
  'settings.themeHint': 'Système suit le mode clair ou sombre du téléphone.',
  'settings.dawnSwitch': 'Thème Dawn',
  'settings.language': 'Langue',
  'settings.languageSystem': 'Celle du téléphone',
  'settings.about': 'À propos',
  'settings.version': 'Version {version}',
  'settings.privacyTerm': 'Privé.',
  'settings.privacy': 'Les recettes restent sur cet appareil. Mise n’utilise le réseau que pour récupérer une page que vous lui partagez.',

  'action.close': 'Fermer',
  'action.cancel': 'Annuler',
  'action.undo': 'Annuler',
  'toast.saveFailed': 'Impossible d’enregistrer ce changement. Réessayez.',
};

export default fr;
