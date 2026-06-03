// Queen-specific cutscenes, telegraph pools, and helpers.
//
// The queen lives at depth 200. /down lands on 200, the approach cutscene
// plays once (gated on seenQueenApproach), then pre-combat begins. On
// kill, a single victory cutscene covers everything from her fall through
// climbing the shaft to the surface; when it ends, the player is at
// depth 0 with queenKilled set.

import type { Emit } from "./types.ts"
import { MAX_DEPTH } from "./world.ts"

// ---- Line helpers ------------------------------------------------------

const story   = (text: string): Emit => ({ style: "story", text })
const thought = (text: string): Emit => ({ style: "thought", text })
const sys     = (text: string): Emit => ({ style: "system", text })
const pause:   Emit = { style: "pause", text: "..." }

// ---- Approach (first time at depth 200) --------------------------------

export function queenApproachLines(): Emit[] {
  return [
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
}

// ---- Approach (subsequent visits after escape) -------------------------

const RETURN_LINES: string[] = [
  "she is still here. the trail is still wet.",
  "the chamber pulses again. she has not moved.",
  "the bones are where you left them.",
]

export function queenReturnLines(): Emit[] {
  const line = RETURN_LINES[Math.floor(Math.random() * RETURN_LINES.length)]!
  return [story(line)]
}

// ---- Victory (kill → sac → climb → surface) ----------------------------

export function queenVictoryLines(): Emit[] {
  return [
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
}

// ---- Telegraphs --------------------------------------------------------
//
// Three pools. combat.nextRound picks one each round based on the queen's
// committed intent and the rolled ambiguous flag. Queen-specific prose
// lives here; the engine in combat.ts stays generic.

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

// ---- Detection ---------------------------------------------------------

// True when this move dropped the player into the queen's chamber.
export function arrivedAtQueen(oldDepth: number, newDepth: number): boolean {
  return newDepth === MAX_DEPTH && oldDepth < newDepth
}
