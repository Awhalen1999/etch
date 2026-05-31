// ~/.etch/combat-lock.json — cross-session anti-cheese.
//
// Written when the player enters pre-combat or in-combat, cleared on
// any exit (win, escape, in-app death). If the lock survives across
// sessions (force-kill, terminal closed, machine crash) the next launch
// surfaces death recovery so the player can't bypass the penalty.

import { clearJson, readJson, writeJson } from "./json-file.ts"

interface CombatLock {
  name: string
  depth: number
}

const FILE = "combat-lock.json"

export const readCombatLock  = (): CombatLock | null => readJson<CombatLock>(FILE)
export const writeCombatLock = (lock: CombatLock): void => writeJson(FILE, lock)
export const clearCombatLock = (): void => clearJson(FILE)
