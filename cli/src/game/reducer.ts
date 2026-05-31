// Single useReducer that owns all game state.
//
// Actions:
//   - command:        a typed input from the prompt (explore only)
//   - emit:           append lines to the scroll (used by side-effect helpers)
//   - setInscriptions: replace the cached inscription list
//   - tick:           1Hz heartbeat. Drains cutscenes, recovers stamina,
//                     rolls for encounters, and times out pre-combat
//   - engage:         F pressed during pre-combat. Hands off to in_combat
//   - escape:         E pressed during pre/in combat. -30 stamina, depth up ~10%
//   - strike / brace: S / B pressed during in_combat. Resolves the round
//   - forceQuit:      Ctrl+C. Death if pre/in combat, clean exit otherwise
//   - respawn:        UI calls this after the death-marker is carved

import type {
  CombatState,
  Cutscene,
  CutsceneDone,
  Emit,
  EnemyKind,
  GameAction,
  GameState,
  Inscription,
  Line,
  PlayerState,
} from "./types.ts"
import { runCommand } from "./commands.ts"
import {
  BASE_MAX_STAMINA,
  CUTSCENE_LINE_MS,
  ENCOUNTER_ROLL_INTERVAL_MS,
  ENCOUNTER_TIMEOUT_MS,
  ESCAPE_STAMINA_COST,
  MIN_DEPTH,
  REST_RECOVERY_PER_SECOND,
  enemyHpFor,
  escapeDepthFrom,
} from "./world.ts"
import { arrivalLinesFor, firstEncounterLines, promptLine, rollEncounter } from "./encounter.ts"
import { barPosition, inSweetSpot, nextRound, resolveTiming } from "./combat.ts"
import { attackPowerFor, defensePowerFor } from "./items.ts"

const MAX_LINES = 500

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.kind) {
    case "command": {
      // Text commands are explore-only and never run during a cutscene.
      if (state.cutscene || state.phase !== "explore") return state
      const result = runCommand(
        { player: state.player, inscriptions: state.inscriptions },
        action.raw,
        action.now,
      )
      return {
        ...appendEmit(state, result.emit),
        player: result.player,
        quitting: state.quitting || !!result.quit,
      }
    }
    case "emit": {
      return appendEmit(state, action.lines)
    }
    case "setInscriptions": {
      return { ...state, inscriptions: action.list }
    }
    case "tick": {
      return advanceTick(state, action.now)
    }
    case "engage": {
      if (state.cutscene) return state
      if (state.phase !== "pre_combat" || !state.encounter) return state
      return enterCombat(state, state.encounter.enemy, action.now)
    }
    case "escape": {
      if (state.cutscene) return state
      const canEscape = state.phase === "pre_combat" || state.phase === "in_combat"
      if (!canEscape) return state
      if (state.player.stamina < ESCAPE_STAMINA_COST) {
        return appendEmit(state, [
          { style: "error", text: "you don't have the strength to flee." },
        ])
      }
      const newDepth = escapeDepthFrom(state.player.depth)
      const lines: Emit[] = [
        { style: "story", text: "you scramble back up the shaft." },
        { style: "system", text: `depth ${newDepth}.` },
      ]
      return {
        ...appendEmit(state, lines),
        phase: "explore",
        encounter: null,
        combat: null,
        player: {
          ...state.player,
          stamina: state.player.stamina - ESCAPE_STAMINA_COST,
          depth: newDepth,
          resting: false,
          lastMoveAt: action.now,
          currentDepthItem: null,
        },
      }
    }
    case "strike":
    case "brace": {
      if (state.phase !== "in_combat" || !state.combat) return state
      const key = action.kind === "strike" ? "S" : "B"
      return resolveCombatPress(state, state.combat, key, action.now)
    }
    case "respawn": {
      return {
        ...state,
        player: action.player,
        pendingDeath: null,
      }
    }
    case "forceQuit": {
      // Anti-cheese: bailing out of pre-combat or combat counts as a
      // death. Anywhere else it's just a clean exit.
      if (state.phase === "pre_combat" || state.phase === "in_combat") {
        return enterDeath(state, "you tried to flee. it caught you.", true)
      }
      return { ...state, quitting: true }
    }
  }
}

// ---- Tick pipeline ----
//
// Each tick runs through these steps in order. The first one that matches
// the current state returns and the rest are skipped, keeping the flow
// linear and easy to read.

function advanceTick(state: GameState, now: number): GameState {
  if (state.cutscene) return advanceCutscene(state, state.cutscene, now)
  if (state.phase === "pre_combat") return advancePreCombat(state, now)
  return advanceExplore(state, now)
}

function advanceCutscene(state: GameState, cutscene: Cutscene, now: number): GameState {
  if (now < cutscene.nextAt) return state

  const [next, ...rest] = cutscene.remaining
  if (!next) return applyCutsceneDone(state, cutscene.onDone, now)

  const emitted = appendEmit(state, [next])
  if (rest.length === 0) {
    return applyCutsceneDone({ ...emitted, cutscene: null }, cutscene.onDone, now)
  }
  return {
    ...emitted,
    cutscene: { remaining: rest, nextAt: now + CUTSCENE_LINE_MS, onDone: cutscene.onDone },
  }
}

function applyCutsceneDone(state: GameState, done: CutsceneDone, now: number): GameState {
  switch (done.kind) {
    case "none":
      return { ...state, cutscene: null }
    case "encounter":
      return {
        ...state,
        cutscene: null,
        phase: "pre_combat",
        encounter: { enemy: done.enemy, startedAt: now },
      }
  }
}

function advancePreCombat(state: GameState, now: number): GameState {
  if (!state.encounter) return state
  if (now - state.encounter.startedAt < ENCOUNTER_TIMEOUT_MS) return state
  return enterDeath(state, "the moment passes. it takes you.")
}

function advanceExplore(state: GameState, now: number): GameState {
  let next = state
  if (next.player.resting && next.player.stamina < next.player.maxStamina) {
    next = recoverStamina(next)
  }
  // Roll every 5s while resting. encounterChanceFor owns the depth rules,
  // so we don't gate on depth here.
  if (next.player.resting) {
    if (now - next.lastEncounterRollAt >= ENCOUNTER_ROLL_INTERVAL_MS) {
      next = { ...next, lastEncounterRollAt: now }
      const enc = rollEncounter(next.player.depth, now)
      if (enc) next = enterEncounter(next, enc.enemy, now)
    }
  }
  return next
}

function recoverStamina(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      stamina: Math.min(
        state.player.maxStamina,
        state.player.stamina + REST_RECOVERY_PER_SECOND,
      ),
    },
  }
}

// ---- Transitions ----

function enterCombat(state: GameState, enemy: EnemyKind, now: number): GameState {
  const maxHp = enemyHpFor(state.player.depth)
  return {
    ...state,
    phase: "in_combat",
    encounter: null,
    combat: {
      enemy,
      enemyMaxHp: maxHp,
      enemyHp: maxHp,
      round: nextRound(state.player.depth, now),
      lastResult: null,
    },
  }
}

// One S/B press resolves the current round: compute bar position, run
// the timing/intent math, then end combat (win/death) or start the next
// round. No side effects — pure state transformation.
function resolveCombatPress(
  state: GameState,
  combat: CombatState,
  key: "S" | "B",
  now: number,
): GameState {
  const pos = barPosition(combat.round.startedAt, now)
  const outcome = resolveTiming(
    key,
    combat.round.intent,
    inSweetSpot(pos),
    attackPowerFor(state.player.items),
    defensePowerFor(state.player.items),
  )

  const newHp = combat.enemyHp - outcome.damage
  const newStamina = Math.max(0, state.player.stamina - outcome.staminaCost)
  const playerAfter = { ...state.player, stamina: newStamina }

  if (newStamina <= 0) {
    return enterDeath({ ...state, player: playerAfter }, "your strength gives out. it takes you.")
  }

  if (newHp <= 0) {
    const lines: Emit[] = [
      { style: "story", text: outcome.message },
      { style: "story", text: "it shudders. it stops." },
      { style: "system", text: "the way is clear." },
    ]
    return {
      ...appendEmit(state, lines),
      phase: "explore",
      encounter: null,
      combat: null,
      player: playerAfter,
    }
  }

  return {
    ...state,
    combat: {
      ...combat,
      enemyHp: newHp,
      lastResult: { text: outcome.message, severity: outcome.severity },
      round: nextRound(state.player.depth, now),
    },
    player: playerAfter,
  }
}

function enterEncounter(state: GameState, enemy: EnemyKind, now: number): GameState {
  const first = !state.player.seenFirstEncounter
  const intro = first ? firstEncounterLines() : arrivalLinesFor(enemy)
  const script: Emit[] = [...intro, promptLine()]
  return {
    ...state,
    cutscene: {
      remaining: script,
      nextAt: now + CUTSCENE_LINE_MS,
      onDone: { kind: "encounter", enemy },
    },
    player: {
      ...state.player,
      resting: false,
      seenFirstEncounter: true,
    },
  }
}

function enterDeath(state: GameState, prose: string, thenQuit = false): GameState {
  const deathDepth = state.player.depth
  // A force-quit-death skips the respawn flavor — the player is leaving.
  const lines: Emit[] = thenQuit
    ? [{ style: "story", text: prose }]
    : [
        { style: "story", text: prose },
        { style: "system", text: "you wake at depth 1." },
      ]
  return {
    ...appendEmit(state, lines),
    phase: "explore",
    encounter: null,
    combat: null,
    cutscene: null,
    pendingDeath: { depth: deathDepth, thenQuit },
    player: {
      ...freshPlayer(state.player.name),
      // Preserve progress that survives death.
      deepest: state.player.deepest,
      seenFirstEncounter: state.player.seenFirstEncounter,
    },
  }
}

function appendEmit(state: GameState, emit: Emit[]): GameState {
  if (emit.length === 0) return state
  let nextLineId = state.nextLineId
  const newLines: Line[] = emit.map((e) => ({ id: nextLineId++, ...e }))
  return {
    ...state,
    lines: trim([...state.lines, ...newLines]),
    nextLineId,
  }
}

export function freshState(name: string, inscriptions: Inscription[]): GameState {
  return {
    player: freshPlayer(name),
    lines: [
      { id: 0, style: "system", text: "you wake at depth 1." },
      { id: 1, style: "system", text: "type /help for commands." },
    ],
    nextLineId: 2,
    quitting: false,
    inscriptions,
    phase: "explore",
    encounter: null,
    lastEncounterRollAt: 0,
    cutscene: null,
    combat: null,
    pendingDeath: null,
  }
}

export function resumeState(player: PlayerState, inscriptions: Inscription[]): GameState {
  // Migrate saves from before the items / encounter systems landed.
  const safe: PlayerState = {
    ...player,
    items: player.items ?? [],
    currentDepthItem: player.currentDepthItem ?? null,
    seenFirstEncounter: player.seenFirstEncounter ?? false,
  }
  return {
    player: safe,
    lines: [
      { id: 0, style: "system", text: `you return to depth ${safe.depth}.` },
    ],
    nextLineId: 1,
    quitting: false,
    inscriptions,
    phase: "explore",
    encounter: null,
    lastEncounterRollAt: 0,
    cutscene: null,
    combat: null,
    pendingDeath: null,
  }
}

export function freshPlayer(name: string): PlayerState {
  return {
    name,
    depth: MIN_DEPTH,
    stamina: BASE_MAX_STAMINA,
    maxStamina: BASE_MAX_STAMINA,
    deepest: MIN_DEPTH,
    resting: false,
    lastMoveAt: 0,
    items: [],
    currentDepthItem: null,
    seenFirstEncounter: false,
  }
}

// Cap the line buffer so the scroll history doesn't grow forever.
function trim(lines: Line[]): Line[] {
  if (lines.length <= MAX_LINES) return lines
  return lines.slice(lines.length - MAX_LINES)
}
