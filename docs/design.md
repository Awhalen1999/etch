# etch — game design reference

## what it is

a multiplayer text horror mud. the surface is dead from heat. you fell into a mineshaft and can't climb out. the only way is down. enemies live below. the queen waits at depth 200.

dual transport: telnet (tcp:4000) and browser (http:8080, xterm.js over websocket). same world, identical experience, single rust server.

## architecture

etch is a single-player adventure with two shared layers:

| layer | shared? |
|---|---|
| chat (plain text, shouts, whispers) | yes |
| inscriptions on walls | yes |
| death-marker inscriptions | yes |
| encounters (enemies, queen) | no — per-player |
| items (spawns, inventory) | no — per-player |
| queen state | no — resets on death/logout, per-player |

chat and inscriptions are the only multiplayer surfaces. everything else is your own private world.

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
| `/fight` | enter combat with a present enemy |
| `/strike` | attack during combat (5 stamina) |
| `/brace` | defend during combat (5 stamina) |
| `/escape` | flee an encounter (30 stamina, moves you up ~10% of current depth) |
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

below depth 40, enemies can find you while resting. encounter rolls happen every 5 seconds while resting:

| depth | chance per roll |
|---|---|
| 1-40 | 0% (never) |
| 41-80 | 5% |
| 81-120 | 10% |
| 121-160 | 15% |
| 161-199 | 20% |

when an enemy arrives:
- normal `/up` and `/down` are disabled
- you can `/fight` (enter combat) or `/escape` (flee)
- if you do nothing for ~15 seconds, the enemy takes you. you die.

all encounters are ephemeral — no state is stored in the database. fights are per-player and independent.

### /fight (entering combat)

no stamina cost to enter. combat is turn-based and round-by-round.

each round:
1. a text telegraph describes what the enemy is doing
2. player chooses `/strike` (5 stamina) or `/brace` (5 stamina)
3. the enemy is either attacking (50% chance) or open (50% chance)
4. outcome depends on the match:

| | enemy attacks | enemy open |
|---|---|---|
| `/strike` | you take 40 stamina damage, deal 0 | you deal damage, cost 5 stamina |
| `/brace` | you block, cost 5 stamina, deal 0 | you waste 5 stamina, deal 0 |

wrong strike is punishing (40 stamina). wrong brace is mild (5 stamina wasted). this rewards aggressive play with good reads.

the telegraph hints at whether the enemy is attacking or open. at shallow depths, telegraphs are obvious. at deeper depths, telegraphs become subtler — and occasionally unreadable ("you can't tell what it's doing"), forcing a guess.

### combat damage

base strike damage: 50 HP. modified by attack items (additive, stacking).

enemy HP scales by depth:

| band | enemy HP |
|---|---|
| 41-80 | ~100 |
| 81-120 | ~150-200 |
| 121-160 | ~200-250 |
| 161-199 | ~250-300 |

enemy health is displayed to the player during combat.

### /escape

- costs 30 stamina
- moves you up by 10% of your current depth, rounded up, minimum depth 1
- always succeeds. no roll.
- available before or during combat

example: encounter at depth 150 → /escape costs 30 stamina and moves you to depth 135.

## the queen (depth 200)

a per-player boss encounter. same combat system as regular enemies, larger scale.

- queen HP: 1000+
- entering depth 200 triggers a cutscene (see STORY.md)
- incoming chat is muted during the queen encounter
- same turn-based combat: telegraph → `/strike` or `/brace` each round
- queen telegraphs are unique and harder to read than regular enemies
- wrong strike penalty is 40 stamina (same as regular enemies)
- `/escape` available: 30 stamina, moves to depth 180. resets queen HP.
- if your stamina hits 0 mid-fight, you die
- if you log out during the queen fight, your character dies (anti-cheese)
- queen HP resets on death or logout. no saving progress. all-or-nothing.
- if you kill the queen: cutscene plays, you receive the acid sac (special 6th inventory slot), `/ascent` becomes available
- killing the queen grants a permanent diacritic mark on your name visible everywhere

## items

three categories. all stack additively while held. all lost on death.

**attack items** — scavenged tools. increase damage per successful strike. base strike damage is 50.
- common (+10): wooden stick, bent nail, rock shard
- uncommon (+15): rusted hammer, broken crowbar
- rare (+20-25): pickaxe, saw blade, jagged shard

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
- in-progress enemy encounter (logout = death)
- encounter combat state (HP, round number — all ephemeral)

## rendering

every outgoing message goes through `render_for(session, message) -> bytes`. per-recipient effects (corruption, color, hud, chat-muted during encounters) all live here.

## tech

rust 2021. tokio. axum. sqlx + sqlite. argon2. xterm.js. single binary, two ports. deploy: fly.io (yyz), persistent volume.