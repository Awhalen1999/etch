// Encounter data + roll logic.
//
// The ant is the only authored enemy for now (design canon). Internal
// kind id is "ant" — they're giant ants — but player-facing text always
// says "enemy". Don't expose the kind in prose.
//
// This file owns the spawn side: roll on rest, return an encounter or
// null. The cutscene prose lives here too because it's part of how
// encounters surface; combat math itself lives in combat.ts.

import type { EnemyKind, Emit, EncounterState } from "./types.ts"
import { encounterChanceFor } from "./world.ts"

// ---- Enemy registry ----

export interface EnemyDef {
  kind: EnemyKind
  name: string
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  ant: { kind: "ant", name: "enemy" },
}

// ---- Roll ----

export function rollEncounter(depth: number, now: number): EncounterState | null {
  const chance = encounterChanceFor(depth)
  if (chance <= 0) return null
  if (Math.random() >= chance) return null
  return { enemy: "ant", startedAt: now }
}

// ---- Prose ----
//
// Both line builders return ONLY the atmospheric/story portion. The
// "an enemy blocks your path." UI hint is emitted into the main scroll
// at encounter start, not as part of the cutscene script.

const story = (text: string): Emit => ({ style: "story", text })
const pause: Emit = { style: "pause", text: "..." }

// First-time ant encounter. Plays once per save.
export function firstEncounterLines(): Emit[] {
  return [
    story("something moves in the dark below you."),
    pause,
    story("you hear it before you see it."),
    story("legs. too many legs. clicking against stone."),
    pause,
    story("it pulls itself up onto the beam in front of you."),
    pause,
    story("it's the size of a man."),
    pause,
    story("its head is wrong. smooth and ridged like cracked bone."),
    story("two black eyes catch your headlamp and don't reflect it back."),
    story("they just swallow the light."),
    pause,
    story("its mandibles open sideways."),
    story("they're serrated. wet. there's something dark caught between them."),
    pause,
    story("it smells like copper and rot."),
    pause,
    story("it doesn't charge. it just watches you."),
    story("its antennae twitch once. twice."),
    pause,
    story("it knows you're here."),
  ]
}

// Subsequent encounters: a single atmospheric line picked at random.
const ARRIVAL_TEMPLATES: string[] = [
  "clicking, close. it pulls itself onto the beam.",
  "legs scrape the stone. it rises into the light.",
  "the dark shifts. mandibles, then eyes that don't reflect.",
]

export function arrivalLinesFor(_kind: EnemyKind): Emit[] {
  const template = ARRIVAL_TEMPLATES[
    Math.floor(Math.random() * ARRIVAL_TEMPLATES.length)
  ]!
  return [story(template)]
}
