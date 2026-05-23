// Main game shell.
//
// Three regions stacked vertically:
//   - HUD       — name · depth · stamina bar · deepest
//   - Scroll    — append-only line buffer (clipped from the top when long)
//   - Input bar — > prompt, dispatches commands on enter
//
// State lives in a single useReducer (game/reducer.ts). The component
// owns three side effects: persisting the player to save.json on change,
// a 1Hz tick, and graceful exit on /quit.

import { useEffect, useReducer, useState } from "react"
import { useAppContext, useTerminalDimensions } from "@opentui/react"
import { theme } from "./theme.ts"
import { StaminaBar } from "./stamina-bar.tsx"
import { freshState, reducer, resumeState } from "../game/reducer.ts"
import { loadSave, writeSave } from "../store/save.ts"
import { loadInscriptions, writeInscriptions } from "../store/inscriptions.ts"
import { getInscriptions, postInscription } from "../api/inscriptions.ts"
import type { Account } from "../store/account.ts"
import type { Emit, Line, LineStyle } from "../game/types.ts"

const MARK_MAX_LENGTH = 240
const SYNC_INTERVAL_MS = 5 * 60 * 1000

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

  useEffect(() => {
    writeSave(state.player)
  }, [state.player])

  useEffect(() => {
    const id = setInterval(() => dispatch({ kind: "tick", now: Date.now() }), 1000)
    return () => clearInterval(id)
  }, [])

  // Inscription sync: pull at launch, then every 5 min. Silent — only the
  // arrival of new inscriptions is observable via /read.
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

  const { renderer } = useAppContext()
  useEffect(() => {
    if (!state.quitting) return
    writeSave(state.player)
    renderer?.destroy()
    process.exit(0)
  }, [state.quitting, state.player, renderer])

  async function handleInput(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === "/mark" || trimmed.startsWith("/mark ")) {
      await handleMark(trimmed)
      return
    }
    dispatch({ kind: "command", raw: trimmed, now: Date.now() })
  }

  async function handleMark(trimmed: string) {
    const text = trimmed.slice("/mark".length).trim()
    const echo: Emit = { style: "echo", text: trimmed }

    if (text.length === 0) {
      dispatch({ kind: "emit", lines: [echo, { style: "error", text: "carve what?" }] })
      return
    }
    if (text.length > MARK_MAX_LENGTH) {
      dispatch({
        kind: "emit",
        lines: [echo, { style: "error", text: `too much to carve. ${MARK_MAX_LENGTH} characters max.` }],
      })
      return
    }

    dispatch({ kind: "emit", lines: [echo, { style: "system", text: "carving..." }] })

    const result = await postInscription(account.name, account.token, state.player.depth, text)
    if (!result.ok) {
      dispatch({ kind: "emit", lines: [{ style: "error", text: result.error }] })
      return
    }

    dispatch({ kind: "setInscriptions", list: result.data })
    writeInscriptions(result.data)
    dispatch({ kind: "emit", lines: [{ style: "system", text: "carved." }] })
  }

  const { width, height } = useTerminalDimensions()
  const scrollHeight = Math.max(1, height - 4)
  const visible = state.lines.slice(-scrollHeight)

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
      <InputBar onSubmit={(raw) => void handleInput(raw)} />
    </box>
  )
}

// ---- HUD ----

interface HudProps {
  name: string
  depth: number
  stamina: number
  maxStamina: number
  deepest: number
}

function Hud({ name, depth, stamina, maxStamina, deepest }: HudProps) {
  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
      <text>
        <span fg={theme.accent}>{name}</span>
        <Sep />
        <span fg={theme.dim}>depth </span>
        <span fg={theme.fg}>{String(depth)}</span>
        <Sep />
        <span fg={theme.dim}>stamina </span>
      </text>
      <StaminaBar value={stamina} max={maxStamina} />
      <text>
        <span fg={theme.fg}>{` ${stamina}/${maxStamina}`}</span>
        <Sep />
        <span fg={theme.dim}>deepest </span>
        <span fg={theme.fg}>{String(deepest)}</span>
      </text>
    </box>
  )
}

function Sep() {
  return <span fg={theme.rule}>{"  ·  "}</span>
}

// ---- Scroll line ----

function LineView({ line }: { line: Line }) {
  const color = colorFor(line.style)
  const text = line.style === "echo" ? `> ${line.text}` : line.text
  return <text fg={color}>{text}</text>
}

function colorFor(style: LineStyle): string {
  switch (style) {
    case "system": return theme.dim
    case "echo": return theme.accent
    case "story": return theme.fg
    case "ambient": return theme.dim
    case "error": return theme.danger
  }
}

// ---- Rule ----

function Rule({ width }: { width: number }) {
  return <text fg={theme.rule}>{"─".repeat(Math.max(0, width))}</text>
}

// ---- Input bar ----

function InputBar({ onSubmit }: { onSubmit: (raw: string) => void }) {
  // The <input> is uncontrolled (OpenTUI manages its value). To clear it
  // after each submit we bump a key so React re-mounts the element.
  const [resetKey, setResetKey] = useState(0)

  // See ui/register.tsx for the SubmitEvent/string intersection workaround.
  const handle = (arg: unknown) => {
    if (typeof arg !== "string") return
    onSubmit(arg)
    setResetKey((k) => k + 1)
  }

  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
      <text fg={theme.dim}>{"> "}</text>
      <input
        key={resetKey}
        focused
        onSubmit={handle}
        style={{
          flexGrow: 1,
          textColor: theme.fg,
          focusedTextColor: theme.fg,
          placeholderColor: theme.dim,
        }}
      />
    </box>
  )
}
