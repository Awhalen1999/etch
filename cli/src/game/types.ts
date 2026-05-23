// Game state shapes shared across reducer, commands, and UI.

export type LineStyle = "system" | "story" | "echo" | "ambient" | "error"

export interface Line {
  id: number
  style: LineStyle
  text: string
}

export interface PlayerState {
  name: string
  depth: number
  stamina: number
  maxStamina: number
  deepest: number
  resting: boolean
  /** Epoch ms of the last successful /down or /up. Used for cooldown. */
  lastMoveAt: number
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
  /** Set true when the player runs /quit — index.tsx watches and exits. */
  quitting: boolean
}

export type GameAction =
  | { kind: "command"; raw: string; now: number }
  | { kind: "tick"; now: number }
  | { kind: "emit"; lines: Emit[] }
  | { kind: "setInscriptions"; list: Inscription[] }
