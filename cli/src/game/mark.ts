// /mark <text> - the one network-bound command.
//
// The reducer is sync; this lives outside of it. The UI calls runMark
// directly, which validates locally, POSTs to the API, and pushes line
// updates back through dispatch.

import type { Dispatch } from "react"
import type { Account } from "../store/account.ts"
import type { Emit, GameAction } from "./types.ts"
import { postInscription } from "../api/inscriptions.ts"
import { writeInscriptions } from "../store/inscriptions.ts"

const MARK_MAX_LENGTH = 240

export async function runMark(
  account: Account,
  depth: number,
  trimmed: string,
  dispatch: Dispatch<GameAction>,
): Promise<void> {
  const text = trimmed.slice("/mark".length).trim()
  const echo: Emit = { style: "echo", text: trimmed }

  if (text.length === 0) {
    dispatch({ kind: "emit", lines: [echo, err("carve what?")] })
    return
  }
  if (text.length > MARK_MAX_LENGTH) {
    dispatch({
      kind: "emit",
      lines: [echo, err(`too much to carve. ${MARK_MAX_LENGTH} characters max.`)],
    })
    return
  }

  dispatch({ kind: "emit", lines: [echo, sys("carving...")] })

  const result = await postInscription(account.name, account.token, depth, text)
  if (!result.ok) {
    dispatch({ kind: "emit", lines: [err(result.error)] })
    return
  }

  dispatch({ kind: "setInscriptions", list: result.data })
  writeInscriptions(result.data)
  dispatch({ kind: "emit", lines: [sys("carved.")] })
}

const sys = (text: string): Emit => ({ style: "system", text })
const err = (text: string): Emit => ({ style: "error", text })
