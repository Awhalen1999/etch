// Ambient atmosphere lines.
//
// Per-band string pools. The reducer emits one line every
// AMBIENT_INTERVAL_MS during quiet exploration. They fill the silence
// between encounters and reinforce each band's character — warm dust up
// top, cold dripping rock further down, full silence at the bottom.
// No mechanics; pure flavor.
//
// The surface (depth 0) and the queen's chamber (depth 200) get no
// ambient lines — both are scripted moments that should own their air.

import type { Emit } from "./types.ts"
import { bandForDepth, type Band } from "./world.ts"

export const AMBIENT_INTERVAL_MS = 90_000

const DUST_LINES = [
  "dust drifts down from above.",
  "the rock is warm from the surface.",
  "something skitters somewhere overhead. probably nothing.",
  "the air still tastes like the surface up here.",
]

const STONE_LINES = [
  "the walls smell of old iron.",
  "you think you hear sounds. you can't be sure.",
  "the dust thins. the air grows denser.",
  "your light catches faint scratches in the rock.",
]

const WRITING_LINES = [
  "someone wrote a name here long ago.",
  "the inscriptions get harder to read at this depth.",
  "the wall is colder than it should be.",
  "the carvings are deeper here. older hands.",
]

const DAMP_LINES = [
  "something drips, far above.",
  "the rock is slick. you slow down.",
  "your breath comes in clouds.",
  "water finds the cracks before you do.",
]

const QUIET_LINES = [
  "you stop breathing for a moment to listen.",
  "the silence is wrong. the silence is full.",
  "something is paying attention.",
  "your light moves slower in this air.",
]

function poolForBand(band: Band): string[] | null {
  switch (band) {
    case "the dust":    return DUST_LINES
    case "the stone":   return STONE_LINES
    case "the writing": return WRITING_LINES
    case "the damp":    return DAMP_LINES
    case "the quiet":   return QUIET_LINES
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
