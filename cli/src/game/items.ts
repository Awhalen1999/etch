// Item catalog + spawn logic.
//
// Items are scavenged on every successful move (25% per move). Pool weights
// vary by band: shallower depths drop common gear, deeper depths drop the
// rarer biological stuff scraped off the dead.
//
// All passive while held; stats stack additively. Dropping destroys -
// there is no ground state.

import type { ItemKind, ItemRarity, ItemCategory, PlayerState } from "./types.ts"
import { BASE_MAX_STAMINA } from "./world.ts"

export interface ItemDef {
  kind: ItemKind
  name: string
  rarity: ItemRarity
  category: ItemCategory
  value: number
}

export const ITEM_DEFS: Record<ItemKind, ItemDef> = {
  // ---- Attack (+ damage per strike) ----
  wooden_stick:    { kind: "wooden_stick",    name: "wooden stick",    rarity: "common",    category: "attack",  value: 10 },
  bent_nail:       { kind: "bent_nail",       name: "bent nail",       rarity: "common",    category: "attack",  value: 10 },
  rock_shard:      { kind: "rock_shard",      name: "rock shard",      rarity: "common",    category: "attack",  value: 10 },
  rusted_hammer:   { kind: "rusted_hammer",   name: "rusted hammer",   rarity: "uncommon",  category: "attack",  value: 15 },
  broken_crowbar:  { kind: "broken_crowbar",  name: "broken crowbar",  rarity: "uncommon",  category: "attack",  value: 15 },
  pickaxe:         { kind: "pickaxe",         name: "pickaxe",         rarity: "rare",      category: "attack",  value: 20 },
  saw_blade:       { kind: "saw_blade",       name: "saw blade",       rarity: "rare",      category: "attack",  value: 20 },
  jagged_shard:    { kind: "jagged_shard",    name: "jagged shard",    rarity: "rare",      category: "attack",  value: 25 },
  mandible:        { kind: "mandible",        name: "mandible",        rarity: "rare",      category: "attack",  value: 25 },
  obsidian_shard:  { kind: "obsidian_shard",  name: "obsidian shard",  rarity: "very_rare", category: "attack",  value: 30 },
  queens_tooth:    { kind: "queens_tooth",    name: "queen's tooth",   rarity: "very_rare", category: "attack",  value: 35 },

  // ---- Defense (- stamina cost on wrong call) ----
  hard_hat:        { kind: "hard_hat",        name: "hard hat",        rarity: "common",    category: "defense", value: 2 },
  leather_scraps:  { kind: "leather_scraps",  name: "leather scraps",  rarity: "common",    category: "defense", value: 2 },
  thick_gloves:    { kind: "thick_gloves",    name: "thick gloves",    rarity: "common",    category: "defense", value: 2 },
  miners_vest:     { kind: "miners_vest",     name: "miner's vest",    rarity: "uncommon",  category: "defense", value: 3 },
  shoulder_guard:  { kind: "shoulder_guard",  name: "shoulder guard",  rarity: "uncommon",  category: "defense", value: 3 },
  plate_fragment:  { kind: "plate_fragment",  name: "plate fragment",  rarity: "rare",      category: "defense", value: 5 },
  carapace_shard:  { kind: "carapace_shard",  name: "carapace shard",  rarity: "rare",      category: "defense", value: 5 },
  chitin_plate:    { kind: "chitin_plate",    name: "chitin plate",    rarity: "very_rare", category: "defense", value: 7 },
  rib_cage:        { kind: "rib_cage",        name: "rib cage",        rarity: "very_rare", category: "defense", value: 7 },

  // ---- Stamina (+ max stamina while held) ----
  dried_meat:      { kind: "dried_meat",      name: "strip of dried meat", rarity: "common",    category: "stamina", value: 5 },
  water_pouch:     { kind: "water_pouch",     name: "water pouch",         rarity: "common",    category: "stamina", value: 5 },
  mystery_bottle:  { kind: "mystery_bottle",  name: "mystery bottle",      rarity: "uncommon",  category: "stamina", value: 10 },
  pouch_of_pills:  { kind: "pouch_of_pills",  name: "pouch of pills",      rarity: "uncommon",  category: "stamina", value: 10 },
  mre_kit:         { kind: "mre_kit",         name: "mre kit",             rarity: "rare",      category: "stamina", value: 15 },
  mutant_frog:     { kind: "mutant_frog",     name: "mutant frog",         rarity: "rare",      category: "stamina", value: 20 },
  preserved_heart: { kind: "preserved_heart", name: "preserved heart",     rarity: "very_rare", category: "stamina", value: 25 },
  queens_nectar:   { kind: "queens_nectar",   name: "queen's nectar",      rarity: "very_rare", category: "stamina", value: 30 },
}

export const INVENTORY_MAX = 5
export const SPAWN_CHANCE = 0.25
export const BASE_ATTACK = 50
export const BASE_DEFENSE = 0

// ---- Spawn pools ----

interface PoolEntry {
  rarity: ItemRarity
  weight: number
}

function poolForDepth(depth: number): PoolEntry[] {
  if (depth <= 40) return [{ rarity: "common", weight: 1 }]
  if (depth <= 120) return [{ rarity: "common", weight: 3 }, { rarity: "uncommon", weight: 1 }]
  if (depth <= 160) return [{ rarity: "common", weight: 5 }, { rarity: "uncommon", weight: 3 }, { rarity: "rare", weight: 1 }]
  return [{ rarity: "uncommon", weight: 3 }, { rarity: "rare", weight: 2 }, { rarity: "very_rare", weight: 1 }]
}

// Cache the kinds per rarity once at module load.
const KINDS_BY_RARITY: Record<ItemRarity, ItemKind[]> = {
  common: [],
  uncommon: [],
  rare: [],
  very_rare: [],
}
for (const def of Object.values(ITEM_DEFS)) {
  KINDS_BY_RARITY[def.rarity].push(def.kind)
}

export function rollSpawn(depth: number): ItemKind | null {
  if (Math.random() >= SPAWN_CHANCE) return null
  const pool = poolForDepth(depth)
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0)
  let pick = Math.random() * totalWeight
  let rarity: ItemRarity = pool[0]!.rarity
  for (const p of pool) {
    pick -= p.weight
    if (pick < 0) {
      rarity = p.rarity
      break
    }
  }
  const candidates = KINDS_BY_RARITY[rarity]
  return candidates[Math.floor(Math.random() * candidates.length)]!
}

// ---- Inventory helpers (pure) ----

export function maxStaminaFor(items: ItemKind[]): number {
  return BASE_MAX_STAMINA + bonusFor(items, "stamina")
}

export function attackPowerFor(items: ItemKind[]): number {
  return BASE_ATTACK + bonusFor(items, "attack")
}

export function defensePowerFor(items: ItemKind[]): number {
  return BASE_DEFENSE + bonusFor(items, "defense")
}

function bonusFor(items: ItemKind[], category: ItemCategory): number {
  let total = 0
  for (const kind of items) {
    const def = ITEM_DEFS[kind]
    if (def.category === category) total += def.value
  }
  return total
}

export function withItemAdded(player: PlayerState, kind: ItemKind): PlayerState {
  const items = [...player.items, kind]
  return {
    ...player,
    items,
    maxStamina: maxStaminaFor(items),
    currentDepthItem: null,
  }
}

export function withItemRemoved(player: PlayerState, index: number): PlayerState {
  const items = [...player.items.slice(0, index), ...player.items.slice(index + 1)]
  const newMax = maxStaminaFor(items)
  return {
    ...player,
    items,
    maxStamina: newMax,
    stamina: Math.min(player.stamina, newMax),
  }
}

// ---- Display helpers ----

export function statSuffix(def: ItemDef): string {
  switch (def.category) {
    case "attack":  return `+${def.value} atk`
    case "defense": return `+${def.value} def`
    case "stamina": return `+${def.value} max`
  }
}

// ---- Arrival flavor ----
//
// Reveal both the name and the stat so the player can decide whether the
// stamina cost of /take + the inventory slot is worth it. Each variant
// keeps the etch tone (observational, lowercase, no exclamation).

const ARRIVAL_TEMPLATES: Array<(name: string, stat: string) => string> = [
  (name, stat) => `a ${name} here - ${stat}.`,
  (name, stat) => `your light finds a ${name} - ${stat}.`,
  (name, stat) => `something half-buried: a ${name} - ${stat}.`,
]

export function arrivalLine(kind: ItemKind): string {
  const def = ITEM_DEFS[kind]
  const template = ARRIVAL_TEMPLATES[Math.floor(Math.random() * ARRIVAL_TEMPLATES.length)]!
  return template(def.name, statSuffix(def))
}
