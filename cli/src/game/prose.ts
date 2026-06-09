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
//   2. Horris (depth-1 NPC: return / respawn / idle)
//   3. Band first-visit cutscenes
//   4. Ambient lines (per band)
//   5. Ant first encounter + return arrivals
//   6. Ant telegraphs (attack / open / ambiguous)
//   7. Queen approach + return arrivals
//   8. Queen telegraphs (attack / open / ambiguous)
//   9. Queen victory (kill → sac → climb → surface)
//  10. Combat outcome messages (sweet-spot matrix)

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
  story("you stopped sweating on the second day."),
  story("you kept walking because stopping meant lying down."),
  story("and lying down meant not getting up."),
  pause,
  story("on the third day you saw it."),
  story("a hole in the ground. dark and still."),
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
  dialog("they all come down eventually."),
  pause,
  story("he's been here a while. you can tell by the dust settled around him."),
  pause,
  story("you look around. it's an abandoned mineshaft."),
  story("you look up. the ceiling and walls are smooth stone."),
  story("the lip curls inward like a jaw."),
  story("even with rope the climb seems impossible."),
  pause,
  story("almost like it was designed that way."),
  pause,
  dialog("that's quite a fall you took."),
  pause,
  dialog("the good news is it's not far between levels down here."),
  dialog("you can use the old beams to climb if you need to."),
  pause,
  dialog("the only way out is down."),
  story("he points down the shaft. it goes farther than the light reaches."),
  pause,
  story("he grins. it doesn't reach his eyes."),
  pause,
  story("he pulls something from a bag beside him. tosses it to you."),
  story("an old miner's headlamp."),
  pause,
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
  pause,
  story("you think one thing, clearly:"),
  pause,
  thought("i am not dying here."),
  pause,
  thought("the only way is down."),
  sys("type /help for commands. /quit to save and leave."),
]

// ---- 2. Horris ----------------------------------------------------------
// The depth-1 NPC. He doesn't act. He observes. Three trigger pools:
// return (climbed back up to depth 1), respawn (died and woke), idle.
// Tone: content in a place no one should be content in.

export const HORRIS_RETURN: string[] = [
  "still here, are you.",
  "you came back. they don't always.",
  "the lamp helps, doesn't it.",
  "you'll get used to the smell.",
  "some of them stop talking after a while.",
  "the walls remember more than i do.",
  "i didn't expect you back so soon.",
]

export const HORRIS_RESPAWN: string[] = [
  "back already.",
  "that's how it starts.",
  "hm. quick this time.",
  "the dirt got you.",
  "you'll learn.",
  "i felt the wall move when you fell.",
]

export const HORRIS_IDLE: string[] = [
  "i was going to climb out once.",
  "don't be in a hurry.",
  "sometimes i hear them. up there. the others.",
  "this isn't a bad place to wait.",
  "you can sit, if you want.",
  "the dust here is older than the dust below.",
]

// ---- 3. Band first-visit cutscenes --------------------------------------
// Plays once when deepest_depth first crosses into a band. The dust has
// none (the opening cutscene serves that purpose). The queen has none
// (her approach cutscene serves that purpose).

export const BAND_STONE_FIRST_VISIT: Emit[] = [
  story("the shaft narrows. the walls are smoother now."),
  story("like something polished them, a long time ago."),
  story("the dust from above doesn't reach this deep."),
  sys("/read to see inscriptions here. /mark <text> to leave your own."),
]

export const BAND_WRITING_FIRST_VISIT: Emit[] = [
  story("inscriptions begin to appear on the walls."),
  story("horrors. this place is not right."),
  pause,
  story("the wall remembers everyone."),
]

export const BAND_DAMP_FIRST_VISIT: Emit[] = [
  story("your breath fogs. the rock is wet to the touch."),
  story("water trickles somewhere out of sight."),
  story("the air here is wrong. it is freezing cold."),
]

export const BAND_QUIET_FIRST_VISIT: Emit[] = [
  story("sound dies here."),
  story("your words don't echo. your own breath sounds far away."),
  story("this is not a place where things rest."),
]

// ---- 4. Ambient lines ---------------------------------------------------
// One per ~90s during exploration. Silent on the surface and in the
// queen's chamber.

export const AMBIENT_DUST: string[] = [
  "dust drifts down from above.",
  "the rock is warm from the surface.",
  "something skitters somewhere overhead. probably nothing.",
  "the air still tastes like the surface up here.",
]

export const AMBIENT_STONE: string[] = [
  "the walls smell of old iron.",
  "you think you hear sounds. you can't be sure.",
  "the dust thins. the air grows denser.",
  "your light catches faint scratches in the rock.",
]

export const AMBIENT_WRITING: string[] = [
  "someone wrote a name here long ago.",
  "the inscriptions get harder to read at this depth.",
  "the wall is colder than it should be.",
  "the carvings are deeper here. older hands.",
]

export const AMBIENT_DAMP: string[] = [
  "something drips, far above.",
  "the rock is slick. you slow down.",
  "your breath comes in clouds.",
  "water finds the cracks before you do.",
]

export const AMBIENT_QUIET: string[] = [
  "you stop breathing for a moment to listen.",
  "the silence is wrong. the silence is full.",
  "something is paying attention.",
  "your light moves slower in this air.",
]

// ---- 5. Ant -------------------------------------------------------------
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

// ---- 6. Ant telegraphs --------------------------------------------------
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

// ---- 7. Queen approach + returns ----------------------------------------
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

// ---- 8. Queen telegraphs ------------------------------------------------
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

// ---- 9. Queen victory ---------------------------------------------------
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

// ---- 10. Combat outcome messages ---------------------------------------
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
