# Mise

A cooking companion. Share a recipe to Mise from Instagram, a website, a photo
of a cookbook page or plain text; check what it read and save it to your
collection; cook it one step at a time; and turn it into a grocery list.

Mise is a [Capacitor 8](https://capacitorjs.com/) app for Android with a
[Svelte 5](https://svelte.dev/) + TypeScript UI built by Vite. Recipes stay on
the phone. There are no accounts and no server: photos are read by the phone's
own text recognition, and the network is used only to fetch a page you share.

It uses **Editorial Dusk & Dawn**, the design system it shares with Waymark,
BookShelf, Ledger, Colophon and Rosetta. Everything shared (tokens, Fraunces,
the shared components and the colour checks) comes from one package,
[`dusk-dawn`](https://github.com/not-mehul/dusk-dawn), pinned at `v1.0.0`; its
`style.md` is the spec. Design changes go into that package, never into Mise.

## Status

The plan has six phases, each one pull request:

| Phase | What it adds | State |
| --- | --- | --- |
| 1. Scaffold | App shell, tabs, theme, languages, CI, APK release workflow | Done |
| 2. Collection | Recipe model, ingredient parser, scaling, paste and write import, recipe page, search, collections, backups | Done |
| 3. Cooking mode | One step per screen, mise en place, timers, keep-awake, volume keys, read aloud, cook log | Done |
| 4. Groceries | List from recipes with merging, aisles, staples, sharing | Done |
| 5. Import | Links (schema.org), Instagram captions, on-device text recognition for photos, Android share intents | Done |
| 6. Suite links | `mise://` in the sibling apps' `links.ts`, `dusk-dawn` v1.1.0 | Next |

## Cooking mode

*Start cooking* on a recipe opens it full screen at the servings and units you
chose. A *mise en place* page lists everything to gather, then each step gets
its own screen in large type with the ingredients it names underneath. Move
with the buttons, a sideways swipe, a tap on the outer edge, the arrow keys or,
on Android, the volume keys (down is next). *All steps* jumps anywhere.

A duration in a step is a *Start* button. Timers run side by side, stay pinned
at the top of the app until you clear them, and ring with a system
notification at the moment they end (`src/state/timers.svelte.ts`), so they
work with the phone locked or Mise closed. The screen stays on while cooking
mode is open, and *Read steps aloud* speaks each step with the phone's voice.
Close and come back within four hours to pick up at the same step. The last
page marks the recipe as cooked, with an optional rating and note, in the
recipe's cook log.

## Groceries

One running list, grouped by aisle in shop order. *Add to groceries* on a
recipe offers its ingredients at the servings and units you chose, all ticked
except your pantry staples (salt, pepper, oil and whatever you add). The same
item from two recipes becomes one line: quantities of one kind add up (200 g and
900 g make 1.1 kg) and the rest sit side by side (200 g + 2 tbsp butter), with
the recipes listed under it. You can also type items in ("2 lemons"), with
suggestions from what you added before.

Aisles come from an offline word list in English, Spanish, French and German
(`src/domain/groceries.ts`). Move an item and Mise remembers where it goes.
Ticked items sink to the bottom of their aisle, *Clear ticked* can be undone,
and *Share* sends what is left as plain text.

## How a recipe is read

*New recipe* asks where the recipe is: a link, photos, pasted text, or by hand.
On Android you can also share to Mise from any app: a link or caption
(Instagram, a browser, a message) or one or more photos. Every import ends on
the same review screen, and nothing is saved until you press *Save recipe*.

- **Links** are fetched by the phone itself (`src/import/web.ts`). Most recipe
  sites publish a schema.org Recipe for search engines, as JSON-LD or
  microdata, and Mise reads it field for field (`src/import/schema.ts`),
  including the picture. Pages without one fall back to the page's main text,
  read like pasted text.
- **Instagram** posts and reels: Mise reads the caption from the public post
  page (`src/import/instagram.ts`). Instagram often refuses automated readers;
  when it does, Mise asks you to paste the caption and keeps the link as the
  source. Videos are not transcribed.
- **Photos** are read offline by ML Kit text recognition, bundled in the APK
  (`TextRecognitionPlugin.java`). Several photos become one recipe in the order
  you picked them, and two-column pages are read column by column
  (`src/import/photo.ts`). The first photo becomes the recipe's picture. The web
  build has no recogniser and offers paste instead.
- **A link you already saved** offers to open that recipe instead, or to import
  it again.

Pasted text goes through `src/import/text.ts`. It finds the title, servings and
times, then the ingredients and method by their headings (in English, Spanish,
French and German) or, without headings, by the shape of each line. Each
ingredient line is split into quantity, unit, item and note
(`src/domain/ingredient.ts`), which is what makes scaling and the metric/US
switch work; the line as written is always kept. Durations in steps become
timers. Lines the parser can't place are shown under *Unsorted* on the review
screen, and nothing is saved until you press *Save recipe*.

## Links from the other apps

Mise answers the scheme every app in the suite shares (`src/platform/links.ts`,
style.md §14.1). A link never saves anything; it only opens a screen.

| Link | What Mise does |
| --- | --- |
| `mise://open` | Brings Mise to the front |
| `mise://open?id=<recipe>` | Opens that recipe, if it is on the phone |
| `mise://import?url=<page>` | Opens the import review for that page |

`links.ts` already lists `mise` here. The five sibling apps take the same file
in phase 6, so until then they cannot send to Mise.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # contrast, lint, literal colours, typecheck, unit tests
npm run test:e2e     # builds, then Playwright at phone size with axe accessibility checks
```

Android, with JDK 21 and Android Studio (SDK Platform 37):

```sh
npm run android      # build, sync and open Android Studio
npm run android:run  # build and run on a connected phone
npm run android:apk  # a debug APK in android/app/build/outputs/apk/debug/
npm run icons        # redraw the launcher icons from assets/icon-source.svg
```

Locally, Playwright can reuse an installed Chromium with
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

Releases are a tag push that builds a signed APK; see [RELEASING.md](RELEASING.md).

## Testing and CI

`.github/workflows/ci.yml` runs on every push:

| Job | Covers |
| --- | --- |
| Lint, typecheck, unit tests | `npm run check` and a production build |
| End-to-end | Playwright: paste and write recipes, the Unsorted list, scaling, search, collections, delete and undo, backup and restore, theme and language, axe in both themes |
| Android build | Debug, R8-minified release and test APKs, Android lint |
| Android emulator (API 36, 37) | Espresso-Web test driving the real WebView, then a launch smoke test of the minified release build. API 37 is non-blocking, as in Ledger |

## Layout

| Path | What it is |
| --- | --- |
| `src/App.svelte`, `src/main.ts` | Shell and bootstrap |
| `src/components/` | The Recipes list, recipe page and editor, the New recipe sheet, Groceries and Settings; `ui/` holds Sheet, Switch and EmptyState |
| `src/domain/` | Plain data and rules, no UI: recipes, ingredient lines, quantities, units and conversion, step timers, settings |
| `src/import/` | Readers that turn something shared into a recipe draft: `text.ts` (pasted text and captions), `web.ts` and `schema.ts` (links), `instagram.ts`, `photo.ts` (reading order for recognised text) |
| `src/data/` | The IndexedDB library (Dexie): recipes, collections, photos |
| `src/state/` | The library, settings, export/import/backups, and UI state (screens, toast, the Android back stack) |
| `src/lib/` | Backups (.zip with fflate) and Markdown |
| `src/platform/` | `links.ts`, `mise://` and share-sheet intake, text recognition, files out, sharing, photo downscaling, theme and system bars |
| `src/i18n/` | English, Spanish, French and German; `en.ts` is the reference and a unit test checks the others |
| `src/styles/app.css` | Imports `dusk-dawn/tokens.css` and `dusk-dawn/components.css` first, then Mise's layout |
| `tests/unit`, `tests/e2e` | Vitest and Playwright |
| `android/` | The Capacitor Android project (`io.github.notmehul.mise`) |
