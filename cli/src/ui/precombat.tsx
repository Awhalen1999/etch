// Pre-combat bar.
//
// Replaces the InputBar while phase === "pre_combat". Captures raw F/E
// presses (no enter) and renders a draining countdown toward the 15s
// timeout. The reducer owns the timeout (advance via tick); this
// component just animates the visible bar at ~10fps off a local clock.

import { useEffect, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { theme } from "./theme.ts"
import { ENCOUNTER_TIMEOUT_MS } from "../game/world.ts"

interface PreCombatBarProps {
  startedAt: number
  onEngage: () => void
  onEscape: () => void
}

const BAR_WIDTH = 20
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const

export function PreCombatBar({ startedAt, onEngage, onEscape }: PreCombatBarProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [])

  useKeyboard((e) => {
    if (e.repeated) return
    if (e.name === "f") onEngage()
    else if (e.name === "e") onEscape()
  })

  const remaining = Math.max(0, ENCOUNTER_TIMEOUT_MS - (now - startedAt))
  const seconds = Math.ceil(remaining / 1000)
  const ratio = remaining / ENCOUNTER_TIMEOUT_MS

  const eighths = Math.round(ratio * BAR_WIDTH * 8)
  const full = Math.floor(eighths / 8)
  const partial = eighths % 8
  const filled = "█".repeat(full) + (partial > 0 ? EIGHTHS[partial] : "")
  const empty = "░".repeat(BAR_WIDTH - filled.length)
  const fill = ratio < 0.25 ? theme.danger : ratio < 0.5 ? theme.accent : theme.fg

  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
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
