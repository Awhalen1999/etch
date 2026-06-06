// Encounter machinery — enemy registry + the roll-while-resting check.
//
// The ant is the only random enemy. Internal kind id is "ant" but
// player-facing text always says "enemy" (the queen is "the queen"
// from her own def below). Cutscene and arrival prose live in prose.ts.

import type { EncounterState, Emit, EnemyKind } from "./types.ts"
import { ANT_ARRIVALS, ANT_FIRST_ENCOUNTER } from "./prose.ts"
import { encounterChanceFor } from "./world.ts"

// ---- Enemy registry ----

export interface EnemyDef {
  kind: EnemyKind
  name: string
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  ant:   { kind: "ant",   name: "enemy" },
  queen: { kind: "queen", name: "the queen" },
}

// ---- Roll ----

export function rollEncounter(depth: number, now: number): EncounterState | null {
  const chance = encounterChanceFor(depth)
  if (chance <= 0) return null
  if (Math.random() >= chance) return null
  return { enemy: "ant", startedAt: now }
}

// ---- Arrival lines ----
//
// Both builders return ONLY the atmospheric/story portion. The
// "an enemy blocks your path." UI hint is emitted by the reducer at
// the end of the cutscene script.

export function firstEncounterLines(): Emit[] {
  return ANT_FIRST_ENCOUNTER
}

export function arrivalLinesFor(_kind: EnemyKind): Emit[] {
  const text = ANT_ARRIVALS[Math.floor(Math.random() * ANT_ARRIVALS.length)]!
  return [{ style: "story", text }]
}
