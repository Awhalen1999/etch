// Out-of-combat command dispatcher.
//
// Each command is a pure function from (player, args, now) -> CommandResult.
// The reducer applies the result to the broader GameState (line buffer,
// quit flag). Keeping this layer pure means new commands are just new cases.

import type { Emit, Inscription, PlayerState } from "./types.ts"
import {
  BASE_MAX_STAMINA,
  DOWN_COST,
  MAX_DEPTH,
  MIN_DEPTH,
  MOVE_COOLDOWN_MS,
  UP_COST,
  bandForDepth,
} from "./world.ts"
import {
  BASE_ATTACK,
  BASE_DEFENSE,
  INVENTORY_MAX,
  ITEM_DEFS,
  arrivalLine,
  attackPowerFor,
  defensePowerFor,
  rollSpawn,
  statSuffix,
  withItemAdded,
  withItemRemoved,
} from "./items.ts"

export interface CommandContext {
  player: PlayerState
  inscriptions: Inscription[]
}

export interface CommandResult {
  player: PlayerState
  emit: Emit[]
  quit?: boolean
}

export function runCommand(ctx: CommandContext, raw: string, now: number): CommandResult {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { player: ctx.player, emit: [] }

  const echo: Emit = { style: "echo", text: trimmed }
  const { head, arg } = splitCommand(trimmed)

  switch (head) {
    case "/down": return moveDown(ctx.player, now, echo)
    case "/up":   return moveUp(ctx.player, now, echo)
    case "/rest": return sit(ctx.player, echo)
    case "/take": return take(ctx.player, echo)
    case "/drop": return drop(ctx.player, arg, echo)
    case "/read": return read(ctx, echo)
    case "/me":   return me(ctx.player, echo)
    case "/help": return help(ctx.player, echo)
    case "/quit": return quit(ctx.player, echo)
    default:
      return {
        player: ctx.player,
        emit: [echo, err(`unknown command: ${trimmed}`)],
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
  return arrive({
    ...player,
    depth,
    deepest: Math.max(player.deepest, depth),
    stamina: player.stamina - DOWN_COST,
    lastMoveAt: now,
    resting: false,
    currentDepthItem: null,
  }, echo)
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
  return arrive({
    ...player,
    depth,
    stamina: player.stamina - UP_COST,
    lastMoveAt: now,
    resting: false,
    currentDepthItem: null,
  }, echo)
}

// Shared by /down and /up: roll for a spawn at the new depth and emit
// the depth + arrival lines together.
function arrive(player: PlayerState, echo: Emit): CommandResult {
  const spawn = rollSpawn(player.depth)
  const emit: Emit[] = [echo, sys(`depth ${player.depth}.`)]
  if (spawn) {
    emit.push({ style: "story", text: arrivalLine(spawn) })
  }
  return { player: { ...player, currentDepthItem: spawn }, emit }
}

function take(player: PlayerState, echo: Emit): CommandResult {
  if (!player.currentDepthItem) {
    return { player, emit: [echo, sys("nothing here.")] }
  }
  if (player.items.length >= INVENTORY_MAX) {
    return { player, emit: [echo, sys("your hands are full.")] }
  }
  const def = ITEM_DEFS[player.currentDepthItem]
  return {
    player: withItemAdded(player, player.currentDepthItem),
    emit: [echo, sys(`you take the ${def.name}.`)],
  }
}

function drop(player: PlayerState, arg: string, echo: Emit): CommandResult {
  if (arg.length === 0) {
    return { player, emit: [echo, sys("drop what?")] }
  }
  const query = arg.toLowerCase()
  const idx = player.items.findIndex((kind) => ITEM_DEFS[kind].name.toLowerCase().includes(query))
  if (idx < 0) {
    return { player, emit: [echo, sys("you don't have that.")] }
  }
  const name = ITEM_DEFS[player.items[idx]!].name
  return {
    player: withItemRemoved(player, idx),
    emit: [echo, sys(`you leave the ${name} behind.`)],
  }
}

function sit(player: PlayerState, echo: Emit): CommandResult {
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
  const attack = attackPowerFor(player.items)
  const defense = defensePowerFor(player.items)
  const lines: Emit[] = [
    echo,
    sys(`name: ${player.name}`),
    sys(`depth: ${player.depth} - ${bandForDepth(player.depth)}`),
    sys(`attack: ${attack} ${composition(attack - BASE_ATTACK)}`),
    sys(`defense: ${defense} ${composition(defense - BASE_DEFENSE)}`),
    sys(`stamina: ${player.stamina}/${player.maxStamina} ${composition(player.maxStamina - BASE_MAX_STAMINA)}`),
    sys(`deepest: ${player.deepest}`),
  ]
  if (player.items.length === 0) {
    lines.push(sys("inventory: empty"))
  } else {
    lines.push(sys("inventory:"))
    for (const kind of player.items) {
      const def = ITEM_DEFS[kind]
      lines.push(sys(`  ${def.name} - ${statSuffix(def)}`))
    }
  }
  return { player, emit: lines }
}

function read(ctx: CommandContext, echo: Emit): CommandResult {
  const here = ctx.inscriptions.filter((i) => i.depth === ctx.player.depth)
  if (here.length === 0) {
    return { player: ctx.player, emit: [echo, sys("nothing carved here.")] }
  }
  const count = here.length
  const header = sys(`${count} mark${count === 1 ? "" : "s"} at depth ${ctx.player.depth}.`)
  const lines = here.map((i): Emit => ({
    style: "story",
    text: `"${i.text}"  - ${i.name} · ${i.written_at.slice(0, 10)}`,
  }))
  return { player: ctx.player, emit: [echo, header, ...lines] }
}

function help(player: PlayerState, echo: Emit): CommandResult {
  return {
    player,
    emit: [
      echo,
      sys("/down - descend one level"),
      sys("/up - ascend one level"),
      sys("/rest - sit and recover stamina"),
      sys("/take - pick up what's here"),
      sys("/drop <item> - leave an item behind"),
      sys("/mark <text> - carve an inscription at this depth"),
      sys("/read - read inscriptions at this depth"),
      sys("/me - character sheet"),
      sys("/quit - save and exit"),
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

// ---- Helpers ----

function splitCommand(trimmed: string): { head: string; arg: string } {
  const space = trimmed.indexOf(" ")
  if (space === -1) return { head: trimmed, arg: "" }
  return { head: trimmed.slice(0, space), arg: trimmed.slice(space + 1).trim() }
}

function composition(bonus: number): string {
  return bonus === 0 ? "(base)" : `(base +${bonus})`
}

const sys = (text: string): Emit => ({ style: "system", text })
const err = (text: string): Emit => ({ style: "error", text })
