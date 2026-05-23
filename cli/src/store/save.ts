// ~/.etch/save.json — the player's persistent run state.
//
// Inscriptions and account identity live elsewhere (remote API and
// account.json). This file is everything else: depth, stamina, deepest,
// inventory (later), queen flag (later), and the band-crossings derived
// from deepest.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { PlayerState } from "../game/types.ts"

const DIR = join(homedir(), ".etch")
const FILE = join(DIR, "save.json")

export function loadSave(): PlayerState | null {
  if (!existsSync(FILE)) return null
  return JSON.parse(readFileSync(FILE, "utf8")) as PlayerState
}

export function writeSave(player: PlayerState): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(player, null, 2), "utf8")
}
