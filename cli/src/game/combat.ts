// Combat data + resolution.
//
// Every round, the enemy commits an intent (attack or open) and a
// telegraph string. The player sees only the telegraph and the
// bouncing timing bar. On S/B press, resolveTiming returns the outcome.
//
// Telegraphs come from three pools: clear attack reads, clear open reads,
// and an ambiguous pool that doesn't tell. Deeper depths see ambiguous
// telegraphs more often (see ambiguousChanceFor in world.ts).

import type { CombatRound, EnemyIntent, ResultSeverity } from "./types.ts"
import {
  BRACE_STAMINA_COST,
  ROUND_CYCLE_MS,
  STRIKE_STAMINA_COST,
  SWEET_SPOT_HIGH,
  SWEET_SPOT_LOW,
  WRONG_STRIKE_PENALTY,
  ambiguousChanceFor,
} from "./world.ts"

// ---- Telegraph pools ----

const ATTACK_TELEGRAPHS: string[] = [
  "its mandibles open wide.",
  "the legs coil under it.",
  "it lunges at the shoulder.",
  "its head dips. weight shifts back.",
  "it raises a leg, jagged at the joint.",
]

const OPEN_TELEGRAPHS: string[] = [
  "it pauses. the throat is exposed.",
  "the head turns. you see the soft underside.",
  "a leg slips. it is off balance.",
  "it stops moving. one eye twitches.",
  "its mandibles close. it stands still.",
]

// Ambiguous telegraphs: the intent is still committed, but the prose
// gives the player no tell. Each line grounds the unreadable moment in
// the scene (lost sight, dim headlamp, behind you) so it doesn't read
// as filler.
const AMBIGUOUS_TELEGRAPHS: string[] = [
  "your headlamp flickers. shapes fold into the dark.",
  "it slips out of the light. you only hear it breathing.",
  "the dark thickens between you. you cannot read it.",
  "it moves behind you. you can only listen.",
  "your light catches nothing. only the clicking.",
]

// ---- Bar position ----
//
// Shared by the renderer and the press resolver so what the player sees
// is exactly what they're judged on. Triangular wave 0 -> 1 -> 0 across
// ROUND_CYCLE_MS.

export function barPosition(startedAt: number, now: number): number {
  const elapsed = (now - startedAt) % ROUND_CYCLE_MS
  const frac = elapsed / ROUND_CYCLE_MS
  return 1 - Math.abs(2 * frac - 1)
}

export function inSweetSpot(position: number): boolean {
  return position >= SWEET_SPOT_LOW && position <= SWEET_SPOT_HIGH
}

// ---- Round construction ----

export function nextRound(depth: number, now: number): CombatRound {
  const intent: EnemyIntent = Math.random() < 0.5 ? "attack" : "open"
  const ambiguous = Math.random() < ambiguousChanceFor(depth)
  const pool = ambiguous
    ? AMBIGUOUS_TELEGRAPHS
    : intent === "attack"
      ? ATTACK_TELEGRAPHS
      : OPEN_TELEGRAPHS
  const telegraph = pool[Math.floor(Math.random() * pool.length)]!
  return { intent, telegraph, startedAt: now }
}

// ---- Press resolution ----

export interface RoundOutcome {
  /** HP to subtract from the enemy. */
  damage: number
  /** Stamina to subtract from the player. */
  staminaCost: number
  /** Short prose line shown in the moment panel after the round. */
  message: string
  /** Drives the color of the moment-panel result line. */
  severity: ResultSeverity
}

export function resolveTiming(
  key: "S" | "B",
  intent: EnemyIntent,
  inSweetSpot: boolean,
  attackPower: number,
  defensePower: number,
): RoundOutcome {
  // Outside the sweet spot: the action fizzles. The enemy resolves on
  // its own. An attack lands on you; an open moment passes.
  if (!inSweetSpot) {
    if (intent === "attack") {
      return {
        damage: 0,
        staminaCost: penaltyAfterDefense(defensePower),
        message: "you mistimed it. the blow lands.",
        severity: "loss",
      }
    }
    return {
      damage: 0,
      staminaCost: 0,
      message: "the moment is gone.",
      severity: "neutral",
    }
  }

  // Sweet spot landed. The read decides the outcome.
  if (key === "S") {
    if (intent === "open") {
      return {
        damage: attackPower,
        staminaCost: STRIKE_STAMINA_COST,
        message: "clean strike.",
        severity: "win",
      }
    }
    // S into an attack: you swung as it hit you.
    return {
      damage: 0,
      staminaCost: penaltyAfterDefense(defensePower),
      message: "you swung into it. the blow connects.",
      severity: "loss",
    }
  }

  // key === "B"
  if (intent === "attack") {
    return {
      damage: 0,
      staminaCost: BRACE_STAMINA_COST,
      message: "you brace. it glances off you.",
      severity: "win",
    }
  }
  // B against an opening: wasted brace.
  return {
    damage: 0,
    staminaCost: BRACE_STAMINA_COST,
    message: "you braced nothing.",
    severity: "neutral",
  }
}

function penaltyAfterDefense(defensePower: number): number {
  return Math.max(0, WRONG_STRIKE_PENALTY - defensePower)
}
