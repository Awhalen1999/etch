# etch — theme

Single source of truth for the game's visual identity. The web client and the
terminal renderer each implement these roles in their own format (CSS hex vs.
ANSI 256). When changing a color, update this doc *and* both implementations.

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
- `web/style.css` — `--bg`, `--fg`, `--dim`, `--accent`, `--danger`, `--chat`, `--rule`
- `src/render/palette.rs` — `BG`, `FG`, `DIM`, `ACCENT`, `DANGER`, `CHAT`, `RULE`

## typography

- **Web:** JetBrains Mono via Google Fonts (300 for body, 400 for HUD/accent).
  Monospace fallback if the font fails to load.
- **Terminal:** whatever the player's terminal renders. We control nothing.

## layout

Both clients aim for the same three-region shape:

- **Sticky top bar** — HUD (player name · depth · stamina · deepest)
- **Scrolling middle** — story, chat, combat narration, ambient
- **Sticky bottom bar** — current band + input prompt

Sizes by medium:

- **Web:** HUD/bottom ~2.5em; scroll area centered to 80ch max width
- **Terminal:** HUD/bottom 1 row each; full width via DECSTBM scroll region

## mood

Restrained. Lots of empty space. Low contrast text. Nothing screams.
Horror comes from the prose and the pacing, not the UI.

Capitalize sparingly. Punctuation softly. Animations subtle if any.
