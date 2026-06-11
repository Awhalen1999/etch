// Combat engine. Pure math + outcome resolution.
//
// No prose lives here. Telegraph pools and outcome messages live in
// prose.ts; this file is the timing math and the sweet-spot matrix.
//
// Two values are shared by both the renderer and the press resolver so
// the player is judged against exactly what they see:
//   - barPosition(startedAt, now)  -> the bouncing tick's position
//   - inSweetSpot(position)        -> hit-window check

import type { CombatRound, EnemyIntent, EnemyKind, ResultSeverity } from "./types.ts"
import {
  ANT_AMBIGUOUS_TELEGRAPHS,
  ANT_ATTACK_TELEGRAPHS,
  ANT_OPEN_TELEGRAPHS,
  COMBAT_MESSAGES,
  QUEEN_AMBIGUOUS_TELEGRAPHS,
  QUEEN_ATTACK_TELEGRAPHS,
  QUEEN_OPEN_TELEGRAPHS,
} from "./prose.ts"
import {
  BRACE_STAMINA_COST,
  ROUND_CYCLE_MS,
  STRIKE_STAMINA_COST,
  SWEET_SPOT_HIGH,
  SWEET_SPOT_LOW,
  WRONG_STRIKE_PENALTY,
  ambiguousChanceFor,
} from "./world.ts"

// ---- Bar position ------------------------------------------------------
//
// A triangular wave: 0 -> 1 -> 0 over ROUND_CYCLE_MS. At cycle start the
// tick is at the left edge; halfway through it has reached the right edge;
// at the end of the cycle it's back at the left. Repeats indefinitely.

export function barPosition(startedAt: number, now: number): number {
  const cyclePos = ((now - startedAt) % ROUND_CYCLE_MS) / ROUND_CYCLE_MS
  return 1 - Math.abs(2 * cyclePos - 1)
}

export function inSweetSpot(position: number): boolean {
  return position >= SWEET_SPOT_LOW && position <= SWEET_SPOT_HIGH
}

// ---- Round construction ------------------------------------------------

export function nextRound(enemy: EnemyKind, depth: number, now: number): CombatRound {
  const intent: EnemyIntent = Math.random() < 0.5 ? "attack" : "open"
  const ambiguous = Math.random() < ambiguousChanceFor(depth)
  const pool = telegraphPool(enemy, intent, ambiguous)
  const telegraph = pool[Math.floor(Math.random() * pool.length)]!
  return { intent, telegraph, startedAt: now }
}

function telegraphPool(enemy: EnemyKind, intent: EnemyIntent, ambiguous: boolean): readonly string[] {
  if (enemy === "queen") {
    if (ambiguous) return QUEEN_AMBIGUOUS_TELEGRAPHS
    return intent === "attack" ? QUEEN_ATTACK_TELEGRAPHS : QUEEN_OPEN_TELEGRAPHS
  }
  if (ambiguous) return ANT_AMBIGUOUS_TELEGRAPHS
  return intent === "attack" ? ANT_ATTACK_TELEGRAPHS : ANT_OPEN_TELEGRAPHS
}

// ---- Press resolution --------------------------------------------------
//
// Six leaves total: {in-sweet-spot vs not} × {S vs B} × {attack vs open}.
// Outside the sweet spot the key doesn't matter — the action fizzles and
// the enemy resolves on its own. Inside the sweet spot, the read (S vs B
// matched against attack vs open) decides win / loss / neutral.

export interface RoundOutcome {
  damage: number
  staminaCost: number
  message: string
  severity: ResultSeverity
}

export function resolveTiming(
  key: "S" | "B",
  intent: EnemyIntent,
  inSweetSpot: boolean,
  attackPower: number,
  defensePower: number,
): RoundOutcome {
  const penalty = penaltyAfterDefense(defensePower)

  // Missed the window. Action doesn't fire; the enemy resolves anyway.
  if (!inSweetSpot) {
    if (intent === "attack") return loss(0, penalty, COMBAT_MESSAGES.mistimedAttack)
    return neutral(0, 0, COMBAT_MESSAGES.mistimedOpen)
  }

  // In the window with a strike.
  if (key === "S") {
    if (intent === "open") return win(attackPower, STRIKE_STAMINA_COST, COMBAT_MESSAGES.cleanStrike)
    return loss(0, penalty, COMBAT_MESSAGES.swungIntoAttack)
  }

  // In the window with a brace.
  if (intent === "attack") return win(0, BRACE_STAMINA_COST, COMBAT_MESSAGES.braceAttack)
  return neutral(0, BRACE_STAMINA_COST, COMBAT_MESSAGES.braceOpen)
}

// ---- Outcome constructors ----------------------------------------------

function win(damage: number, staminaCost: number, message: string): RoundOutcome {
  return { damage, staminaCost, message, severity: "win" }
}

function loss(damage: number, staminaCost: number, message: string): RoundOutcome {
  return { damage, staminaCost, message, severity: "loss" }
}

function neutral(damage: number, staminaCost: number, message: string): RoundOutcome {
  return { damage, staminaCost, message, severity: "neutral" }
}

function penaltyAfterDefense(defensePower: number): number {
  return Math.max(0, WRONG_STRIKE_PENALTY - defensePower)
}
