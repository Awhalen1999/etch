// ~/.etch/inscriptions.json - local cache of the shared wall layer.
//
// Read on launch so /read works offline; refreshed silently from the
// API every five minutes. On corrupt or missing file we start from an
// empty list - the next sync will replace it.

import { readJson, writeJson } from "./json-file.ts"
import type { Inscription } from "../game/types.ts"

export const loadInscriptions = (): Inscription[] => readJson<Inscription[]>("inscriptions.json") ?? []
export const writeInscriptions = (list: Inscription[]): void => writeJson("inscriptions.json", list)
