// All authored narrative prose for etch — one file so the whole script
// can be read top-to-bottom and edited in one place. Logic lives in the
// subsystem files; these are the strings they pick from.
//
// Tone, in case it needs reaffirming:
//   - observations, never instructions
//   - short sentences, no exclamation marks
//   - never explain the horror, only describe what's there
//   - never use "demon", "hell", "evil"
//   - the world is indifferent, not hostile
//   - lowercase voice throughout
//
// Sections, in scroll order during a typical playthrough:
//   1. Opening cutscene
//   2. Band first-visit cutscenes
//   3. Ant first encounter + return arrivals
//   4. Ant telegraphs (attack / open / ambiguous)
//   5. Queen approach + return arrivals
//   6. Queen telegraphs (attack / open / ambiguous)
//   7. Queen victory (kill → sac → climb → surface)
//   8. Combat outcome messages (sweet-spot matrix)

import type { Emit } from "./types.ts"

// ---- Line constructors --------------------------------------------------

const story   = (text: string): Emit => ({ style: "story",   text })
const dialog  = (text: string): Emit => ({ style: "dialog",  text: `"${text}"` })
const thought = (text: string): Emit => ({ style: "thought", text })
const sys     = (text: string): Emit => ({ style: "system",  text })
const pause:   Emit = { style: "pause", text: "..." }

// ---- 1a. Landing prose (pre-register) -----------------------------------
// Plays on the title screen, one line every CUTSCENE_LINE_MS. The
// name-yourself prompt is hidden until this drip finishes — registering
// is the act of waking up, narratively, so the player can't skip the
// fall. After they submit, the OPENING_CUTSCENE below picks up at "you
// wake" and runs through meeting Horris.

export const LANDING_PROSE: Emit[] = [
  story("the surface is dying."),
  pause,
  story("the heat killed your camp three days ago."),
  story("the others didn't make it."),
  pause,
  story("you walked."),
  pause,
  story("three days. no water. no shade. no one."),
  story("just cracked earth and yellow sky, thick with dust."),
  pause,
  story("on the third day you saw it."),
  story("a deep hole in the ground."),
  pause,
  story("you went toward it because there was nothing else."),
  pause,
  story("the edge crumbled under your weight."),
  story("you fell for a long time."),
  pause,
  story("dust. impact. nothing."),
]

// ---- 1b. Opening cutscene (post-register) -------------------------------
// Picks up after the player names themselves. They wake at the bottom
// of the shaft to find Horris.

export const OPENING_CUTSCENE: Emit[] = [
  story("you wake. someone is sitting near you, in the shade."),
  pause,
  dialog("you came down too."),
  story("he sounds almost pleased."),
  pause,
  story("he's been here a while. you can tell by the dust settled around him."),
  pause,
  story("you look around. it's an abandoned mineshaft."),
  story("you look up. the ceiling and walls are smooth stone it must be 30 feet high."),
  story("even with rope the climb seems impossible."),
  pause,
  dialog("that's quite a fall you took."),
  pause,
  dialog("the good news is it's not far between levels down here."),
  dialog("you can use the old beams to climb if you need to."),
  story("he points down the shaft. it goes farther than the light reaches."),
  pause,
  story("he grins. it doesn't reach his eyes."),
  pause,
  story("he pulls something from a bag beside him. tosses it to you."),
  story("an old miner's headlamp."),
  dialog("it gets dark down there."),
  pause,
  dialog("i've watched a lot of people go down."),
  dialog("not many come back."),
  pause,
  story("he settles back against the wall."),
  story("he looks comfortable. he looks like he could sit here forever."),
  pause,
  dialog("me. i'm happy here. i like the quiet."),
  pause,
  story("something in him is wrong but you can't say what."),
  pause,
  dialog("go on, then. or stay. some of us stay."),
  sys("type /help for commands. /quit to save and leave."),
]

// ---- 2. Band first-visit cutscenes --------------------------------------
// Plays once when deepest_depth first crosses into a band. The dust has
// none (the opening cutscene serves that purpose). The queen has none
// (her approach cutscene serves that purpose).

export const BAND_STONE_FIRST_VISIT: Emit[] = [
  story("the space narrows. the walls are smoother now."),
  story("the dust from above doesn't reach this deep."),
  sys("/read to see inscriptions here. /mark <text> to leave your own."),
]

export const BAND_WRITING_FIRST_VISIT: Emit[] = [
  story("inscriptions begin to appear on the walls."),
  story("not english."),
  pause,
]

export const BAND_DAMP_FIRST_VISIT: Emit[] = [
  story("your breath fogs. the rock is wet to the touch."),
  story("water trickles from somewhere out of sight."),
]

export const BAND_QUIET_FIRST_VISIT: Emit[] = [
  story("it is quiet."),
  story("weirdly quiet."),
]

// ---- 3. Ant -------------------------------------------------------------
// First encounter plays once. Subsequent arrivals pick one line.

export const ANT_FIRST_ENCOUNTER: Emit[] = [
  story("something moves in the dark below you."),
  pause,
  story("you hear it before you see it."),
  story("legs. too many legs. clicking against stone."),
  pause,
  story("it pulls itself up onto the beam in front of you."),
  pause,
  story("it's the size of a man."),
  pause,
  story("its head is wrong. smooth and ridged like cracked bone."),
  story("two black eyes catch your headlamp and don't reflect it back."),
  story("they just swallow the light."),
  pause,
  story("its mandibles open sideways."),
  story("they're serrated. wet. there's something dark caught between them."),
  pause,
  story("it smells like copper and rot."),
  pause,
  story("it doesn't charge. it just watches you."),
  story("its antennae twitch once. twice."),
  pause,
  story("it knows you're here."),
]

export const ANT_ARRIVALS: string[] = [
  "clicking, close. it pulls itself onto the beam.",
  "legs scrape the stone. it rises into the light.",
  "the dark shifts. mandibles, then eyes that don't reflect.",
]

// ---- 4. Ant telegraphs --------------------------------------------------
// The player reads these to predict the ant's intent. Ambiguous lines
// are drawn when the read is suppressed (deeper depths, see world.ts).

export const ANT_ATTACK_TELEGRAPHS: string[] = [
  "its mandibles open wide.",
  "the legs coil under it.",
  "it lunges at the shoulder.",
  "its head dips. weight shifts back.",
  "it raises a leg, jagged at the joint.",
]

export const ANT_OPEN_TELEGRAPHS: string[] = [
  "it pauses. the throat is exposed.",
  "the head turns. you see the soft underside.",
  "a leg slips. it is off balance.",
  "it stops moving. one eye twitches.",
  "its mandibles close. it stands still.",
]

export const ANT_AMBIGUOUS_TELEGRAPHS: string[] = [
  "your headlamp flickers. shapes fold into the dark.",
  "it slips out of the light. you only hear it breathing.",
  "the dark thickens between you. you cannot read it.",
  "it moves behind you. you can only listen.",
  "your light catches nothing. only the clicking.",
]

// Between-rounds atmosphere. Dimmer than the telegraph — sense, not signal.
export const ANT_AMBIENT: string[] = [
  "chitin scrapes on stone.",
  "the air smells of wet dirt and acid.",
  "somewhere below, more of them are clicking.",
  "your breath fogs in the lamp beam.",
  "a leg drags. then steadies.",
  "dust falls from the beams above.",
  "the sound of it is wrong. too many joints.",
]

// ---- 5. Queen approach + returns ----------------------------------------
// Approach plays once (seenQueenApproach). Returns are the short lines
// for subsequent visits after escape.

export const QUEEN_APPROACH: Emit[] = [
  story("the shaft opens."),
  pause,
  story("there is a room below you. not a tunnel."),
  pause,
  story("a strange light pulses across the chamber."),
  story("something biological. something alive in the walls."),
  pause,
  story("you step down."),
  pause,
  story("the floor is wet. it is not water."),
  pause,
  story("bones."),
  story("scattered across the stone. picked clean. human."),
  story("skulls. ribcages. jawbones cracked open and hollowed out."),
  story("drag marks lead inward from every tunnel."),
  pause,
  thought("this is where they bring them."),
  pause,
  story("a sound. mandibles. opening and closing in the dark."),
  story("the sound of bone on bone."),
  pause,
  story("she is at the center of the room."),
  pause,
  story("she is massive. twice your size."),
  story("her abdomen drags behind her, swollen with eggs"),
  story("that pulse beneath a membrane slick with fluid."),
  pause,
  story("her exoskeleton is black and cracked. gore clings to the ridges."),
  pause,
  story("her head turns toward you."),
  story("hundreds of black lenses. every one finds you at once."),
  pause,
  story("she pulls herself toward you."),
  story("slow. deliberate. dragging that weight behind her."),
]

export const QUEEN_RETURNS: string[] = [
  "she is still here. the trail is still wet.",
  "the chamber pulses again. she has not moved.",
  "the bones are where you left them.",
]

// ---- 6. Queen telegraphs ------------------------------------------------
// Queen-flavored prose pools. Same shape as ant pools; the engine picks
// based on enemy kind + ambiguous roll.

export const QUEEN_ATTACK_TELEGRAPHS: string[] = [
  "her mandibles open. forearm-long.",
  "she drags forward. the trail widens.",
  "her abdomen contracts. something coils to release.",
  "a leg the size of a beam lifts.",
  "her head pivots. hundreds of eyes lock on you.",
]

export const QUEEN_OPEN_TELEGRAPHS: string[] = [
  "she stops. the eggs pulse beneath the membrane.",
  "her head turns away. the soft underside shows.",
  "she shifts her weight. a joint slips.",
  "her mandibles part. they stay parted. exposed.",
  "she lowers. the swollen abdomen sags wide.",
]

export const QUEEN_AMBIGUOUS_TELEGRAPHS: string[] = [
  "every eye finds you. you cannot tell what they see.",
  "she clicks. once. twice. the rhythm hides her intent.",
  "the dark pools around her. the trail hisses.",
  "she settles. you cannot read the weight of her.",
  "her shape distorts in your light. the angles are wrong.",
]

export const QUEEN_AMBIENT: string[] = [
  "the chamber breathes around her.",
  "the sac shifts. something inside is awake.",
  "her eyes do not blink in unison.",
  "the eggs pulse. slow. patient.",
  "the trail beneath her hisses where it meets the stone.",
  "the air is heavier here. wet. iron.",
]

// ---- 7. Queen victory ---------------------------------------------------
// Plays once when the queen drops. Covers everything from the kill
// through the sac, the climb, finding Horris gone, the surface.

export const QUEEN_VICTORY: Emit[] = [
  story("the clicking falters."),
  story("her body slumps. something deep below shifts and goes still."),
  pause,
  story("beneath her, a sac. swollen. leaking."),
  story("wherever the fluid touches, the rock blackens and gives."),
  pause,
  story("you pry it free. you keep it close."),
  pause,
  story("the sound starts before you see it."),
  story("clicking. everywhere. frantic."),
  pause,
  story("the ants are dying."),
  story("they curl inward on themselves, legs twitching."),
  story("the shaft fills with a sound like screaming."),
  pause,
  story("you begin climbing past them."),
  story("level after level. the beams creak under your hands."),
  pause,
  story("you reach depth 1."),
  pause,
  story("the dust is undisturbed. the wall where he sat is bare."),
  story("no prints. no lamp. no sign anyone was ever here."),
  pause,
  story("you look up."),
  story("forty feet of smooth stone. the lip curls inward above you."),
  pause,
  story("you crack the sac against the wall."),
  story("it hisses. the rock blackens. gives."),
  pause,
  story("you climb. handhold by handhold."),
  pause,
  story("the surface."),
  pause,
  story("the heat hits you and you remember why you went down."),
  pause,
  story("but you are out."),
  sys("you stand on the surface. /mark or /quit."),
]

// ---- 8. Combat outcome messages ----------------------------------------
// One message per leaf of the sweet-spot × key × intent matrix. The
// engine in combat.ts picks the right one; this is just the prose.

export const COMBAT_MESSAGES = {
  cleanStrike:     "clean strike.",
  swungIntoAttack: "you swung into it. the blow connects.",
  braceAttack:     "you brace. it glances off you.",
  braceOpen:       "you braced nothing.",
  mistimedAttack:  "you mistimed it. the blow lands.",
  mistimedOpen:    "the moment is gone.",
} as const
