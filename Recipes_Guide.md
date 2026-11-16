# Writing recipes for Mise

This guide describes the **Mise text format**: a plain-text way to write a recipe so that Mise fills in every field exactly, with nothing left to guess. It also sets out how a recipe should be written so it works well in cooking mode, scaling, unit conversion and the grocery list.

The format is Markdown, so a recipe written this way reads well in any notes app too.

---

## 1. How to use it

1. Write or convert the recipe in the format below.
2. In Mise, tap **New recipe**, then **Paste text**.
3. Paste the whole recipe into the box and tap **Read recipe**.
4. Check the review screen, add a photo if you like, and tap **Save recipe**.

Nothing is saved until you tap Save recipe, so a paste is always safe to try.

Mise writes this same format when you **Share** a recipe as text or use **Export as Markdown** in Settings. A recipe shared from one phone and pasted on another comes back the same, collections included.

**One recipe per paste.** A Markdown export of the whole library holds many recipes separated by `---`; paste them one at a time, or use a backup to move a whole library.

---

## 2. The format at a glance

```markdown
# Recipe title

Serves: 4
Prep: 15 min
Cook: 30 min
Total: 45 min
Tags: tag one, tag two
Collections: Weeknights
Source: https://example.com/the-recipe
Author: Who wrote it
Calories: 450
Protein: 30 g
Carbs: 40 g
Fat: 12 g

An optional sentence or two about the dish.

## Ingredients

### For the first part
- 200 g first ingredient, prepared like this
- 1 tbsp second ingredient

### For the second part
- 2 eggs

## Method

### First part
1. First instruction, for 5 minutes.
2. Second instruction.

### Second part
3. Third instruction.

## Notes

Anything else: storage, swaps, serving ideas.
```

Only three things are required: the **title line**, and an **Ingredients** or a **Method** section. Every field and every other section is optional; leave out what you don't know rather than guessing.

---

## 3. How Mise recognises the format

Mise reads pasted text in this format when both of these are true:

- The **first line that isn't blank** is the title, written as `# ` (a hash and a space) followed by the name.
- Somewhere below it there is a `## Ingredients` or a `## Method` heading (or one of the other names in §6).

If either is missing, Mise reads the text the ordinary way instead, by the shape of each line, the way it reads a social media caption. That still works, but lines it can't place go to a "sort these" list on the review screen. Following the format avoids that.

---

## 4. The title

```markdown
# Chicken tikka masala
```

- One `#`, a space, then the name. `#Chicken` with no space is a hashtag, not a title.
- Sentence case: capitalise the first word and proper nouns only (`Thai green curry`, not `Thai Green Curry`).
- Name the dish, not the story: `Lemon drizzle cake`, not `The best lemon cake you'll ever make`.
- No full stop at the end.

---

## 5. Fields

Fields go **between the title and the first `##` heading**, one per line, as `Name: value`. Field names can be in any case (`SERVES:` works), and the alternative names in the table mean the same thing.

| Field | Also accepted | What to write | Becomes |
|---|---|---|---|
| `Serves` | `Servings`, `Yield`, `Makes`, `Portions` | A whole number. Only the first number is read: `4`, `4 people`, `Makes 12 buns` | Servings, used for scaling |
| `Prep` | `Prep time`, `Preparation` | A duration (see below) | Prep time |
| `Cook` | `Cook time`, `Cooking`, `Bake`, `Baking time` | A duration | Cook time |
| `Total` | `Total time`, `Ready in`, `Time` | A duration | Total time. Leave it out and Mise shows prep + cook |
| `Tags` | `Tag`, `Keywords`, `Category` | Words separated by commas: `pasta, quick, vegetarian`. `#pasta #quick` also works | Tags, stored in lower case |
| `Collections` | `Collection` | Collection names separated by commas | Filed in those collections (see below) |
| `Source` | `URL`, `Link` | A web link starting with `https://`. Anything that isn't a link is taken as the author | The source link on the recipe page |
| `Author` | `By`, `Credit` | A name, site name or `@handle` | Shown on the recipe card and page |
| `Calories` | `kcal`, `Energy` | A number, per serving | Calories (kcal) |
| `Protein` | | A number of grams, per serving: `38` or `38 g` | Protein |
| `Carbs` | `Carbohydrates` | Grams per serving | Carbohydrate |
| `Fat` | | Grams per serving | Fat |
| `Nutrition` | `Macros`, `Per serving` | All four on one line: `450 kcal, 30 g protein, 40 g carbs, 12 g fat` | The same four fields |
| `Description` | `About`, `Summary` | A sentence about the dish | The top of the notes |

**Durations** can be written as `20 min`, `45 minutes`, `1 hr`, `1 hr 30 min`, `1h30`, `2 hours`, or a bare number of minutes (`90`). Mise stores minutes, and writes them back as `1 hr 30 min`.

**Collections** are matched to the ones you already have by name, ignoring capitals. A name you don't have yet becomes a new collection **when you save the recipe**, not when you paste it, so discarding the draft leaves nothing behind.

**Nutrition** is always per serving, matching the `Serves` line. Calories are kcal; protein, carbohydrate and fat are grams.

**Any other text** before the first `##` heading (a line that isn't one of these fields, or a field Mise doesn't know, such as `Difficulty: easy`) is kept as a description at the top of the notes. Nothing is thrown away.

Photos can't travel in text. Add them on the review screen before saving.

---

## 6. Sections

Sections start with `## ` (two hashes and a space). Mise knows these names, in any case:

| Section | Also accepted |
|---|---|
| `## Ingredients` | `## Ingredient`, `## What you'll need`, `## You'll need`, `## Shopping list` |
| `## Method` | `## Steps`, `## Directions`, `## Instructions`, `## Preparation`, `## How to make` |
| `## Notes` | `## Note`, `## Tips`, `## Recipe notes`, `## Cook's notes`, `## Storage` |

Any **other** `##` section (`## Equipment`, `## To serve`, `## Variations`) is kept in the notes under its own name, so you can add one without losing it.

Write the sections in the order Ingredients, Method, Notes.

---

## 7. Ingredients

```markdown
## Ingredients

### For the marinade
- 600 g boneless chicken thighs, cut into 3 cm pieces
- 150 g plain yoghurt
- 1 tbsp lemon juice

### For the sauce
- 1 can chopped tomatoes (400 g)
- salt, to taste
```

### Rules

- **One ingredient per line.** A leading `- ` is optional but recommended.
- **Groups** start with `### Name` (or a line of its own ending in a colon, like `For the sauce:`). Keep group names short and without digits (`For the dough`, not `Step 1 dough`), or Mise reads them as an ingredient. A recipe with one list of ingredients needs no group.
- **Shape of a line**: `amount unit name, preparation` — in that order.
  - **Amount**: `2`, `1.5`, `1½`, `1 1/2`, `3/4`, `½`. A range is `2–3` or `2-3` or `2 to 3`.
  - **Unit**: one of the units in the table below, or none for things you count (`2 eggs`, `1 onion`).
  - **Name**: what you buy, plainly: `onion`, `plain flour`, `chicken thighs`.
  - **Preparation and notes**: after a comma (`1 onion, finely chopped`) or in brackets (`1 can chopped tomatoes (400 g)`).
- **No amount**: write the name and a note: `salt, to taste`, `coriander, to serve (optional)`, `oil, for frying`.

### Units Mise understands

Write these and Mise can scale, convert between metric and US, and add amounts up on the grocery list.

| Kind | Write |
|---|---|
| Weight | `g`, `kg`, `oz`, `lb` |
| Volume | `ml`, `cl`, `dl`, `l`, `tsp`, `tbsp`, `cup`, `fl oz`, `pint`, `quart` |
| Counted | `clove`, `can` (or `tin`), `bunch`, `handful`, `slice`, `sprig`, `stick`, `pack` (or `packet`, `package`), `pinch`, `dash` |

Plurals and long forms (`grams`, `tablespoons`, `cloves`) work too. The short forms are preferred because they read cleanly when scaled.

### Best practice

- **Put the amount first, as a number.** `2 eggs`, not `two eggs` or `eggs (2)`. Numbers scale; words don't.
- **Prefer weights for baking** (`250 g flour`), and give a weight alongside a can or pack (`1 can chickpeas (400 g)`).
- **Keep preparation out of the name.** Write `1 onion, chopped`, not `1 chopped onion`. The name is what goes on the grocery list and what sorts it into an aisle, and `onion` from two recipes adds up to one line; `chopped onion` and `onion` don't.
- **Same ingredient, same name.** If salt appears in two groups, write `salt` both times.
- **Mark optional things** with `(optional)` and serving extras with `, to serve`.
- **List ingredients in the order they're used.**

---

## 8. Method

```markdown
## Method

### Marinate
1. Mix the yoghurt, lemon juice and salt in a bowl. Stir in the chicken thighs, cover and chill for at least 4 hours.

### Cook
2. Heat the oil in a large pan over a medium heat.
3. Fry the onion for 8 minutes, until soft and golden.
```

### Rules

- **One step per line.** Number them (`1.`), bullet them (`- `), or leave them plain.
- When steps are numbered or bulleted, a line **without** a number carries on the step above it. So a long step that wraps onto a second line is still one step.
- **Sections** start with `### Name` (or a short line ending in a colon, like `For the sauce:`). Use up to six words and no digits (`The day before`, not `Day 1`), or Mise reads the name as a step. Sections suit recipes with distinct parts: a dough and a filling, a marinade and a sauce.
- Numbering can carry on across sections or start again; Mise numbers the steps itself.

### What Mise does with your steps

- **Timers.** Every duration in a step becomes a tap-to-start timer in cooking mode: `for 10 minutes`, `5 min`, `1 hour 30 minutes` (one timer), `10–12 minutes` (a timer for the lower number). Seconds, minutes and hours all work.
- **Ingredients in the step.** A step is linked to each ingredient it mentions, so cooking mode shows the amounts you need right there. Mise matches the **last word** of an ingredient's name, singular or plural: `boneless chicken thighs` is found by "thighs" or "chicken thighs" (not "chicken" alone); `double cream` by "cream".
- **Temperatures.** Write `180 °C` or `350 °F`, and Mise converts them when you switch between metric and US.
- **Prep ahead.** A step that needs starting hours before ("marinate for at least 4 hours", "soak the beans overnight", "make the dough the day before") gets a reminder when the recipe is on the meal plan. Mise counts waits of 4 hours or more.

### Best practice

- **One action per step**, or a few closely linked ones. Cooking mode shows one step per screen, and a short step is easier to follow with messy hands.
- **Start with the verb**: "Heat the oil…", "Stir in the cream…".
- **Give a time and a sign of doneness**: "Fry the onion for 8 minutes, until soft and golden." The time sets the timer; the sign tells you when it's really done.
- **Write the heat and the pan**: "over a medium heat", "in a large pan".
- **Name ingredients the way the ingredient list does**, using at least the last word of the name, so they link.
- **Write durations as numbers** with a unit (`10 minutes`, not `ten minutes`) so they become timers.
- **Say "for at least 4 hours" or "overnight"** for anything that must start ahead, so the reminder works.
- **Leave out** life stories, adverts, "Enjoy!" and hashtags. Put serving ideas, storage and swaps in the notes.

---

## 9. Notes

```markdown
## Notes

Keeps for 3 days in the fridge. Freezes well before the cream goes in.
```

Free text. Paragraphs (separated by a blank line) are kept. Good things for notes: storage and reheating, freezing, make-ahead, swaps and substitutions, what to serve it with, and where the recipe came from if there's no link.

---

## 10. House style

Mise's own text is restrained and precise, and recipes read best the same way:

- **Sentence case** everywhere: titles, groups, sections.
- **British or American spelling**, but one of them throughout a recipe.
- **Metric first** where you have both; Mise converts on request.
- **No exclamation marks, emoji or marketing words** ("amazing", "best ever").
- **Plain verbs**: "Stir", "Bake", "Season". Not "Gently give it a lovely stir".
- **Numbers as digits** for amounts, times and temperatures.

---

## 11. A complete example

```markdown
# Chicken tikka masala

Serves: 4
Prep: 20 min
Cook: 40 min
Total: 5 hr
Tags: indian, curry, make ahead
Collections: Weeknights
Source: https://example.com/chicken-tikka-masala
Author: Example Kitchen
Calories: 520
Protein: 38 g
Carbs: 18 g
Fat: 30 g

A mild, creamy curry. The chicken marinates for at least 4 hours, so start in the morning.

## Ingredients

### For the marinade
- 600 g boneless chicken thighs, cut into 3 cm pieces
- 150 g plain yoghurt
- 1 tbsp lemon juice
- 2 tsp garam masala
- 1 tsp salt

### For the sauce
- 2 tbsp neutral oil
- 1 large onion, finely chopped
- 3 cloves garlic, grated
- 1 tbsp ginger, grated
- 1 can chopped tomatoes (400 g)
- 150 ml double cream
- salt, to taste
- coriander, to serve (optional)

## Method

### Marinate
1. Mix the yoghurt, lemon juice, garam masala and salt in a bowl. Stir in the chicken thighs, cover and chill for at least 4 hours.

### Cook
2. Heat the grill to high. Spread the thighs on a lined tray and grill for 10 minutes, turning once, until charred at the edges.
3. Heat the oil in a large pan over a medium heat. Fry the onion for 8 minutes, until soft and golden.
4. Add the garlic and ginger and cook for 1 minute.
5. Pour in the tomatoes and simmer for 10 minutes.
6. Stir in the cream and the grilled thighs and simmer for 5 minutes. Season with salt.
7. Scatter with coriander and serve with rice.

## Notes

Keeps for 3 days in the fridge. Freezes well before the cream goes in.
```

Pasted into Mise, this fills in the title, 4 servings, 20, 40 and 300 minutes, three tags, the Weeknights collection, the link and author, all four macros, two ingredient groups with 13 ingredients, two method sections with 7 steps and their timers, a prep-ahead reminder for the marinade, and the description and notes together in the notes. (This exact example is checked by Mise's tests.)

---

## 12. Converting a recipe with an AI assistant

To turn a web page, a photo of a cookbook or a messy caption into this format, give an assistant this guide and the recipe, with a prompt like:

> Rewrite the recipe below in the Mise text format described in Recipes_Guide.md. Follow its rules and best practice exactly. Keep every ingredient, amount and step from the original; don't invent fields you can't find (leave them out). Put the original link in Source. Reply with only the recipe, in one code block.

Then copy the code block and paste it into Mise.

---

## 13. Checklist

Before pasting, check that:

- [ ] The first line is `# ` and the title.
- [ ] Fields are between the title and the first `##`, one per line, as `Name: value`.
- [ ] There's a `## Ingredients` and a `## Method` section.
- [ ] Each ingredient is one line: amount, unit, name, then preparation after a comma.
- [ ] Each step is one line (a wrapped line under a numbered step is fine).
- [ ] Group and section names are short and have no digits.
- [ ] Durations and temperatures are digits with units: `10 minutes`, `180 °C`.
- [ ] Steps name ingredients by at least the last word of their name.
- [ ] Nutrition, if given, is per serving.
