// Horris — the depth-1 NPC.
//
// He doesn't move, doesn't take input, doesn't fight. He speaks one
// dialog line on each of three triggers:
//
//   - return:  the player climbed back up to depth 1 from deeper
//   - respawn: the player died and woke at depth 1
//   - idle:    the player has been at depth 1 long enough that the
//              shaft has gone quiet
//
// Tone: he's been here long enough to be content, which is the wrong
// reaction. Nothing he says is threatening. The wrongness is ambient.

import type { Emit } from "./types.ts"
import { MIN_DEPTH } from "./world.ts"

export const HORRIS_IDLE_INTERVAL_MS = 60_000

const RETURN_LINES = [
  "still here, are you.",
  "you came back. they don't always.",
  "the lamp helps, doesn't it.",
  "you'll get used to the smell.",
  "some of them stop talking after a while.",
  "the walls remember more than i do.",
  "i didn't expect you back so soon.",
]

const RESPAWN_LINES = [
  "back already.",
  "that's how it starts.",
  "hm. quick this time.",
  "the dirt got you.",
  "you'll learn.",
  "i felt the wall move when you fell.",
]

const IDLE_LINES = [
  "i was going to climb out once.",
  "don't be in a hurry.",
  "sometimes i hear them. up there. the others.",
  "this isn't a bad place to wait.",
  "you can sit, if you want.",
  "the dust here is older than the dust below.",
]

const dialog = (text: string): Emit => ({ style: "dialog", text: `"${text}"` })

function pick(pool: string[]): Emit {
  return dialog(pool[Math.floor(Math.random() * pool.length)]!)
}

export const returnLine  = (): Emit => pick(RETURN_LINES)
export const respawnLine = (): Emit => pick(RESPAWN_LINES)
export const idleLine    = (): Emit => pick(IDLE_LINES)

// True when this move dropped the player back into depth 1 from deeper.
export function returnedToDepthOne(oldDepth: number, newDepth: number): boolean {
  return oldDepth > MIN_DEPTH && newDepth === MIN_DEPTH
}
