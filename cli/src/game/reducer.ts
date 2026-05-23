// Single useReducer that owns all game state.
//
// Actions:
//   - command: a typed input from the prompt
//   - tick:    1Hz heartbeat for stamina recovery (later: encounter rolls,
//              ambient lines, cooldowns)

import type { Emit, GameAction, GameState, Inscription, Line, PlayerState } from "./types.ts"
import { runCommand } from "./commands.ts"
import { BASE_MAX_STAMINA, MIN_DEPTH, REST_RECOVERY_PER_SECOND } from "./world.ts"

const MAX_LINES = 500

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.kind) {
    case "command": {
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
      if (!state.player.resting) return state
      if (state.player.stamina >= state.player.maxStamina) return state
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
  }
}

export function resumeState(player: PlayerState, inscriptions: Inscription[]): GameState {
  // Migrate saves from before the items system landed.
  const safe: PlayerState = {
    ...player,
    items: player.items ?? [],
    currentDepthItem: player.currentDepthItem ?? null,
  }
  return {
    player: safe,
    lines: [
      { id: 0, style: "system", text: `you return to depth ${safe.depth}.` },
    ],
    nextLineId: 1,
    quitting: false,
    inscriptions,
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
  }
}

// Cap the line buffer so the scroll history doesn't grow forever.
function trim(lines: Line[]): Line[] {
  if (lines.length <= MAX_LINES) return lines
  return lines.slice(lines.length - MAX_LINES)
}
