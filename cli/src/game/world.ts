// Pure helpers about the world: depth bands, movement costs, recovery rates.
// No state, no side effects - easy to test in isolation.

export type Band = "the dust" | "the stone" | "the writing" | "the damp" | "the quiet" | "the queen"

export function bandForDepth(depth: number): Band {
  if (depth <= 30) return "the dust"
  if (depth <= 80) return "the stone"
  if (depth <= 120) return "the writing"
  if (depth <= 160) return "the damp"
  if (depth <= 199) return "the quiet"
  return "the queen"
}

export const DOWN_COST = 4
export const UP_COST = 8
export const MOVE_COOLDOWN_MS = 2_000
export const REST_RECOVERY_PER_SECOND = 2
export const BASE_MAX_STAMINA = 100
export const MIN_DEPTH = 1
export const MAX_DEPTH = 200
