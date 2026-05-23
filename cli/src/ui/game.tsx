// Main game shell.
//
// Three regions stacked vertically:
//   - HUD       - name . depth . stamina bar . deepest
//   - Scroll    - append-only line buffer (clipped from the top when long)
//   - Input bar - > prompt, dispatches commands on enter
//
// State lives in a single useReducer (game/reducer.ts). The component
// owns four side effects: persisting the player to save.json on change,
// a 1Hz tick, periodic inscription sync, and graceful exit on /quit.

import { useEffect, useReducer } from "react"
import { useAppContext, useTerminalDimensions } from "@opentui/react"
import { theme } from "./theme.ts"
import { Hud } from "./hud.tsx"
import { LineView } from "./line-view.tsx"
import { InputBar } from "./input-bar.tsx"
import { freshState, reducer, resumeState } from "../game/reducer.ts"
import { runMark } from "../game/mark.ts"
import { loadSave, writeSave } from "../store/save.ts"
import { loadInscriptions, writeInscriptions } from "../store/inscriptions.ts"
import { getInscriptions } from "../api/inscriptions.ts"
import type { Account } from "../store/account.ts"

const TICK_MS = 1_000
const SYNC_INTERVAL_MS = 5 * 60 * 1_000

interface GameProps {
  account: Account
}

export function Game({ account }: GameProps) {
  const [state, dispatch] = useReducer(reducer, account, (acc) => {
    const inscriptions = loadInscriptions()
    const saved = loadSave()
    if (saved && saved.name === acc.name) return resumeState(saved, inscriptions)
    return freshState(acc.name, inscriptions)
  })

  // Persist on every player change. Tiny JSON; sync write is fine.
  useEffect(() => writeSave(state.player), [state.player])

  // 1Hz heartbeat for stamina recovery (and later: spawn rolls, ambient).
  useEffect(() => {
    const id = setInterval(() => dispatch({ kind: "tick", now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Inscription sync: pull at launch, then every 5 min. Silent.
  useEffect(() => {
    let cancelled = false
    async function sync() {
      const result = await getInscriptions()
      if (cancelled || !result.ok) return
      dispatch({ kind: "setInscriptions", list: result.data })
      writeInscriptions(result.data)
    }
    void sync()
    const id = setInterval(() => void sync(), SYNC_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Graceful exit on /quit: flush save, destroy the renderer (restores
  // the terminal), then exit.
  const { renderer } = useAppContext()
  useEffect(() => {
    if (!state.quitting) return
    writeSave(state.player)
    renderer?.destroy()
    process.exit(0)
  }, [state.quitting, state.player, renderer])

  function handleInput(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === "/mark" || trimmed.startsWith("/mark ")) {
      void runMark(account, state.player.depth, trimmed, dispatch)
      return
    }
    dispatch({ kind: "command", raw: trimmed, now: Date.now() })
  }

  const { width, height } = useTerminalDimensions()
  const visible = state.lines.slice(-Math.max(1, height - 4))

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <Hud
        name={state.player.name}
        depth={state.player.depth}
        stamina={state.player.stamina}
        maxStamina={state.player.maxStamina}
        deepest={state.player.deepest}
      />
      <Rule width={width} />
      <box style={{ flexGrow: 1, flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
        {visible.map((line) => <LineView key={line.id} line={line} />)}
      </box>
      <Rule width={width} />
      <InputBar onSubmit={handleInput} />
    </box>
  )
}

function Rule({ width }: { width: number }) {
  return <text fg={theme.rule}>{"─".repeat(Math.max(0, width))}</text>
}
