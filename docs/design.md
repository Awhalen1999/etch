# etch — game design reference

## what it is

A **single-player text horror game** with one asynchronous shared layer
(inscriptions carved on walls). The surface is dead from heat. You fell
into a mineshaft and can't climb out. The only way is down. Enemies live
below. The queen waits at depth 200.

Runs locally. Distributed as `npx etch-cli`. A small REST API at `api.etch.rip`
handles the shared inscription layer — no real-time multiplayer.

## architecture

| layer | shared? |
|---|---|
| inscriptions on walls (incl. death markers) | yes — via `api.etch.rip` |
| encounters (enemies, queen) | no — local |
| items (spawns, inventory) | no — local |
| queen state | no — per-player |
| stamina, depth, deepest, progress | no — local save file |

Inscriptions are the only multiplayer surface — an asynchronous shared
world. The wall remembers everyone, even though you never meet them.
Everything else is your own private descent.

## world

The shaft is one dimension: depth, an integer 1 to 200.

- depth 0: the surface. Reachable only at the end of the queen victory
  cutscene, after killing the queen.
- depth 1: where you wake. Horris is here. The overhang above blocks the
  way up.
- depth 200: the queen.

Players exist at one integer depth. The world is private — other players
don't appear in your scroll.

| band | depths |
|---|---|
| the surface | 0 (post-queen only) |
| the dust    | 1-30 (Horris, where you wake) |
| the stone   | 31-80 |
| the writing | 81-120 |
| the damp    | 121-160 |
| the quiet   | 161-199 |
| the queen   | 200 |

First-visit messages fire the first time a player's `deepest_depth` crosses
into a new band — no separate per-band flag needed. The dust has no
first-visit message (the opening cutscene serves that purpose). The queen
has her own approach cutscene (see `docs/story.md`).

## opening

New accounts get an authored cutscene on first launch. Plays once.

Two pieces:

1. **Landing prose** — drips line-by-line on the title/register screen
   *before* the player types their name. Three days of walking, the fall,
   "dust. impact. nothing." Lives in `prose.ts` as `LANDING_PROSE`.
2. **Opening cutscene** — plays right after they pick a name. They wake
   at depth 1 to find Horris in the shade, who explains the climb out is
   impossible and hands over a headlamp. Ends on the internal commitment:
   "i am not dying here." Lives in `prose.ts` as `OPENING_CUTSCENE`.

Returning players skip both. They resume where they last logged out.

Horris is permanent at depth 1. Doesn't move. Speaks on triggers: re-entering
depth 1 after going deeper (`HORRIS_RETURN`), respawning after death
(`HORRIS_RESPAWN`), idle inactivity (`HORRIS_IDLE`). Disappears narratively
during the queen-victory cutscene — the spot where he sat is bare when
the player climbs back through depth 1.

## core loop

1. Boot → register (first time) or resume (subsequent launches)
2. Descend with `/down`, paying stamina
3. Rest, read inscriptions, carve marks. Resting at depth ≥ 41 rolls for
   encounters every 5 seconds.
4. Fight, escape, or die. Encounters disable text input and swap the
   layout into the combat scene.
5. Ascend with `/up`, paying more stamina, with rest stops along the way.
6. `/quit` → state persists locally.

## stamina

- base pool: **100**
- `/down` costs **4** stamina
- `/up` costs **8** stamina
- `/rest` recovers **2 stamina per second** while resting
- 2-second cooldown between successful moves
- stamina items in inventory passively raise your max while held

Descending is cheap. Ascending is real work. Running out of stamina deep
means you can't leave on your own — your only option is to keep going
down, or to die there.

## communication

The only outward communication is asynchronous — carved into walls:

- `/mark <text>` — carve a persistent inscription at the current depth.
  Synced through the API. Seen by every future player who passes this
  depth and types `/read`.
- `/read` — list every inscription at the current depth (from the local
  cache; refreshed periodically).

Deaths automatically carve a death-marker: `{name} fell here. {YYYY-MM-DD}.`

No chat. No shouting. No whispering. You are alone in the dark. The only
voices are the names already on the walls.

## commands

Text commands (typed at the prompt, outside of encounters):

| command | does |
|---|---|
| `/down` | descend one level |
| `/up` | ascend one level |
| `/rest` | sit and recover stamina |
| `/mark <text>` | carve inscription at current depth (synced via API) |
| `/read` | read inscriptions at current depth (from local cache) |
| `/take` | pick up loot at current depth |
| `/drop <item>` | leave an item (removed from inventory) |
| `/me` | character sheet |
| `/help` | command reference |
| `/quit` | save and exit |

Combat keystrokes (single keys, no `Enter`, only during an encounter):

| key | does |
|---|---|
| **F** | engage when an encounter spawns (pre-combat only) |
| **S** | strike — press when the bar is in the sweet spot |
| **B** | brace — same timing rule |
| **E** | escape (30 stamina, moves you up ~10% of current depth) |

Text input is disabled during encounters; the combat keys take direct
control.

## encounters

Below depth 40, enemies can find you while resting. Encounter rolls happen
every 5 seconds while resting:

| depth | chance per roll |
|---|---|
| 1-40 | 0% (never) |
| 41-80 | 5% |
| 81-120 | 10% |
| 121-160 | 15% |
| 161-199 | 20% |

An encounter has two phases: **pre-combat** (decide to engage or flee) and
**in-combat** (actually fight).

All encounters are ephemeral — no enemy state is stored anywhere. Fights
are per-player and independent.

### pre-combat

When an enemy arrives:

- normal `/up`, `/down`, and text input are disabled
- a 15-second timer appears in the footer
- **F** to engage (free, no stamina cost)
- **E** to escape (30 stamina, moves you up ~10% of depth)
- if 15s expires with no input, the enemy takes you and you die
- force-quitting during pre-combat or in-combat also kills the character
  (the `combat-lock.json` file persists across crashes — next launch
  detects it and runs the death flow at the locked depth)

### in-combat (single-press timing)

Once engaged, the layout shifts into the dedicated combat scene with three
panels:

- **enemy** — name + HP bar
- **moment** — the current telegraph (bright) and last action result (dim)
- **timing** — a bouncing fill bar with a sweet spot in the middle, plus
  the S/B/E key hints

Each round:

1. The enemy commits an intent (`attack` or `open`, 50/50) and a telegraph
   string drawn from the matching pool.
2. The timing bar starts bouncing at a constant speed — one full
   left→right→left cycle every **2 seconds**.
3. The player presses **S** (strike) or **B** (brace) whenever they want.
   **No timeout.**
4. The bar position at press time decides the outcome:

| timing | read | result |
|---|---|---|
| in sweet spot | matches enemy intent | clean — full damage / full block |
| in sweet spot | wrong intent | wrong-call (see matrix below) |
| outside sweet spot | any | the press doesn't land; enemy resolves anyway |

Skill axes:

- **reading the telegraph** — pick S or B based on the prose
- **timing the press** — wait for the bar to enter the sweet zone

Both must align for a clean hit.

### wrong-call math

When the press lands inside the sweet spot but the read is wrong:

|     | enemy attacks | enemy open |
|---|---|---|
| **S** | -40 stamina, deal 0 (you swung into it) | full damage, -5 stamina |
| **B** | block, -5 stamina | wasted, -5 stamina |

Wrong strike is punishing (40 stamina). Wrong brace is mild (5 stamina).
This rewards aggressive play with good reads.

### timing miss

If the press lands outside the sweet spot:

- enemy attacking → you take the wrong-strike penalty (-40 stamina, mitigated by defense items)
- enemy open → "the moment is gone." No damage either way.

### ambiguous telegraphs

At deeper depths, some telegraphs are intentionally unreadable
(`"it slips out of the light. you only hear it breathing."`). The intent
is still committed; the player just can't see it.

| depth | ambiguous chance |
|---|---|
| 1-80 | 0% |
| 81-120 | 10% |
| 121-160 | 20% |
| 161-199 | 30% |

### combat damage

Base strike damage: **50 HP**. Modified by attack items (additive, stacking).

Enemy HP scales by band:

| band | enemy HP |
|---|---|
| 41-80 | 100 |
| 81-120 | 175 |
| 121-160 | 225 |
| 161-199 | 275 |
| 200 (queen) | 1000 |

Enemy HP is shown live in the enemy panel.

### escape (E)

- costs **30 stamina**
- moves you up by 10% of your current depth, rounded up (minimum depth 1)
- always succeeds. no roll.
- available in both pre-combat and in-combat

Example: encounter at depth 150 → E costs 30 stamina and moves you to
depth 135.

## the queen (depth 200)

A per-player boss encounter. Same combat system as regular enemies, scaled up.

- queen HP: **1000**
- entering depth 200 the first time triggers the approach cutscene
  (`QUEEN_APPROACH`); subsequent arrivals get a short return line
- same bouncing-bar timing, S/B/E controls
- queen telegraphs are unique (own attack/open/ambiguous pools)
- wrong-strike penalty is still 40 stamina
- E escape available: 30 stamina, moves to depth 180. resets queen HP.
- if stamina hits 0 mid-fight, you die
- force-quitting during the queen fight kills you (combat-lock anti-cheese)
- queen HP resets on death or escape — no saving progress, all-or-nothing
- on kill, the queen victory cutscene plays once (`QUEEN_VICTORY`) and
  walks the player through the sac, the frantic dying ants, the climb,
  and the surface. When the cutscene ends, the player is at depth 0 with
  `queenKilled = true`.

The narrative beats (acid sac, the climb out, Horris being gone, finding
the surface) are part of the victory cutscene — they aren't separate
mechanical systems. The single piece of persistent post-kill state is
the `queenKilled` flag.

## items

Three categories. All stack additively while held. All lost on death.

**attack items** — weapons. Increase damage per clean strike (base 50).

| rarity | value | examples |
|---|---|---|
| common    | +10 | wooden stick, bent nail, rock shard |
| uncommon  | +15 | rusted hammer, broken crowbar |
| rare      | +20 to +25 | pickaxe, saw blade, jagged shard, mandible |
| very rare | +30 to +35 | obsidian shard, queen's tooth |

**defense items** — gear. Reduce the wrong-strike stamina penalty (base 40).

| rarity | value | examples |
|---|---|---|
| common    | -2 | hard hat, leather scraps, thick gloves |
| uncommon  | -3 | miner's vest, shoulder guard |
| rare      | -5 | plate fragment, carapace shard |
| very rare | -7 | chitin plate, rib cage |

**stamina items** — passive max-stamina buffs while held.

| rarity | value | examples |
|---|---|---|
| common    | +5  | strip of dried meat, water pouch |
| uncommon  | +10 | mystery bottle, pouch of pills |
| rare      | +15 to +20 | mre kit, mutant frog |
| very rare | +25 to +30 | preserved heart, queen's nectar |

Total catalog: ~28 distinct kinds (canonical list in `cli/src/game/items.ts`).

Constraints:

- inventory size: **5 slots**
- all item effects are passive while held (no activation)
- items stack: 4 max-tier attack items = 50 + 30 + 30 + 35 + 35 = 180 damage per strike
- on death, all carried items are lost
- items show their stats in `/me`

## item spawning

Items spawn for you when you first enter a depth. Each player rolls
independently. The spawn pool is weighted by depth:

| depth | pool |
|---|---|
| 1-40    | common only |
| 41-120  | common + uncommon |
| 121-160 | common + uncommon + rare |
| 161-199 | uncommon + rare + very rare |

Deeper depths give better loot but cost more to reach.

## death

On death:

- a permanent inscription is carved at the depth where you died
  (`{name} fell here. {YYYY-MM-DD}.`) — synced to the API
- you respawn at depth 1 with full stamina
- deepest depth reached is preserved
- all carried items are lost
- Horris greets you with a `HORRIS_RESPAWN` line

## hud

Persistent status line at the top of the screen, always visible.

`{name} · depth {N} · stamina ████░░ X/MAX · deepest {N}`

The HUD never moves. The scroll fills the middle. The footer at the
bottom swaps between three things depending on phase:

- **explore** — the `> ` input prompt
- **pre-combat** — F/E hints + draining 15s bar
- **in-combat** — replaced entirely by the combat scene

When a cutscene is playing, the footer shows a dim `"..."` and input is
locked.

## persistence

**local** (`~/.etch/`):

- `account.json` — `{ name, token }`
- `save.json` — depth, stamina, deepest, queenKilled, seenQueenApproach,
  resting state, inventory, last-move timestamp
- `inscriptions.json` — local cache of every inscription (updated in the
  background; game works offline against this cache)
- `combat-lock.json` — exists only while in pre-/in-combat; survives crashes

**remote** (Cloudflare D1 via `api.etch.rip`):

- all inscriptions (including death markers)
- account name → token mapping

Does not survive:

- in-progress encounter state (HP, round number — all ephemeral)
- force-quit during an encounter (combat-lock kills you on next launch)

## rendering

The CLI renders with [OpenTUI](https://github.com/anomalyco/opentui) — a
React reconciler on a native Zig core, running under Bun. Layouts share
the HUD on top and swap the rest based on `state.phase`:

- **explore** — HUD + scroll + input bar (or `"..."` indicator during a cutscene)
- **pre-combat** — same shape, with the F/E timer in the footer
- **in-combat** — HUD on top, then a dedicated combat scene (enemy + moment + timing panels) taking the full remainder

The bouncing bar uses Unicode block characters (`▏▎▍▌▋▊▉█`) for sub-cell
smoothness and re-renders 10× per second during a fight. All color choices
come from the shared theme; see `docs/theme.md` for the palette and
`docs/tech.md` for the directory layout.

## tech

See `docs/tech.md` for the full reference.

Short version: TypeScript + OpenTUI on Bun for the CLI (published to npm as
per-platform compiled binaries via the esbuild-style wrapper pattern).
Cloudflare Workers + D1 for the inscription API. Astro on Cloudflare
Pages for the landing site. No persistent server. No real-time multiplayer.
Total cost: $0 at expected scale.
