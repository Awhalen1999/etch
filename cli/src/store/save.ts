// ~/.etch/save.json - the player's persistent run state.
//
// Inscriptions and account identity live elsewhere (remote API and
// account.json). This file is everything else: depth, stamina, deepest,
// inventory, queen flag (later), etc.

import { readJson, writeJson } from "./json-file.ts"
import type { PlayerState } from "../game/types.ts"

export const loadSave = (): PlayerState | null => readJson<PlayerState>("save.json")
export const writeSave = (player: PlayerState): void => writeJson("save.json", player)
