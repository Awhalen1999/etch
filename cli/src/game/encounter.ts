// Encounter data + roll logic.
//
// The ant is the only authored enemy for now (design.md). HP and combat
// resolution land in the next slice; this file just owns the spawn side.

import type { EnemyKind, Emit, EncounterState } from "./types.ts"
import { encounterChanceFor } from "./world.ts"

export interface EnemyDef {
  kind: EnemyKind
  name: string
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  ant: { kind: "ant", name: "ant" },
}

// Returns an encounter if the roll fires, otherwise null.
export function rollEncounter(depth: number, now: number): EncounterState | null {
  const chance = encounterChanceFor(depth)
  if (chance <= 0) return null
  if (Math.random() >= chance) return null
  return { enemy: "ant", startedAt: now }
}

// ---- Prose ----

// First-time ant encounter cutscene (story.md). Emitted once per save.
// Each line lands 1s after the previous via the cutscene queue.
export function firstEncounterLines(): Emit[] {
  const story = (text: string): Emit => ({ style: "story", text })
  return [
    story("something moves in the dark below you."),
    story("you hear it before you see it."),
    story("legs. too many legs. clicking against stone."),
    story("it pulls itself up onto the beam in front of you."),
    story("it's the size of a man."),
    story("its head is wrong. smooth and ridged like cracked bone."),
    story("two black eyes catch your headlamp and don't reflect it back."),
    story("they just swallow the light."),
    story("its mandibles open sideways."),
    story("they're serrated. wet. there's something dark caught between them."),
    story("it smells like copper and rot."),
    story("it doesn't charge. it just watches you."),
    story("its antennae twitch once. twice."),
    story("it knows you're here."),
  ]
}

// Subsequent encounters: short arrival prose. Picked at random.
const ANT_ARRIVAL_TEMPLATES: string[] = [
  "clicking, close. it pulls itself onto the beam.",
  "legs scrape the stone. an ant rises into the light.",
  "the dark shifts. mandibles, then eyes that don't reflect.",
]

export function arrivalLinesFor(kind: EnemyKind): Emit[] {
  const def = ENEMY_DEFS[kind]
  const template = ANT_ARRIVAL_TEMPLATES[
    Math.floor(Math.random() * ANT_ARRIVAL_TEMPLATES.length)
  ]!
  return [
    { style: "story", text: template },
    { style: "system", text: `a ${def.name} blocks your path.` },
  ]
}

// Prompt line printed at the end of every encounter intro.
export function promptLine(): Emit {
  return { style: "system", text: "press F to fight. E to escape." }
}
