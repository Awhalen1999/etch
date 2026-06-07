# etch — theme

Single source of truth for the game's visual identity. Used by:

- **CLI** (TypeScript + OpenTUI on Bun) — the game itself
- **Landing page** (Astro on Cloudflare Pages) — etch.rip

Each client implements the same role table in whatever format its medium
expects. The CLI passes hex strings to OpenTUI's `fg` / `bg` props on
`<text>` and `<box>` (e.g. `<text fg="#c8a16f">…</text>`); OpenTUI's Zig
core resolves them to terminal colors. The landing page uses CSS custom
properties.

When changing a color, update this doc *and* every implementation that
uses it.

## palette

| role     | CSS hex   | ANSI 256 | mood / use                                |
|----------|-----------|----------|-------------------------------------------|
| `bg`     | `#0a0908` | 232      | near-black, slight warm tint              |
| `fg`     | `#b8a99c` | 187      | default body text — dust                  |
| `dim`    | `#5a5048` | 240      | system, ambient, barely-there beats       |
| `accent` | `#c8a16f` | 179      | player name, prompts, command echoes      |
| `danger` | `#8a2c1f` | 124      | damage, escalations, death, the ETCH logo |
| `chat`   | `#6f8a72` | 108      | NPC dialog (quoted)                       |
| `rule`   | `#2a2520` | 234      | borders, dividers                         |

**Implemented in:**

- `cli/src/ui/theme.ts` — exports the palette as a frozen object for
  OpenTUI components
- `web/src/styles/theme.css` — defines the same values as CSS custom
  properties (`--bg`, `--fg`, etc.)

## line styles

The CLI scroll wraps every line in a `LineView` that picks a palette role
from the line's `LineStyle`. This is the canonical mapping (in
`cli/src/ui/line-view.tsx`):

| line style | role used | when |
|---|---|---|
| `system`  | `dim`    | meta lines ("you wake at depth 1.", "type /help for commands.") |
| `story`   | `fg`     | authored narration — the default voice |
| `dialog`  | `chat`   | NPC speech, wrapped in quotes |
| `thought` | `accent` | the player's internal voice |
| `ambient` | `dim`    | atmospheric one-liners between bands |
| `pause`   | `dim`    | the `"..."` beat between cutscene lines |
| `echo`    | `accent` | player's own commands, prefixed `> ` |
| `error`   | `danger` | refusal lines ("you don't have the strength.") |

## typography

- **CLI** — rendered in the player's terminal. Font is whatever they have
  set. We lean on color and spacing for hierarchy, not weight.
- **Landing page** — JetBrains Mono via Google Fonts. Monospace fallback
  if the font fails to load.

## layout

All clients aim for the same three-region shape:

- **Top bar** — HUD (player name · depth · stamina · deepest)
- **Middle** — story, narration, ambient, command echoes (scrolling)
- **Bottom bar** — input prompt (or combat scene during a fight)

The CLI in-combat phase replaces the middle and bottom regions entirely
with the combat scene (enemy / moment / timing panels). HUD stays.

## mood

Restrained. Lots of empty space. Low contrast text. Nothing screams.
Horror comes from the prose and the pacing, not the UI.

Capitalize sparingly. Punctuation softly. Animations subtle if any —
the bouncing combat bar is the only animated UI element.
