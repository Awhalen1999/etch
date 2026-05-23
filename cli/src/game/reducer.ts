// Single useReducer that owns all game state.
//
// Actions:
//   - command: a typed input from the prompt
//   - tick:    1Hz heartbeat for stamina recovery (later: encounter rolls,
//              ambient lines, cooldowns)

import type { GameAction, GameState, Line, PlayerState } from "./types.ts"
import { runCommand } from "./commands.ts"
import { BASE_MAX_STAMINA, MIN_DEPTH, REST_RECOVERY_PER_SECOND } from "./world.ts"

const MAX_LINES = 500

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.kind) {
    case "command": {
      const result = runCommand(state.player, action.raw, action.now)
      let nextLineId = state.nextLineId
      const newLines: Line[] = result.emit.map((e) => ({ id: nextLineId++, ...e }))
      const lines = trim([...state.lines, ...newLines])
      return {
        player: result.player,
        lines,
        nextLineId,
        quitting: state.quitting || !!result.quit,
      }
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

export function freshState(name: string): GameState {
  return {
    player: freshPlayer(name),
    lines: [
      { id: 0, style: "system", text: "you wake at depth 1." },
      { id: 1, style: "system", text: "type /help for commands." },
    ],
    nextLineId: 2,
    quitting: false,
  }
}

export function resumeState(player: PlayerState): GameState {
  return {
    player,
    lines: [
      { id: 0, style: "system", text: `you return to depth ${player.depth}.` },
    ],
    nextLineId: 1,
    quitting: false,
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
  }
}

// Cap the line buffer so the scroll history doesn't grow forever.
function trim(lines: Line[]): Line[] {
  if (lines.length <= MAX_LINES) return lines
  return lines.slice(lines.length - MAX_LINES)
}
