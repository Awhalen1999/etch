# Comment Convention

TypeScript, across the whole monorepo (cli, api, web).

Default to writing no comments. Code with well-named functions and types
explains itself. Comments are for the *why* that the code can't show.

## File header

Lead a non-trivial file with a brief `//` block: what the file is, and
anything a reader genuinely needs upfront. A few lines max — not a
paragraph.

```ts
// etch — inscription API.
//
// Three routes plus a sanity-check root:
//   GET  /                      → "etch api"
//   POST /api/account           → claim a name, get a token
//   POST /api/inscriptions      → carve an inscription (token required)
//   GET  /api/inscriptions      → list all inscriptions
//
// Backed by Cloudflare D1 (two tables: accounts, inscriptions).
```

Skip the header on small files where the filename and exports already
tell the story.

## Section dividers

Group related code with `// ---- Label ----` dividers. Capitalize the
label, four dashes each side.

```ts
// ---- Types ----

export interface Env { ... }

// ---- Constants ----

const NAME_MIN = 3;

// ---- Entry point ----

export default { ... }
```

Use these freely in longer files. A reader should be able to skim the
dividers to navigate.

## Inline comments

Only when the *why* isn't obvious from the code. Never restate what the
code does.

```ts
// good — explains a non-obvious choice
const buf = new Uint8Array(64); // 64 is the largest frame any encoder emits

// bad — restates the code
const id = next++; // increment id
```

## Doc comments (JSDoc / TSDoc)

Avoid them as the default. TypeScript's types already describe
signatures; editor tooltips read straight from those.

Reach for `/** */` only when there's *non-obvious* behavior a caller
needs to know — invariants, side effects, units, surprising edge cases.
One short paragraph max.

```ts
/** Reads the save file. Returns null if it doesn't exist yet (first launch). */
export function loadSave(): SaveState | null { ... }
```

Don't write `/** Loads the save. */ function loadSave()` — the name
already says that.

## What NOT to comment

- Imports
- Obvious control flow
- Closing braces / JSX closing tags
- Restating type annotations
- `TODO` / `FIXME` without a tracked issue
- The current task or PR ("added for the inscription flow", "fixes #42")
  — those belong in commit messages, not the codebase
