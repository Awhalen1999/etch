// Game state shapes shared across reducer, commands, and UI.

// Visual style for a line in the scroll or a cutscene.
//   - system:  mechanical info (depth changes, system hints)
//   - story:   world prose / narration
//   - echo:    command echoes the player typed
//   - ambient: passive atmospheric lines
//   - error:   refusals + failures
//   - dialog:  another character's spoken lines (e.g. Horris)
//   - thought: the player's own inner monologue
//   - pause:   a "..." beat in a cutscene
export type LineStyle =
  | "system" | "story" | "echo" | "ambient" | "error"
  | "dialog" | "thought" | "pause"

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
  /** Has the one-time ant cutscene played? Sticks after the first encounter. */
  seenFirstEncounter: boolean
  /** Has the new-account opening cutscene played? Set on first launch. */
  seenOpening: boolean
  /** Has the player ever reached the queen's chamber? Gates the long approach cutscene. */
  seenQueenApproach: boolean
  /** Has the queen been killed? Sticks across death — the game has one ending. */
  queenKilled: boolean
}

export type EnemyKind = "ant" | "queen"

export type Phase = "explore" | "pre_combat" | "in_combat"

export interface EncounterState {
  enemy: EnemyKind
  /** Epoch ms when the encounter began. Used to compute the 15s timeout. */
  startedAt: number
}

export type EnemyIntent = "attack" | "open"

// One round of combat. The intent is committed at round start; the
// telegraph is the prose the player reads. If the telegraph came from
// the ambiguous pool, the player can't infer intent.
export interface CombatRound {
  intent: EnemyIntent
  telegraph: string
  /** Atmospheric flavor shown between last result and telegraph. */
  ambient: string
  /** Epoch ms when the round began. Drives the bouncing timing bar. */
  startedAt: number
}

// What kind of result the previous round produced. Drives the color
// of the "» ..." line in the moment panel so the player feels hits.
export type ResultSeverity = "win" | "loss" | "neutral"

export interface CombatState {
  enemy: EnemyKind
  enemyMaxHp: number
  enemyHp: number
  round: CombatRound
  /** Result of the previous press, or null if no round has resolved yet. */
  lastResult: { text: string; severity: ResultSeverity } | null
}

// A queue of lines emitted one beat at a time into the main scroll.
// While a cutscene is in flight the player can't act, but the layout
// doesn't change — narration plays inline as part of the world. The
// footer swaps from InputBar to a dim "..." indicator while lines drip
// out. When `remaining` empties, `onDone` fires.
export interface Cutscene {
  remaining: Emit[]
  /** Epoch ms when the next line is due. */
  nextAt: number
  onDone: CutsceneDone
}

export type CutsceneDone =
  | { kind: "none" }
  | { kind: "encounter"; enemy: EnemyKind }
  | { kind: "queenVictory" }

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
  phase: Phase
  encounter: EncounterState | null
  /** Epoch ms of the last encounter roll. Throttles tick rolls to 5s. */
  lastEncounterRollAt: number
  /** Active cutscene, or null when no script is playing. */
  cutscene: Cutscene | null
  /** Epoch ms of the last ambient line. Resets after cutscenes and respawns. */
  lastAmbientAt: number
  /** Active combat state when phase === "in_combat", otherwise null. */
  combat: CombatState | null
  /**
   * Set when the player dies. UI watches this, carves the death-marker
   * inscription via the API, then dispatches `respawn` to clear it.
   * `thenQuit` is set when the death came from a force-quit — after the
   * marker is carved the renderer is destroyed and the process exits.
   */
  pendingDeath: { depth: number; thenQuit: boolean } | null
}

export type GameAction =
  | { kind: "command"; raw: string; now: number }
  | { kind: "tick"; now: number }
  | { kind: "emit"; lines: Emit[] }
  | { kind: "setInscriptions"; list: Inscription[] }
  | { kind: "engage"; now: number }
  | { kind: "escape"; now: number }
  | { kind: "strike"; now: number }
  | { kind: "brace"; now: number }
  | { kind: "forceQuit"; now: number }
  | { kind: "respawn"; player: PlayerState; now: number }
