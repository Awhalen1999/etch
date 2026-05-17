# etch — game design reference

## what it is

a multiplayer text horror mud. the surface is dead from heat. you fell into a mineshaft and can't climb out. the only way is down. enemies live below. the queen waits at depth 200.

single-player game, runs locally. distributed as `npx @etch/cli`. a small REST API at `api.etch.rip` handles the only shared layer: inscriptions carved on walls. no real-time multiplayer.

## architecture

etch is single-player with one shared layer: inscriptions on walls.

| layer | shared? |
|---|---|
| inscriptions on walls (incl. death markers) | yes — via api.etch.rip |
| encounters (enemies, queen) | no — local |
| items (spawns, inventory) | no — local |
| queen state | no — local |
| stamina, depth, deepest, progress | no — local save file |

inscriptions are the only multiplayer surface — an asynchronous shared world.
the wall remembers everyone, even though you never meet them. everything else
is your own private descent.

## world

the shaft is one dimension: depth, an integer 1 to 200.
- depth 0: the surface (reachable only after killing the queen via /ascent)
- depth 1: where you wake. the NPC is here. the overhang above blocks the way up.
- depth 200: the queen.

players exist at one integer depth. multiple players can share a depth.

| band | depths |
|---|---|
| the dust | 1-30 (npc, where you wake) |
| the stone | 31-80 |
| the writing | 81-120 |
| the damp | 121-160 |
| the quiet | 161-199 |
| the queen | 200 |

first-visit messages fire the first time a player crosses into a new band — derived from deepest_depth (no separate flag needed). the dust has no first-visit message; the opening cutscene serves that purpose. see STORY.md for all band prose.

## opening

new accounts get an authored cutscene on first login. plays once.

contents (see STORY.md for full text):
- three days walking through heat and cracked earth
- you find a hole, the edge crumbles, you fall
- you wake at depth 1 in an abandoned mineshaft
- the NPC (Horris) explains there's no way up — the lip overhangs
- Horris gives you a headlamp, says he's been here 2 years
- Horris is unsettlingly content — "i'm happy here. i like the quiet."
- you commit internally: "i am not dying here"
- gameplay begins at depth 1

returning players skip the intro. they resume wherever they last logged out.

Horris is permanent at depth 1. doesn't move. is not lookable via `/look` — `/look` is for other players only. speaks on certain triggers: re-entering depth 1 after going deeper, respawning after death, idle. see STORY.md for trigger pool. disappears after the queen is killed (see STORY.md escape sequence).

## core loop

1. connect → log in → resume position (or new-account intro)
2. descend, paying stamina
3. rest, read inscriptions, talk, carve — rest attracts enemies below depth 40
4. ascend, paying more stamina, with rest stops
5. disconnect → state persists: depth, stamina, items, deepest

## stamina

- base pool: 100
- `/down` costs 4 stamina
- `/up` costs 8 stamina
- `/rest` recovers 2 stamina per second while resting
- stamina items in inventory passively raise your max
- 2-second cooldown between successful moves

descending is cheap, ascending is real work. running out of stamina deep means you cannot leave.

## communication

the only outward communication is asynchronous — carved into the walls:

- `/mark <text>` → carve a persistent inscription at the current depth. seen by every future player who passes this depth and types `/read`.
- `/read` → list every inscription at the current depth.

deaths automatically carve a death-marker (`{name} fell here. {YYYY-MM-DD}.`).

there is no chat, no shouting, no whispering. you are alone in the dark. the
only voices are the names already on the walls.

## commands

text commands (typed at the prompt, outside of encounters):

| command | does |
|---|---|
| `/down` | descend one level |
| `/up` | ascend one level |
| `/rest` | sit and recover stamina |
| `/mark <text>` | carve inscription at current depth (synced via API) |
| `/read` | read inscriptions at current depth (from local cache) |
| `/take` | pick up loot at current depth |
| `/drop <item>` | leave item (removed from inventory) |
| `/me` | character sheet |
| `/help` | command reference |
| `/quit` | save and exit |

combat keystrokes (single keys, no `enter`, only during an encounter):

| key | does |
|---|---|
| **F** | engage when an encounter spawns |
| **S** | strike — press when the bar is in the sweet spot |
| **B** | brace — same timing rule |
| **E** | escape (30 stamina, moves you up ~10% of current depth) |

text input is disabled during encounters; the combat keys take direct control.

## encounters

below depth 40, enemies can find you while resting. encounter rolls happen every 5 seconds while resting:

| depth | chance per roll |
|---|---|
| 1-40 | 0% (never) |
| 41-80 | 5% |
| 81-120 | 10% |
| 121-160 | 15% |
| 161-199 | 20% |

an encounter has two phases: **pre-combat** (decide to engage or flee) and **in-combat** (actually fight).

all encounters are ephemeral — no state is stored anywhere. fights are per-player and independent.

### pre-combat

when an enemy arrives:

- normal `/up`, `/down`, and text input are disabled
- a timer line appears in the scroll, draining over 15 seconds
- **F** to engage (free, no stamina cost)
- **E** to escape (30 stamina, moves you up ~10% of depth)
- if 15s expires with no input, the enemy takes you and you die
- force-quitting during an encounter also kills the character (anti-cheese)

### in-combat (single-press timing)

once engaged, the layout shifts into a dedicated combat scene with three regions:

- **enemy** — name + HP bar
- **moment** — the current telegraph (bright) and last action result (dimmed)
- **timing** — a bouncing fill bar with a sweet spot in the middle, plus key hints

each round:

1. the enemy commits an intent (attacking or open, 50/50) and a telegraph string that matches
2. the timing bar starts bouncing at constant speed (1.6s full cycle by default)
3. the player presses **S** (strike) or **B** (brace) at any moment they choose — **no timeout**
4. the bar position at press time decides the outcome:

| timing | read | result |
|---|---|---|
| in sweet spot | matches enemy intent | action lands cleanly (deal damage / block) |
| in sweet spot | wrong intent | wrong-call damage (the old math) |
| outside sweet spot | any | action fails — enemy resolves anyway |

skill axes:
- **reading the telegraph** — pick S or B based on the prose
- **timing the press** — wait for the bouncing fill to reach the sweet zone

both must align for a clean hit.

### wrong-call math (when timing lands but read is wrong)

| | enemy attacks | enemy open |
|---|---|---|
| **S** | -40 stamina, deal 0 (faster, hits you) | deal 50+ damage, -5 stamina |
| **B** | block, -5 stamina | wasted, -5 stamina |

wrong strike is punishing (40 stamina). wrong brace is mild (5 stamina wasted). this rewards aggressive play with good reads.

### timing miss (press outside sweet spot, any read)

the action doesn't fire. the enemy resolves on its own:
- enemy attacking → you take the wrong-strike penalty (-40 stamina minus defense)
- enemy open → "the moment is gone." no damage either way.

### ambiguous telegraphs (deeper depths)

at deeper depths, some telegraphs are intentionally unreadable ("it moves.", "something shifts.").
the intent is still committed; the player just can't see it. they have to guess.

| depth | ambiguous chance |
|---|---|
| 1-80 | 0% |
| 81-120 | 10% |
| 121-160 | 20% |
| 161-199 | 30% |

### combat damage

base strike damage: 50 HP. modified by attack items (additive, stacking).

enemy HP scales by depth:

| band | enemy HP |
|---|---|
| 41-80 | 100 |
| 81-120 | 175 |
| 121-160 | 225 |
| 161-199 | 275 |
| 200 (queen) | 1000 |

enemy HP is shown live in the enemy region of the combat scene.

### escape (E)

- costs 30 stamina
- moves you up by 10% of your current depth, rounded up, minimum depth 1
- always succeeds. no roll.
- available before or during combat (during the timing bar, even)

example: encounter at depth 150 → E costs 30 stamina and moves you to depth 135.

## the queen (depth 200)

a per-player boss encounter. same combat system as regular enemies, larger scale.

- queen HP: 1000
- entering depth 200 triggers a cutscene (see STORY.md)
- same single-press timing combat: bouncing bar, sweet spot, S/B/E keys
- queen telegraphs are unique and harder to read than regular enemies
- wrong strike penalty is 40 stamina (same as regular enemies)
- E escape available: 30 stamina, moves to depth 180. resets queen HP.
- if your stamina hits 0 mid-fight, you die
- if you force-quit during the queen fight, your character dies (anti-cheese)
- queen HP resets on death or quit. no saving progress. all-or-nothing.
- if you kill the queen: cutscene plays, you receive the acid sac (special 6th inventory slot), the ascent becomes available
- killing the queen grants a permanent diacritic mark on your name — visible on every inscription you carve afterward

## items

three categories. all stack additively while held. all lost on death.

**attack items** — scavenged tools. increase damage per successful strike. base strike damage is 50.
- common (+10): wooden stick, bent nail, rock shard
- uncommon (+15): rusted hammer, broken crowbar
- rare (+20-25): pickaxe, saw blade, jagged shard, mandible

**defense items** — bulk/protection gear. reduce stamina damage taken on a wrong strike. base penalty is 40.
- common (-2): hard hat, leather scraps, thick gloves
- uncommon (-3): miner's vest, shoulder guard
- rare (-5): plate fragment, carapace shard

**stamina items** — passive max-stamina buffs. as long as the item is in your inventory, your max stamina is raised.
- common (+5): strip of dried meat, water pouch
- uncommon (+10): mystery bottle, pouch of pills
- rare (+15-20): MRE kit, mutant frog

constraints:
- inventory size: 5 slots
- all item effects are passive while held (no activation)
- items stack: 4 attack items = 50 + 10 + 15 + 20 + 25 = 120 damage per strike
- on death, all carried items are lost
- items show their stats in `/me` and `/look`

## item spawning

items spawn for you when you first enter a depth. each player rolls independently. the spawn pool is weighted by depth:

| depth | item pool |
|---|---|
| 1-40 | common only |
| 41-120 | common + uncommon |
| 121-160 | common + uncommon + rare |
| 161-199 | uncommon + rare + very rare |

deeper depths give better loot but cost more to reach.

## death

on death:
- a permanent inscription appears at the depth where you died ("X fell here, MM-DD")
- you respawn at depth 1 with full stamina
- deepest depth reached is preserved
- all carried items are lost

## hud

persistent status line at top of screen, always visible.

`name · depth N · stamina ████░░ X/MAX · deepest N`

bottom status bar shows current band and a single ambient detail about the current depth.

## persistence

**local** (`~/.etch/save.json` and `~/.etch/account.json`):
- account name + token
- current depth, current stamina, resting state
- inventory contents
- deepest depth reached
- queen-killed flag and diacritic
- which bands have been seen (for first-visit messages — derived from deepest_depth)

**remote** (Cloudflare D1 via api.etch.rip):
- all inscriptions (including death markers)
- account name registrations (name → token mapping)

does not survive:
- in-progress encounter or queen fight (force-quit = death)
- encounter combat state (HP, round number — all ephemeral)

## rendering

the CLI renders with [Ink](https://github.com/vadimdemedes/ink) — React for the
terminal. Three layouts share the player HUD at the top and swap the rest
based on encounter state:

- **no encounter** — HUD + scroll (story, prose, command echoes) + input bar
- **pre-combat**   — same layout, with a 15-second timer line appended at the
  bottom of the scroll (right under "press F to fight, E to escape.")
- **in-combat**    — HUD on top, then a dedicated `CombatScene` taking the
  rest of the screen: enemy panel, moment panel (telegraph + last result),
  timing panel (bouncing bar + key hints)

the bouncing bar uses Unicode block characters (`▏▎▍▌▋▊▉█`) for sub-cell
smoothness and re-renders at ~30fps. all color choices come from the
shared theme; see `docs/theme.md` for the palette and `docs/tech.md` for
the directory layout.

## tech

see `docs/tech.md` for the full reference.

short version: TypeScript + Ink for the CLI (published to npm). Cloudflare
Workers + D1 for the inscription API. Astro on Cloudflare Pages for the
landing site. No persistent server. No real-time multiplayer. Total cost: $0
at expected scale.