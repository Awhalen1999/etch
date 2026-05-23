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
import type { Account } from "../store/account.ts"
import type { Line, LineStyle } from "../game/types.ts"

interface GameProps {
  account: Account
}

export function Game({ account }: GameProps) {
  const [state, dispatch] = useReducer(reducer, account, (acc) => {
    const saved = loadSave()
    if (saved && saved.name === acc.name) return resumeState(saved)
    return freshState(acc.name)
  })

  useEffect(() => {
    writeSave(state.player)
  }, [state.player])

  useEffect(() => {
    const id = setInterval(() => dispatch({ kind: "tick", now: Date.now() }), 1000)
    return () => clearInterval(id)
  }, [])

  const { renderer } = useAppContext()
  useEffect(() => {
    if (!state.quitting) return
    writeSave(state.player)
    renderer?.destroy()
    process.exit(0)
  }, [state.quitting, state.player, renderer])

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
      <InputBar
        onSubmit={(raw) => dispatch({ kind: "command", raw, now: Date.now() })}
      />
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
