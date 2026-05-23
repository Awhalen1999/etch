// Out-of-combat command dispatcher.
//
// Each command is a pure function from (player, args, now) → CommandResult.
// The reducer applies the result to the broader GameState (line buffer,
// quit flag). Keeping this layer pure means new commands are just new cases.

import type { LineStyle, PlayerState } from "./types.ts"
import {
  DOWN_COST,
  MAX_DEPTH,
  MIN_DEPTH,
  MOVE_COOLDOWN_MS,
  UP_COST,
  bandForDepth,
} from "./world.ts"

export interface Emit {
  style: LineStyle
  text: string
}

export interface CommandResult {
  player: PlayerState
  emit: Emit[]
  quit?: boolean
}

export function runCommand(player: PlayerState, raw: string, now: number): CommandResult {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { player, emit: [] }

  const echo: Emit = { style: "echo", text: trimmed }
  const [head] = trimmed.split(/\s+/)

  switch (head) {
    case "/down":
      return moveDown(player, now, echo)
    case "/up":
      return moveUp(player, now, echo)
    case "/rest":
      return rest_(player, echo)
    case "/me":
      return me(player, echo)
    case "/help":
      return help(player, echo)
    case "/quit":
      return quit(player, echo)
    default:
      return {
        player,
        emit: [echo, { style: "error", text: `unknown command: ${trimmed}` }],
      }
  }
}

// ---- Commands ----

function moveDown(player: PlayerState, now: number, echo: Emit): CommandResult {
  if (player.depth >= MAX_DEPTH) {
    return { player, emit: [echo, err("you are at the bottom.")] }
  }
  if (player.stamina < DOWN_COST) {
    return { player, emit: [echo, err("you don't have the strength.")] }
  }
  if (now - player.lastMoveAt < MOVE_COOLDOWN_MS) {
    return { player, emit: [echo, err("you need to catch your breath.")] }
  }
  const depth = player.depth + 1
  return {
    player: {
      ...player,
      depth,
      deepest: Math.max(player.deepest, depth),
      stamina: player.stamina - DOWN_COST,
      lastMoveAt: now,
      resting: false,
    },
    emit: [echo, { style: "system", text: `depth ${depth}.` }],
  }
}

function moveUp(player: PlayerState, now: number, echo: Emit): CommandResult {
  if (player.depth <= MIN_DEPTH) {
    return { player, emit: [echo, err("the lip overhangs. no climbing back.")] }
  }
  if (player.stamina < UP_COST) {
    return { player, emit: [echo, err("you don't have the strength to climb.")] }
  }
  if (now - player.lastMoveAt < MOVE_COOLDOWN_MS) {
    return { player, emit: [echo, err("you need to catch your breath.")] }
  }
  const depth = player.depth - 1
  return {
    player: {
      ...player,
      depth,
      stamina: player.stamina - UP_COST,
      lastMoveAt: now,
      resting: false,
    },
    emit: [echo, { style: "system", text: `depth ${depth}.` }],
  }
}

function rest_(player: PlayerState, echo: Emit): CommandResult {
  if (player.resting) {
    return {
      player: { ...player, resting: false },
      emit: [echo, sys("you stand up.")],
    }
  }
  return {
    player: { ...player, resting: true },
    emit: [echo, sys("you sit and rest.")],
  }
}

function me(player: PlayerState, echo: Emit): CommandResult {
  return {
    player,
    emit: [
      echo,
      sys(`name: ${player.name}`),
      sys(`depth: ${player.depth} — ${bandForDepth(player.depth)}`),
      sys(`stamina: ${player.stamina}/${player.maxStamina}`),
      sys(`deepest: ${player.deepest}`),
    ],
  }
}

function help(player: PlayerState, echo: Emit): CommandResult {
  return {
    player,
    emit: [
      echo,
      sys("/down — descend one level"),
      sys("/up — ascend one level"),
      sys("/rest — sit and recover stamina"),
      sys("/me — character sheet"),
      sys("/quit — save and exit"),
    ],
  }
}

function quit(player: PlayerState, echo: Emit): CommandResult {
  return {
    player,
    emit: [echo, sys("the lamp dims.")],
    quit: true,
  }
}

// ---- Tiny line constructors ----

const sys = (text: string): Emit => ({ style: "system", text })
const err = (text: string): Emit => ({ style: "error", text })
