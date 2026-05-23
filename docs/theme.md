# etch — theme

Single source of truth for the game's visual identity. Used by:

- **CLI** (TypeScript + OpenTUI on Bun) — the game itself
- **Landing page** (Astro on Cloudflare Pages) — etch.rip

Each client implements the same role table in whatever format its medium
expects. The CLI passes hex strings to OpenTUI's `fg` / `bg` props on
`<text>` and `<box>` (e.g. `<text fg="#c8a16f">…</text>`); OpenTUI's Zig
core resolves them to terminal colors. The landing page uses CSS custom
properties.

When changing a color, update this doc *and* every implementation that uses it.

## palette

| Role     | CSS hex   | ANSI 256 | Mood / use                          |
|----------|-----------|----------|-------------------------------------|
| bg       | `#0a0908` | 232      | near-black, slight warm tint        |
| fg       | `#b8a99c` | 187      | default body text — dust            |
| dim      | `#5a5048` | 240      | system, ambient, barely there       |
| accent   | `#c8a16f` | 179      | player name, prompts, HUD highlight |
| danger   | `#8a2c1f` | 124      | damage, escalations, death          |
| chat     | `#6f8a72` | 108      | other players' speech               |
| rule     | `#2a2520` | 234      | borders, separators                 |

**Mapped to:**
- `cli/src/ui/theme.ts` — exports the palette for OpenTUI components
- `web/src/styles/theme.css` — defines CSS custom properties for the Astro
  landing page

## typography

- **CLI:** rendered in the player's terminal. font is whatever they have set.
  we lean on contrast and color for hierarchy, not weight.
- **Landing page:** JetBrains Mono via Google Fonts (300 for body, 400 for
  headings). monospace fallback if the font fails to load.

## layout

All clients aim for the same three-region shape:

- **Top bar** — HUD (player name · depth · stamina · deepest)
- **Middle** — story, chat, combat narration, ambient (scrolling)
- **Bottom bar** — current band + input prompt

Possibly a fourth region (inventory or combat overlay) added later.

Sizes are medium-native; concept is shared.

## mood

Restrained. Lots of empty space. Low contrast text. Nothing screams.
Horror comes from the prose and the pacing, not the UI.

Capitalize sparingly. Punctuation softly. Animations subtle if any.
