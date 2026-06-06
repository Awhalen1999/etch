// Shared cutscene plumbing for the opening narration and the band
// first-visits. Each returns an Emit[] that the cutscene queue plays
// one line per CUTSCENE_LINE_MS. Prose lives in prose.ts.

import type { Band } from "./world.ts"
import type { Emit } from "./types.ts"
import {
  BAND_DAMP_FIRST_VISIT,
  BAND_QUIET_FIRST_VISIT,
  BAND_STONE_FIRST_VISIT,
  BAND_WRITING_FIRST_VISIT,
  OPENING_CUTSCENE,
} from "./prose.ts"

// ---- Opening narration -------------------------------------------------
// Plays once on first-ever launch.

export function openingCutsceneLines(): Emit[] {
  return OPENING_CUTSCENE
}

// ---- Band first-visit cutscenes ----------------------------------------
// Fire once when deepest_depth first crosses into a band. The dust has
// none (the opening cutscene covers it). The queen and the surface have
// none (each owns its own scripted moment).

export function bandFirstVisitLines(band: Band): Emit[] | null {
  switch (band) {
    case "the stone":   return BAND_STONE_FIRST_VISIT
    case "the writing": return BAND_WRITING_FIRST_VISIT
    case "the damp":    return BAND_DAMP_FIRST_VISIT
    case "the quiet":   return BAND_QUIET_FIRST_VISIT
    case "the surface":
    case "the dust":
    case "the queen":
      return null
  }
}

// ---- Band crossing detection -------------------------------------------
// Returns the band the player just entered if their deepest depth
// crossed a band threshold this move, otherwise null.

export function bandCrossing(oldDeepest: number, newDeepest: number): Band | null {
  if (newDeepest <= oldDeepest) return null
  const thresholds: Array<[number, Band]> = [
    [31, "the stone"],
    [81, "the writing"],
    [121, "the damp"],
    [161, "the quiet"],
  ]
  for (const [t, band] of thresholds) {
    if (oldDeepest < t && newDeepest >= t) return band
  }
  return null
}
