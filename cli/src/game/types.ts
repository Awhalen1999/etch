// Game state shapes shared across reducer, commands, and UI.

export type LineStyle = "system" | "story" | "echo" | "ambient" | "error"

export interface Line {
  id: number
  style: LineStyle
  text: string
}

export type ItemRarity = "common" | "uncommon" | "rare" | "very_rare"
export type ItemCategory = "attack" | "defense" | "stamina"

export type ItemKind =
  | "wooden_stick" | "bent_nail" | "rock_shard"
  | "rusted_hammer" | "broken_crowbar"
  | "pickaxe" | "saw_blade" | "jagged_shard" | "mandible"
  | "obsidian_shard" | "queens_tooth"
  | "hard_hat" | "leather_scraps" | "thick_gloves"
  | "miners_vest" | "shoulder_guard"
  | "plate_fragment" | "carapace_shard"
  | "chitin_plate" | "rib_cage"
  | "dried_meat" | "water_pouch"
  | "mystery_bottle" | "pouch_of_pills"
  | "mre_kit" | "mutant_frog"
  | "preserved_heart" | "queens_nectar"

export interface PlayerState {
  name: string
  depth: number
  stamina: number
  maxStamina: number
  deepest: number
  resting: boolean
  /** Epoch ms of the last successful /down or /up. Used for cooldown. */
  lastMoveAt: number
  items: ItemKind[]
  /** What's available to /take at the current depth. Cleared on move. */
  currentDepthItem: ItemKind | null
}

export interface Inscription {
  id: number
  name: string
  depth: number
  text: string
  written_at: string
}

export interface Emit {
  style: LineStyle
  text: string
}

export interface GameState {
  player: PlayerState
  lines: Line[]
  nextLineId: number
  inscriptions: Inscription[]
  /** Set true when the player runs /quit - index.tsx watches and exits. */
  quitting: boolean
}

export type GameAction =
  | { kind: "command"; raw: string; now: number }
  | { kind: "tick"; now: number }
  | { kind: "emit"; lines: Emit[] }
  | { kind: "setInscriptions"; list: Inscription[] }
