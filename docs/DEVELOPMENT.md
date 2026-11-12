# Developing Mise

How Mise is built, run and tested. For what the app does, see the [README](../README.md); for cutting a release, see [RELEASING.md](../RELEASING.md).

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
- **TikTok, YouTube and other apps**: a TikTok video's caption comes from
  TikTok's public oEmbed, a YouTube video's (or Short's) description from its
  page, and a Facebook, Threads or Pinterest post from its link preview
  (`src/import/social.ts`). Lines like "Macros: 520 kcal | 45g P | 50g C | 12g
  F" become the recipe's macros per serving.
- **Photos** are read offline by ML Kit text recognition, bundled in the APK
  (`TextRecognitionPlugin.java`). Several photos become one recipe in the order
  you picked them, and two-column pages are read column by column
  (`src/import/photo.ts`). The first photo becomes the recipe's picture. The web
  build has no recogniser and offers paste instead.
- **A link you already saved** offers to open that recipe instead, or to import
  it again.
- **Recipe files**: a Mise backup or recipe, a Paprika export or schema.org
  JSON. One recipe opens on the review screen; a file of several asks before
  it adds them.

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

All six apps list `mise` in their copy of `links.ts`, so any of them can open
Mise this way.

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

Releases are a tag push that builds a signed APK; see [RELEASING.md](../RELEASING.md).

## Testing and CI

`.github/workflows/ci.yml` runs one job, **Check**, on pull requests and on
pushes to `main`: `npm run check` (dusk-dawn checks, lint, typecheck, unit
tests), then a production build and the Playwright tests (paste and write
recipes, scaling, search, collections, backup and restore, cooking mode,
theme and language, axe on every tab in both themes).

The Android build and the emulator tests (Espresso-Web driving the real
WebView, then a launch smoke test of the minified release build, on API 36)
run only on demand: **Actions → CI → Run workflow**, with *Android* ticked.
Every release tag builds the APK as well ([RELEASING.md](../RELEASING.md)).

## Layout

| Path | What it is |
| --- | --- |
| `src/App.svelte`, `src/main.ts` | Shell and bootstrap |
| `src/components/` | The Recipes list, recipe page and editor, the New recipe sheet, Plan, Groceries and Settings; `ui/` holds Sheet, Switch and EmptyState |
| `src/domain/` | Plain data and rules, no UI: recipes, ingredient lines, quantities, units and conversion, step timers, the plan, pantry matching, voice commands, settings |
| `src/import/` | Readers that turn something shared into a recipe draft: `text.ts` (pasted text and captions), `web.ts` and `schema.ts` (links), `instagram.ts`, `social.ts` (TikTok, YouTube, link previews), `photo.ts` (reading order for recognised text), `files.ts` (backups, Paprika, recipe JSON) |
| `src/data/` | The IndexedDB library (Dexie): recipes, collections, photos, groceries, the plan, deletions |
| `src/state/` | The library, groceries, plan, timers, settings, export/import/backups, folder sync, the widget, and UI state (screens, toast, the Android back stack) |
| `src/lib/` | Backups (.zip with fflate) and Markdown |
| `src/platform/` | `links.ts`, `mise://` and share-sheet intake, text recognition, timer alarms, the sync folder, shortcuts and widget, voice, files out, sharing, photo downscaling, theme and system bars |
| `src/i18n/` | English, Spanish, French and German; `en.ts` is the reference and a unit test checks the others |
| `src/styles/app.css` | Imports `dusk-dawn/tokens.css` and `dusk-dawn/components.css` first, then Mise's layout |
| `tests/unit`, `tests/e2e` | Vitest and Playwright |
| `android/` | The Capacitor Android project (`io.github.notmehul.mise`) |
