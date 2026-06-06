// Ambient atmosphere lines.
//
// Picks one line from the current band's pool every AMBIENT_INTERVAL_MS
// during quiet exploration. Pools live in prose.ts so all narrative
// text is in one file; this module is just the picker.

import type { Emit } from "./types.ts"
import { bandForDepth, type Band } from "./world.ts"
import {
  AMBIENT_DAMP,
  AMBIENT_DUST,
  AMBIENT_QUIET,
  AMBIENT_STONE,
  AMBIENT_WRITING,
} from "./prose.ts"

export const AMBIENT_INTERVAL_MS = 90_000

function poolForBand(band: Band): string[] | null {
  switch (band) {
    case "the dust":    return AMBIENT_DUST
    case "the stone":   return AMBIENT_STONE
    case "the writing": return AMBIENT_WRITING
    case "the damp":    return AMBIENT_DAMP
    case "the quiet":   return AMBIENT_QUIET
    case "the surface":
    case "the queen":
      return null
  }
}

export function ambientLineFor(depth: number): Emit | null {
  const pool = poolForBand(bandForDepth(depth))
  if (!pool) return null
  const text = pool[Math.floor(Math.random() * pool.length)]!
  return { style: "ambient", text }
}
