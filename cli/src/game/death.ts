// Death side effect.
//
// The reducer flips `pendingDeath` when the player dies. The Game shell
// watches that field and calls runDeath, which posts a permanent
// death-marker inscription via the API and dispatches `respawn` once the
// remote write resolves. Mirrors the runMark pattern.

import type { Dispatch } from "react"
import type { Account } from "../store/account.ts"
import type { Emit, GameAction, PlayerState } from "./types.ts"
import { postInscription } from "../api/inscriptions.ts"
import { writeInscriptions } from "../store/inscriptions.ts"
import { resetPlayer } from "./reducer.ts"

export async function runDeath(
  account: Account,
  deathDepth: number,
  player: PlayerState,
  dispatch: Dispatch<GameAction>,
): Promise<void> {
  const text = `${account.name} fell here.`

  const result = await postInscription(account.name, account.token, deathDepth, text)
  if (result.ok) {
    dispatch({ kind: "setInscriptions", list: result.data })
    writeInscriptions(result.data)
  } else {
    // Soft failure: the player still respawns, the marker just didn't
    // make it remote. Surface a quiet system note rather than blocking.
    const err: Emit = { style: "error", text: "(death marker failed to carve)" }
    dispatch({ kind: "emit", lines: [err] })
  }

  dispatch({ kind: "respawn", player: resetPlayer(account.name, player), now: Date.now() })
}
