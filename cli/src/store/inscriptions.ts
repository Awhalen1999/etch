// ~/.etch/inscriptions.json — local cache of the shared wall layer.
//
// Read on launch so /read works offline; refreshed silently from the API
// after launch and every five minutes thereafter. On corrupt or missing
// file we just start from an empty list — the next sync will replace it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Inscription } from "../game/types.ts"

const DIR = join(homedir(), ".etch")
const FILE = join(DIR, "inscriptions.json")

export function loadInscriptions(): Inscription[] {
  if (!existsSync(FILE)) return []
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Inscription[]
  } catch {
    return []
  }
}

export function writeInscriptions(list: Inscription[]): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(list, null, 2), "utf8")
}
