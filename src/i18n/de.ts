import type { Messages } from './index.svelte';

const de: Messages = {
  'app.tagline': 'Rezepte von überall, Schritt für Schritt gekocht.',

  'tabs.sections': 'Bereiche',
  'tabs.recipes': 'Rezepte',
  'tabs.groceries': 'Einkauf',
  'tabs.settings': 'Einstellungen',

  'recipes.label': 'Deine Rezepte',
  'recipes.emptyTitle': 'Noch keine Rezepte',
  'recipes.emptyBody': 'Teile ein Rezept aus Instagram, von einer Website oder aus deinen Fotos mit Mise, oder füge es ein. Du prüfst es, bevor es gespeichert wird.',
  'recipes.count': { one: '{count} Rezept', other: '{count} Rezepte' },

  'groceries.label': 'Einkaufsliste',
  'groceries.emptyTitle': 'Nichts zu kaufen',
  'groceries.emptyBody': 'Füge die Zutaten auf der Seite eines Rezepts hinzu oder tippe einen Artikel ein. Abgehaktes rutscht ans Ende seines Gangs.',

  'settings.appearance': 'Darstellung',
  'settings.theme': 'Design',
  'settings.themeSystem': 'System',
  'settings.themeDusk': 'Dusk',
  'settings.themeDawn': 'Dawn',
  'settings.themeHint': 'System folgt dem hellen oder dunklen Modus des Telefons.',
  'settings.dawnSwitch': 'Dawn-Design',
  'settings.language': 'Sprache',
  'settings.languageSystem': 'Wie das Telefon',
  'settings.about': 'Über',
  'settings.version': 'Version {version}',
  'settings.privacyTerm': 'Privat.',
  'settings.privacy': 'Rezepte bleiben auf diesem Gerät. Mise nutzt das Netz nur, um eine Seite zu laden, die du mit ihm teilst.',

  'action.close': 'Schließen',
  'action.cancel': 'Abbrechen',
  'action.undo': 'Rückgängig',
  'toast.saveFailed': 'Die Änderung konnte nicht gespeichert werden. Versuch es noch einmal.',
};

export default de;
