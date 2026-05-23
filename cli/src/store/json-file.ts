// JSON file plumbing for ~/.etch/.
//
// Every store-* file picks a filename and a type; this module owns the
// fs ceremony and the corrupt-file fallback. Keeping it in one place
// means each store stays a 10-line "what's the type, what's the name"
// declaration.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const DIR = join(homedir(), ".etch")

export function readJson<T>(name: string): T | null {
  const file = join(DIR, name)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch {
    return null
  }
}

export function writeJson(name: string, data: unknown): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, name), JSON.stringify(data, null, 2), "utf8")
}
