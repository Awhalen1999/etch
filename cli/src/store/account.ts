// Local persistence for the player's account.
//
// File: ~/.etch/account.json
// Written once after a successful name claim; read on every launch
// to decide whether to show the register screen.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export interface Account {
  name: string
  token: string
}

const DIR = join(homedir(), ".etch")
const FILE = join(DIR, "account.json")

export function loadAccount(): Account | null {
  if (!existsSync(FILE)) return null
  return JSON.parse(readFileSync(FILE, "utf8")) as Account
}

export function saveAccount(account: Account): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(account, null, 2), "utf8")
}
