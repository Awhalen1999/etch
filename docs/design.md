# etch — game design reference

## what it is

a multiplayer text horror mud. the surface is dead from heat. you fell into a mineshaft and can't climb out. the only way is down. ants live below. the queen waits at depth 200.

dual transport: telnet (tcp:4000) and browser (http:8080, xterm.js over websocket). same world, identical experience, single rust server.

## architecture

etch is a single-player adventure with two shared layers:

| layer | shared? |
|---|---|
| chat (plain text, shouts, whispers) | yes |
| inscriptions on walls | yes |
| death-marker inscriptions | yes |
| encounters (ants, queen) | no — per-player |
| items (spawns, inventory) | no — per-player |
| queen state | no — resets every encounter, per-player |

chat and inscriptions are the only multiplayer surfaces. everything else is your own private world.

## world

the shaft is one dimension: depth, an integer 1 to 200.
- depth 0: the surface (conceptual only — unreachable, you fell from here)
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
- the heat killed your camp
- you fell into a shaft
- you wake at depth 1
- the NPC explains there's no way up — the lip overhangs
- the NPC gives you a headlamp
- you commit internally: "i am not dying here"
- gameplay begins at depth 1

returning players skip the intro. they resume wherever they last logged out.

the NPC is permanent at depth 1. doesn't move. is not lookable via `/look` — `/look` is for other players only. the NPC speaks on certain triggers: re-entering depth 1 after going deeper, respawning after death, etc. see STORY.md for trigger pool.

## core loop

1. connect → log in → resume position (or new-account intro)
2. descend, paying stamina
3. rest, read inscriptions, talk, carve — rest attracts ants below depth 40
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

- plain text → broadcast to all players at the same depth only. no range.
- `/shout <text>` → reaches players within ±20 depths. corrupted by distance.
- `/whisper <name> <text>` → directed, uncorrupted.
- `/mark <text>` → carve persistent inscription at current depth. never corrupted.
- `/read` → list every inscription at current depth.

corruption only applies to speech and shouts. inscriptions are forever and always clean.

## commands

| command | does |
|---|---|
| (plain text) | speak to current depth only |
| `/down` | descend one level |
| `/up` | ascend one level |
| `/rest` | sit and recover stamina |
| `/fight` | attack a present ant or the queen |
| `/escape` | flee an encounter (moves you up ~10% of current depth) |
| `/shout <text>` | broadcast within ±20 depths |
| `/whisper <name> <text>` | directed cross-depth message |
| `/mark <text>` | carve inscription at current depth |
| `/read` | read inscriptions at current depth |
| `/me` | character sheet |
| `/look <name>` | view another player and their inventory |
| `/who` | list online players + depths |
| `/depths` | leaderboards (surface only) |
| `/take <item>` | pick up loot at current depth |
| `/drop <item>` | leave item (removed from inventory, no one else sees it) |
| `/help` | command reference |
| `/quit` | disconnect (saves state) |

## encounters

below depth 40, ants can find you while resting. encounter rolls happen every 5 seconds while resting:

| depth | chance per roll |
|---|---|
| 1-40 | 0% (never) |
| 41-80 | 5% |
| 81-120 | 10% |
| 121-160 | 15% |
| 161-199 | 20% |

when an ant arrives:
- normal `/up` and `/down` are disabled
- you can `/fight` or `/escape`
- if you do nothing for ~15 seconds, the ant takes you. you die.

### /fight (vs an ant)

- costs 30 stamina (one-shot resolution)
- you swing. dice roll modified by combat items.
- success → the ant is dead. its skull lies at your feet. `/take skull` to keep it.
- failure → the ant takes you. you die.

base success rate: 70%. combat items raise it further.

### /escape

- costs 30 stamina
- moves you up by 10% of your current depth, rounded up
- 90% base success rate. escape items raise it further.
- failure → the ant catches you. you die.

example: encounter at depth 150 → /escape costs 30 stamina and moves you to depth 135. you lose 15 levels and a chunk of stamina, but you live.

escape is the safer choice (higher base success, depth-loss cost). fight is the gamble that lets you keep your ground.

## the queen (depth 200)

a per-player boss encounter. fully client-side state.

- the queen spawns at full HP every time you enter depth 200
- entering depth 200 triggers a cutscene (see STORY.md)
- incoming chat is muted during the queen encounter
- the encounter is turn-based: each `/fight` is one round
- `/fight` against the queen does NOT cost stamina per round
- each round: you attack (damage modified by combat items), then the queen attacks back
- the queen's attack has a 30% base hit rate; escape items reduce this
- when the queen hits you, she drains 10 stamina (toxin attack)
- if your stamina hits 0 mid-fight, you die
- `/escape` follows the standard escape rules: 30 stamina, 90% base success, moves you up 10% of current depth (so from 200 → 180). escaping resets the queen's HP.
- if you log out during the queen fight, your character dies (anti-cheese)
- if you kill the queen, your name gains a permanent diacritic mark visible everywhere

## items

three categories:

**escape items** — gritty survival gear. boost escape rolls. reduce queen's hit rate during boss fight.
examples: frayed rope, miner's boots, leather harness, climbing chalk, torn gloves.

**combat items** — scavenged tools. boost fight rolls (vs ants) and damage per round (vs queen).
examples: broken pickaxe, rusted saw, ball-peen hammer, bent crowbar, jagged shard.

**stamina items** — passive max-stamina buffs. as long as the item is in your inventory, your max stamina is raised.
examples: mystery bottle (+10), mutant frog (+20), MRE kit (+15), pouch of pills (+10), strip of dried meat (+5).

constraints:
- inventory size: 5 slots
- combat and escape items modify rolls passively while held
- stamina items boost max passively while held
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

## the depths (leaderboards)

surface-only command: `/depths`. shows:
- currently connected players and their depths
- top 5 deepest reaches all-time
- optional param: `/depths queens` lists every player who has killed the queen

## hud

persistent status line at top of screen, always visible.

`name · depth N · stamina ████░░ X/MAX · deepest N · N below`

bottom status bar shows current band and a single ambient detail about the current depth.

## persistence

per-player state in db:
- account (name, password hash)
- current depth, current stamina
- inventory contents
- deepest depth reached
- queen-killed flag and diacritic

(first-visit band tracking is derived from deepest_depth, not stored separately.)

server-wide state in db:
- all inscriptions (including death markers)

does not survive:
- chat history
- in-progress queen encounter (logout = death)
- in-progress ant encounter (logout = death)

## rendering

every outgoing message goes through `render_for(session, message) -> bytes`. per-recipient effects (corruption, color, hud, chat-muted during encounters) all live here.

## tech

rust 2021. tokio. axum. sqlx + sqlite. argon2. xterm.js. single binary, two ports. deploy: fly.io (yyz), persistent volume.