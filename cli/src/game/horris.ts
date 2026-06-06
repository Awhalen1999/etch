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
// Pools live in prose.ts; this file is just the pickers + the
// depth-1-detection helper used by the reducer.

import type { Emit } from "./types.ts"
import { HORRIS_IDLE, HORRIS_RESPAWN, HORRIS_RETURN } from "./prose.ts"
import { MIN_DEPTH } from "./world.ts"

export const HORRIS_IDLE_INTERVAL_MS = 60_000

function dialog(pool: string[]): Emit {
  const text = pool[Math.floor(Math.random() * pool.length)]!
  return { style: "dialog", text: `"${text}"` }
}

export const returnLine  = (): Emit => dialog(HORRIS_RETURN)
export const respawnLine = (): Emit => dialog(HORRIS_RESPAWN)
export const idleLine    = (): Emit => dialog(HORRIS_IDLE)

// True when this move dropped the player back into depth 1 from deeper.
export function returnedToDepthOne(oldDepth: number, newDepth: number): boolean {
  return oldDepth > MIN_DEPTH && newDepth === MIN_DEPTH
}
