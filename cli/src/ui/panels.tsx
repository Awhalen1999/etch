// Reusable UI panels shared across layouts.
//
//   Hud           - persistent top status line
//   Rule          - horizontal divider
//   Scroll        - the line buffer view
//   InputBar      - the > prompt that dispatches commands
//   PreCombatBar  - F/E keys + 15s countdown during encounter pre-combat
//
// Every panel sets flexShrink: 0 so the body never squeezes it off-screen.

import { useEffect, useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { Line, PlayerState } from "../game/types.ts"
import { ENCOUNTER_TIMEOUT_MS } from "../game/world.ts"
import { LineView } from "./line-view.tsx"
import { StaminaBar } from "./stamina-bar.tsx"
import { theme } from "./theme.ts"

const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const

// ---- Hud ----------------------------------------------------------------

export function Hud({ player }: { player: PlayerState }) {
  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
      <text>
        <span fg={theme.accent}>{player.name}</span>
        <Sep />
        <span fg={theme.dim}>depth </span>
        <span fg={theme.fg}>{String(player.depth)}</span>
        <Sep />
        <span fg={theme.dim}>stamina </span>
      </text>
      <StaminaBar value={player.stamina} max={player.maxStamina} />
      <text>
        <span fg={theme.fg}>{` ${player.stamina}/${player.maxStamina}`}</span>
        <Sep />
        <span fg={theme.dim}>deepest </span>
        <span fg={theme.fg}>{String(player.deepest)}</span>
      </text>
    </box>
  )
}

function Sep() {
  return <span fg={theme.rule}>{"  ·  "}</span>
}

// ---- Rule ---------------------------------------------------------------

export function Rule({ width }: { width: number }) {
  return <text fg={theme.rule} style={{ flexShrink: 0 }}>{"─".repeat(Math.max(0, width))}</text>
}

// ---- Scroll -------------------------------------------------------------

// Clips the line buffer to the most recent `visibleCount` items and
// anchors them to the bottom of the available space — newest line
// always sits just above the rule + footer, like a terminal scroll.
export function Scroll({ lines, visibleCount }: { lines: Line[]; visibleCount: number }) {
  const visible = lines.slice(-visibleCount)
  return (
    <box style={{
      flexGrow: 1, flexShrink: 1, flexDirection: "column",
      justifyContent: "flex-end",
      paddingLeft: 1, paddingRight: 1, overflow: "hidden",
    }}>
      {visible.map((line) => <LineView key={line.id} line={line} />)}
    </box>
  )
}

// ---- NarrationIndicator -------------------------------------------------
//
// Sits in the footer slot during a cutscene so input is visibly disabled
// but the row height matches the InputBar — no layout jump when narration
// starts or ends.

export function NarrationIndicator() {
  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
      <text fg={theme.dim}>{"..."}</text>
    </box>
  )
}

// ---- InputBar -----------------------------------------------------------

export function InputBar({ onSubmit }: { onSubmit: (raw: string) => void }) {
  const [resetKey, setResetKey] = useState(0)
  const handle = (arg: unknown) => {
    if (typeof arg !== "string") return
    onSubmit(arg)
    setResetKey((k) => k + 1)
  }
  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
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

// ---- PreCombatBar -------------------------------------------------------

const PRECOMBAT_BAR_WIDTH = 20

export function PreCombatBar({
  startedAt, onEngage, onEscape,
}: {
  startedAt: number
  onEngage: () => void
  onEscape: () => void
}) {
  const now = useNow(100)
  useKeyboard((e) => {
    if (e.repeated) return
    if (e.name === "f") onEngage()
    else if (e.name === "e") onEscape()
  })

  const remaining = Math.max(0, ENCOUNTER_TIMEOUT_MS - (now - startedAt))
  const seconds = Math.ceil(remaining / 1000)
  const ratio = remaining / ENCOUNTER_TIMEOUT_MS

  const { filled, empty } = leftAlignedFill(ratio, PRECOMBAT_BAR_WIDTH)
  const fill = ratio < 0.25 ? theme.danger : ratio < 0.5 ? theme.accent : theme.fg

  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
      <text>
        <span fg={theme.accent}>F</span>
        <span fg={theme.dim}> fight  </span>
        <span fg={theme.accent}>E</span>
        <span fg={theme.dim}> escape  </span>
        <span fg={fill}>{filled}</span>
        <span fg={theme.dim}>{empty}</span>
        <span fg={theme.fg}>{` ${seconds}s`}</span>
      </text>
    </box>
  )
}

// ---- Local helpers ------------------------------------------------------

// A small bar with sub-cell precision, anchored to the left edge.
// Used for any "growing/draining" bar that doesn't need a moving tick.
function leftAlignedFill(ratio: number, width: number): { filled: string; empty: string } {
  const clamped = Math.max(0, Math.min(1, ratio))
  const eighths = Math.round(clamped * width * 8)
  const full = Math.floor(eighths / 8)
  const partial = eighths % 8
  const filled = "█".repeat(full) + (partial > 0 ? EIGHTHS[partial] : "")
  return { filled, empty: "░".repeat(width - filled.length) }
}

// Re-render trigger driven by a local clock. Returns the latest `now`.
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
