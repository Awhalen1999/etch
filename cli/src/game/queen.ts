// Queen-specific pickers and helpers.
//
// The queen lives at depth 200. /down lands on 200, the approach
// cutscene plays once (gated on seenQueenApproach), then pre-combat
// begins. On kill, a single victory cutscene covers everything from her
// fall through the climb out to the surface; when it ends the player is
// at depth 0 with queenKilled set.
//
// All queen prose (approach, returns, victory, telegraphs) lives in
// prose.ts. This file is just the picker functions + the arrival check.

import type { Emit } from "./types.ts"
import { QUEEN_APPROACH, QUEEN_RETURNS, QUEEN_VICTORY } from "./prose.ts"
import { MAX_DEPTH } from "./world.ts"

export function queenApproachLines(): Emit[] {
  return QUEEN_APPROACH
}

export function queenVictoryLines(): Emit[] {
  return QUEEN_VICTORY
}

export function queenReturnLines(): Emit[] {
  const line = QUEEN_RETURNS[Math.floor(Math.random() * QUEEN_RETURNS.length)]!
  return [{ style: "story", text: line }]
}

// True when this move dropped the player into the queen's chamber.
export function arrivedAtQueen(oldDepth: number, newDepth: number): boolean {
  return newDepth === MAX_DEPTH && oldDepth < newDepth
}
