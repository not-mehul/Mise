import type { Messages } from './index.svelte';

const es: Messages = {
  'app.tagline': 'Recetas de cualquier sitio, cocinadas paso a paso.',

  'tabs.sections': 'Secciones',
  'tabs.recipes': 'Recetas',
  'tabs.groceries': 'Compra',
  'tabs.settings': 'Ajustes',

  'recipes.label': 'Tus recetas',
  'recipes.emptyTitle': 'Aún no hay recetas',
  'recipes.emptyBody': 'Comparte una receta con Mise desde Instagram, una web o tus fotos, o pégala. La revisas antes de guardarla.',
  'recipes.count': { one: '{count} receta', other: '{count} recetas' },

  'groceries.label': 'Lista de la compra',
  'groceries.emptyTitle': 'Nada que comprar',
  'groceries.emptyBody': 'Añade los ingredientes desde la página de una receta o escribe un artículo. Lo marcado baja al final de su pasillo.',

  'settings.appearance': 'Apariencia',
  'settings.theme': 'Tema',
  'settings.themeSystem': 'Sistema',
  'settings.themeDusk': 'Dusk',
  'settings.themeDawn': 'Dawn',
  'settings.themeHint': 'Sistema sigue el modo claro u oscuro del teléfono.',
  'settings.dawnSwitch': 'Tema Dawn',
  'settings.language': 'Idioma',
  'settings.languageSystem': 'El del teléfono',
  'settings.about': 'Acerca de',
  'settings.version': 'Versión {version}',
  'settings.privacyTerm': 'Privado.',
  'settings.privacy': 'Las recetas se quedan en este dispositivo. Mise solo usa la red para descargar una página que compartes con él.',

  'action.close': 'Cerrar',
  'action.cancel': 'Cancelar',
  'action.undo': 'Deshacer',
  'toast.saveFailed': 'No se pudo guardar el cambio. Inténtalo de nuevo.',
};

export default es;
