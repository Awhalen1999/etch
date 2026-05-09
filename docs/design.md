# etch — game design reference

## what it is

a multiplayer text horror mud. players climb up and down a single vertical shaft. dual transport: telnet (tcp:4000) and browser (http:8080, xterm.js over websocket). same world, identical experience, single rust server.

## world model

the shaft is one dimension: depth, an integer ≥ 0.
- depth 0 = surface (spawn)
- depth 1000 = the bottom (authored ending)
- depths beyond 1000 do not exist

players exist at exactly one integer depth at a time. multiple players can share a depth.

the shaft is divided into bands. bands are zones with shared atmosphere and per-depth flavor.

## core loop

1. player connects → logs in → resumes wherever they last logged out
2. player descends, paying stamina
3. player rests, reads inscriptions, talks, marks walls - knowing rest at depth is risky
4. player ascends back up, paying more stamina, with multiple rest stops
5. player disconnects → state persists exactly: same depth, same stamina, same psychosis

logging out does not heal anything. it pauses your character in place. (if logged out during death scene or chase just death anyways)

## stamina

- pool: 100, fixed
- `/down` costs 2 stamina, takes 3–8s wallclock (scales with depth)
- `/up` costs 4 stamina, takes 5–12s wallclock
- `/rest` recovers 1 stamina per 4s while resting
- input locked during a climb or descent

asymmetric cost is the central economic constraint. descending is cheap; ascending is real work. running out of stamina deep means you are stuck.

## enemies and death

below depth 100, something can find you while you rest. spawn rate increases with depth:

| depth | encounter chance per rest |
|---|---|
| 0–100 | never |
| 100–300 | very rare |
| 300–500 | rare |
| 500–700 | uncommon |
| 700+ | more but still uncommon |

frequency does not climb fast. what climbs is the *consequence* — at deep depths you may not have the stamina to escape.

when an encounter starts:
- normal `/up` and `/down` are disabled
- `/escape up` costs 20 stamina, takes you up one level fast
- `/escape down` costs 10 stamina, takes you down one level fast
- the player has ~10–15 seconds to act

if the player's stamina is too low to escape: they die.

on death:
- player respawns at the rim with full stamina
- a permanent inscription appears at the depth of death, marking that someone died there
- deepest depth reached is preserved
- nothing else carries forward from this character's run

the helpless feeling — knowing you're too broke to flee — is the horror. preserve stamina or perish.

## communication

- plain text (no slash) → broadcast to all players at same depth (± 5), clean
- `/shout <text>` → reaches players within ±150 depths, corrupted by absolute depth distance from listener
- `/whisper <name> <text>` → directed message, non distance-corrupted
- `/mark <text>` → carve persistent inscription at current depth, never corrupted
- `/read` → list all inscriptions at current depth (author + timestamp)

distance corruption applies to spoken/shouted messages only. wall inscriptions are always clean.

## commands

| command | does |
|---|---|
| (plain text) | speak to current depth |
| `/down` | descend one level |
| `/up` | ascend one level |
| `/rest` | sit and recover stamina (risky below 100) |
| `/escape up` | flee an encounter, 20 stamina |
| `/escape down` | flee an encounter, 10 stamina, deeper |
| `/shout <text>` | broadcast across depth range |
| `/whisper <name> <text>` | directed cross-depth message |
| `/mark <text>` | inscribe wall at current depth |
| `/read` | read inscriptions here |
| `/me` | full-screen character sheet |
| `/look <name>` | view another player's character |
| `/who` | list online players + depths |
| `/depths` | leaderboards (surface only) |
| `/take <item>` | pick up loot at current depth |
| `/drop <item>` | leave item here |
| `/help` | command reference |
| `/quit` | disconnect (saves your exact state) |

## hud

persistent status line at top of screen, always visible. no toggle.

`name · depth N · stamina ████░░ X/100 · deepest N · N below`

at high psychosis levels, the hud itself begins to misbehave:
- depth number occasionally flickers to a wrong value
- stamina bar may briefly show 100 when it isn't
- player name may briefly read as someone else's
- hud may show climbers `below` who aren't actually online

these effects only appear in moderate-to-severe psychosis states. clear at the rim.

updates live on state change.

## persistence

what survives between sessions:
- account (name, password hash)
- current depth — your exact location
- current stamina — what you had on quit
- inscriptions written
- items collected
- deepest depth reached
- psychosis state
- bottom-reached flag and altered name diacritic

what does NOT survive:
- chat history

logging out parks you. the world doesn't move while you're gone. you start again exactly where you stopped.

## loot

items spawn at depths when a player enters that level, weighted by depth — rare and weirder loot appears deeper.

constraints:
- player inventory is small (5 slots). cannot hoard.
- loot has no mechanical effect. it is purely flex / decoration / `/me` glyphs.
- carrying rare loot up from the deep is a real achievement because of the climb cost.
- on death, all carried loot is lost. it does not drop at the death site (the inscription marks the death; the items are simply gone).

players see a brief notice when entering a depth that has loot waiting. they can choose to `/take` or pass.

## the depths (leaderboards)

surface-only command: `/depths`. four leaderboards in a single full-screen view:

this is simply a current list of all the players depths (current and all time perhaps depths takes a param? )

## psychosis

triggered by cumulative session time spent below depth thresholds:
- 30+ min below 300: light text flicker on read messages
- 20+ min below 500: false ambient lines, slightly-wrong substitutions
- 15+ min below 700: phantom names in /who, false attributed shouts, hud begins to glitch
- sustained below 800: severe — phantom presences, hud lies, the world misbehaves

ambient effects include whispers from fake players, ticks and clicks (the same sounds an approaching enemy makes — players cannot tell which is which).

resting partially mitigates accumulation. only ascending clears it meaningfully. psychosis state persists across sessions if you log out deep.

no ui for psychosis state — players experience it.

## the bottom

triggered the first time a player's depth reaches 1000.

- input locks
- hud vanishes for the duration
- screen displays the wall of those who came before — every player who has reached the bottom, with the inscription each one chose to leave
- the player is given a single inscription to add to the wall, permanent
- the player's name gains a diacritic mark visible in /who, /me, /depths, all future inscriptions
- player can `/up` afterward to begin the climb back

reaching the bottom is permanent and rare. the diacritic on the name is the visible permanent marker.

## rendering

every outgoing message goes through a single render function: `render_for(session, message) -> bytes`.
- input: typed `Message` enum + recipient `Session`
- output: rendered bytes (ansi-formatted text)
- per-recipient effects (corruption by distance, color, hud, psychosis effects, hud glitches) all live here

game logic constructs typed messages, never raw strings.

## tech

- rust 2021, tokio async runtime
- axum for http + websocket
- sqlx + sqlite for persistence (single file)
- argon2 for password hashing
- xterm.js as the browser client (~50 lines of html/js)
- single binary, two ports
- deploy: fly.io (yyz region), persistent volume for sqlite