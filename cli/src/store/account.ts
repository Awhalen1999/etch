// ~/.etch/account.json - the player's name and API token.
// Written once on first launch after a successful name claim.

import { readJson, writeJson } from "./json-file.ts"

export interface Account {
  name: string
  token: string
}

export const loadAccount = (): Account | null => readJson<Account>("account.json")
export const saveAccount = (account: Account): void => writeJson("account.json", account)
