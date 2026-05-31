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

// Encounters only roll while the player is resting at depth > 40.
export const ENCOUNTER_MIN_DEPTH = 41
export const ENCOUNTER_ROLL_INTERVAL_MS = 5_000
export const ENCOUNTER_TIMEOUT_MS = 15_000
export const ESCAPE_STAMINA_COST = 30

// Cutscenes emit one line per second for atmosphere.
export const CUTSCENE_LINE_MS = 1_000

// Per-band chance per 5s roll. Bands not listed are 0%.
export function encounterChanceFor(depth: number): number {
  if (depth < 41) return 0
  if (depth <= 80) return 0.05
  if (depth <= 120) return 0.10
  if (depth <= 160) return 0.15
  if (depth <= 199) return 0.20
  return 0
}

// Escape moves you up by ~10% of current depth, rounded up, min depth 1.
export function escapeDepthFrom(depth: number): number {
  const up = Math.ceil(depth * 0.1)
  return Math.max(MIN_DEPTH, depth - up)
}
