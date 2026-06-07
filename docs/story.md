# etch — story and prose reference

Narrative outline and tone guide. The **canonical text** of every line the
player sees lives in `cli/src/game/prose.ts` — when prose changes, change
it there. This doc is for the shape of the narrative, the NPC's voice,
and the rules the prose follows.

`prose.ts` is organized in the same order as this doc, with section
headers matching the labels below. Constant names in code are noted in
parentheses.

---

## 1. landing prose (pre-register)

`LANDING_PROSE`

Plays on the title screen *before* the player picks a name. Drips one
line every 2 seconds. The name prompt mounts as the final line in the
same drip — the player can't skip the prose by typing fast.

Beats:

- the surface is dying.
- the heat killed your camp three days ago. the others didn't make it.
- you walked. three days. no water. no shade. no one.
- you stopped sweating on the second day.
- on the third day you saw a hole in the ground. dark and still.
- the edge crumbled under your weight. you fell for a long time.
- dust. impact. nothing.
- *(then: "name yourself.")*

## 2. opening cutscene (post-register)

`OPENING_CUTSCENE`

Plays once, immediately after the player submits their name. Picks up
at "you wake."

Beats:

- you wake. someone is sitting near you, in the shade.
- *"you came down too."* — he sounds almost pleased.
- *"they all come down eventually."*
- he's been here a while. you can tell by the dust settled around him.
- you look around. abandoned mineshaft. you look up. the lip curls inward
  like a jaw. even with rope the climb seems impossible. almost like it
  was designed that way.
- *"that's quite a fall you took. the good news is it's not far between
  levels down here. you can use the old beams to climb if you need to.
  the only way out is down."*
- he pulls out an old miner's headlamp and tosses it to you.
- *"it gets dark down there. i've watched a lot of people go down. not
  many come back."*
- *"me. i'm happy here. i like the quiet."*
- something in him is wrong but you can't say what.
- *"go on, then. or stay. some of us stay."*
- the player commits: *"i am not dying here. the only way is down."*
- system: `type /help for commands.`

After this, gameplay begins at depth 1.

## 3. the NPC — Horris

Permanent at depth 1. Doesn't move. Doesn't fight. Not targetable by
`/look`. Speaks on triggers:

- **return** — re-entering depth 1 after going deeper (`HORRIS_RETURN`)
- **respawn** — waking at depth 1 after a death (`HORRIS_RESPAWN`)
- **idle** — extended inactivity at depth 1 (`HORRIS_IDLE`)

Voice rules:

- content in a place no one should be content in
- short, observational, slightly off
- never warns the player, never advises
- past-tense references to "the others"
- examples: "still here, are you.", "the lamp helps, doesn't it.",
  "i felt the wall move when you fell."

Disappears narratively during the queen-victory cutscene — when the
player climbs back through depth 1, his spot is bare. No prints, no
lamp, no sign anyone was ever there.

## 4. band first-visit cutscenes

Plays once the first time `deepest_depth` crosses into the band.

| band | constant | tone |
|---|---|---|
| the dust    | (none) | opening cutscene serves this purpose |
| the stone   | `BAND_STONE_FIRST_VISIT`   | smoother walls, polished a long time ago |
| the writing | `BAND_WRITING_FIRST_VISIT` | inscriptions appear. "the wall remembers everyone." |
| the damp    | `BAND_DAMP_FIRST_VISIT`    | wet rock, fog breath, freezing |
| the quiet   | `BAND_QUIET_FIRST_VISIT`   | sound dies. words don't echo. |
| the queen   | `QUEEN_APPROACH` | her own approach cutscene (see §7) |

## 5. ambient lines

Fire roughly every 90 seconds while exploring (not in a cutscene, not
in an encounter, not in queen's chamber).

| band | constant |
|---|---|
| the dust    | `AMBIENT_DUST`    |
| the stone   | `AMBIENT_STONE`   |
| the writing | `AMBIENT_WRITING` |
| the damp    | `AMBIENT_DAMP`    |
| the quiet   | `AMBIENT_QUIET`   |

Lines are one-shot observations of the place: dust drifts, walls smell of
old iron, water finds the cracks before you do, the silence is full.

## 6. the ant (regular enemy)

`ANT_FIRST_ENCOUNTER` plays once, the first time a player triggers an
ant encounter. After that, arrivals draw a short line from
`ANT_ARRIVALS`.

In-combat the enemy commits an intent (`attack` or `open`) and the
telegraph string is drawn from one of three pools:

- `ANT_ATTACK_TELEGRAPHS` — read this and press **S**
- `ANT_OPEN_TELEGRAPHS` — read this and press **B**
- `ANT_AMBIGUOUS_TELEGRAPHS` — read suppressed at deeper depths
  (10/20/30% at the writing/damp/quiet bands respectively); intent is
  still committed, the player just can't see it

## 7. the queen (depth 200)

First arrival at depth 200 triggers `QUEEN_APPROACH` once. Subsequent
arrivals after an escape draw a short line from `QUEEN_RETURNS`.

Queen telegraphs follow the same shape as ant telegraphs but with their
own pools (`QUEEN_ATTACK_TELEGRAPHS`, `QUEEN_OPEN_TELEGRAPHS`,
`QUEEN_AMBIGUOUS_TELEGRAPHS`). She is twice the player's size, her
abdomen pulses with eggs, her trail hisses where it meets the stone.

## 8. queen victory

`QUEEN_VICTORY` plays once when the queen drops. A single continuous
cutscene covers everything from her fall through the surface emergence:

- her body slumps, something deep below shifts and goes still
- a sac beneath her, swollen and leaking acid that blackens the rock
- you pry it free and keep it close
- the ants are dying everywhere — the shaft fills with a sound like screaming
- you climb past them, level after level
- you reach depth 1. the dust is undisturbed. the wall where Horris sat
  is bare. no prints. no lamp. no sign anyone was ever here.
- forty feet of smooth stone above. the lip curls inward.
- you crack the sac against the wall. it hisses. the rock blackens. gives.
- you climb. handhold by handhold.
- the surface. the heat hits you and you remember why you went down.
- but you are out.
- system: `you stand on the surface. /mark or /quit.`

The player ends at depth 0 with `queenKilled = true`.

## 9. death markers

When a player dies, a permanent inscription is carved at the depth where
they died:

```
{name} fell here. {YYYY-MM-DD}.
```

Every future player who passes that depth and types `/read` sees it
among the inscriptions there.

## 10. combat outcome messages

`COMBAT_MESSAGES` — short lines for each leaf of the
(sweet-spot × key × intent) matrix:

| outcome | line |
|---|---|
| clean strike (sweet spot, S, attack) | `clean strike.` |
| swung-into-attack (sweet spot, S, open — wait, see below) | `you swung into it. the blow connects.` |
| brace-attack (sweet spot, B, attack) | `you brace. it glances off you.` |
| brace-open (sweet spot, B, open) | `you braced nothing.` |
| mistimed attack (outside sweet spot, enemy attacking) | `you mistimed it. the blow lands.` |
| mistimed open (outside sweet spot, enemy open) | `the moment is gone.` |

Engine picks the right one in `combat.ts`; the prose file is just the strings.

---

## error messages with voice

Errors and refusals should match the game's tone. Keep them short. Single
lowercase observation, no exclamation.

| situation | line |
|---|---|
| empty `/mark` | `carve what?` |
| `/mark` too long | `too much to carve. 240 characters max.` |
| `/down` out of stamina | `you don't have the strength.` |
| `/up` out of stamina | `you don't have the strength to climb.` |
| `/up` at depth 1 | `the lip overhangs. no climbing back.` |
| moving while resting | `you have to wake up first.` |
| acting during move cooldown | `you need to catch your breath.` |
| unknown command | `unknown command: {input}` |

## tone guidelines

- the game speaks in **observations**, never instructions
- short sentences. no exclamation points.
- never explain the horror. only describe what's there.
- never use the words "demon", "hell", "evil"
- never use "you must" or "you should"
- the world is indifferent, not hostile. the wrongness is ambient, not aggressive.
- **lowercase throughout**, with occasional capitalized words only for rare emphasis

When in doubt, defer to the existing voice in `prose.ts`. The Horris
lines, the first-encounter ant cutscene, and the queen approach are the
strongest tone references in the file.
