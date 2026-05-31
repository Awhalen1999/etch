// Combat scene.
//
// Takes over the screen below the HUD while phase === "in_combat".
// Three stacked panels: enemy (HP), moment (telegraph + last result),
// timing (bouncing bar + key hints).
//
// Bar position is derived from elapsed time, not stored state — a local
// 30fps clock just forces re-renders. The reducer reads the same clock
// when the player presses S/B/E.

import { useEffect, useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { CombatState, ResultSeverity } from "../game/types.ts"
import { SWEET_SPOT_HIGH, SWEET_SPOT_LOW } from "../game/world.ts"
import { barPosition } from "../game/combat.ts"
import { theme } from "./theme.ts"

interface CombatSceneProps {
  combat: CombatState
  onStrike: () => void
  onBrace: () => void
  onEscape: () => void
}

const FRAME_MS = 33
const HP_BAR_WIDTH = 20
const TIMING_BAR_WIDTH = 36
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const

export function CombatScene({ combat, onStrike, onBrace, onEscape }: CombatSceneProps) {
  const now = useTick(FRAME_MS)
  useCombatKeys({ onStrike, onBrace, onEscape })

  const position = barPosition(combat.round.startedAt, now)

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      <EnemyPanel hp={combat.enemyHp} maxHp={combat.enemyMaxHp} />
      <Spacer />
      <MomentPanel telegraph={combat.round.telegraph} lastResult={combat.lastResult} />
      <Spacer />
      <TimingPanel position={position} />
    </box>
  )
}

// ---- Panels ----

function EnemyPanel({ hp, maxHp }: { hp: number; maxHp: number }) {
  const filled = bar(hp / maxHp, HP_BAR_WIDTH)
  return (
    <box style={{ flexDirection: "row" }}>
      <text>
        <span fg={theme.dim}>{"enemy   "}</span>
        <span fg={theme.danger}>{filled.full}</span>
        <span fg={theme.dim}>{filled.empty}</span>
        <span fg={theme.fg}>{`  ${hp}/${maxHp}`}</span>
      </text>
    </box>
  )
}

// Two zones, fixed height so the bar below doesn't shift between rounds:
//   line 1: the previous round's result, color-coded by severity
//   line 2: blank breathing row
//   line 3: the current telegraph, bright
function MomentPanel({
  telegraph,
  lastResult,
}: {
  telegraph: string
  lastResult: { text: string; severity: ResultSeverity } | null
}) {
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={lastResult ? colorForSeverity(lastResult.severity) : theme.dim}>
        {lastResult ? `» ${lastResult.text}` : " "}
      </text>
      <text>{" "}</text>
      <text fg={theme.fg}>{telegraph}</text>
    </box>
  )
}

function colorForSeverity(severity: ResultSeverity): string {
  switch (severity) {
    case "win":     return theme.chat
    case "loss":    return theme.danger
    case "neutral": return theme.dim
  }
}

// A solid colored track with a single bright tick sliding across it.
// The track is dim outside the sweet zone, accent inside. The tick is
// 1 cell wide; when it sits between cells it spans two using partial
// block characters with inverted fg/bg so motion is sub-cell smooth.
function TimingPanel({ position }: { position: number }) {
  const sweetLow = Math.floor(TIMING_BAR_WIDTH * SWEET_SPOT_LOW)
  const sweetHigh = Math.floor(TIMING_BAR_WIDTH * SWEET_SPOT_HIGH)

  // The tick's leading edge in eighths. Tick spans tickCell and tickCell+1
  // when tickFrac > 0; otherwise it sits cleanly inside tickCell.
  const sub = Math.round(position * (TIMING_BAR_WIDTH - 1) * 8)
  const tickCell = Math.floor(sub / 8)
  const tickFrac = sub % 8

  function trackBg(i: number): string {
    return i >= sweetLow && i <= sweetHigh ? theme.accent : theme.dim
  }

  return (
    <box style={{ flexDirection: "column" }}>
      <text>
        {Array.from({ length: TIMING_BAR_WIDTH }, (_, i) => renderCell(i))}
      </text>
      <text>{" "}</text>
      <text>
        <span fg={theme.accent}>{"S"}</span>
        <span fg={theme.dim}>{" strike   "}</span>
        <span fg={theme.accent}>{"B"}</span>
        <span fg={theme.dim}>{" brace   "}</span>
        <span fg={theme.accent}>{"E"}</span>
        <span fg={theme.dim}>{" flee"}</span>
      </text>
    </box>
  )

  function renderCell(i: number) {
    const bg = trackBg(i)

    // Tick lands cleanly inside this cell.
    if (i === tickCell && tickFrac === 0) {
      return <span key={i} fg={theme.fg} bg={bg}>{"█"}</span>
    }
    // Trailing cell of a straddled tick: tick on the right, track on the left.
    // Inverted colors so EIGHTHS[tickFrac] paints fg=track on the left
    // tickFrac/8 and bg=tick on the right (8 - tickFrac)/8.
    if (i === tickCell && tickFrac > 0) {
      return <span key={i} fg={bg} bg={theme.fg}>{EIGHTHS[tickFrac]}</span>
    }
    // Leading cell of a straddled tick: tick on the left, track on the right.
    if (i === tickCell + 1 && tickFrac > 0) {
      return <span key={i} fg={theme.fg} bg={bg}>{EIGHTHS[tickFrac]}</span>
    }
    // Plain track cell.
    return <span key={i} bg={bg}>{" "}</span>
  }
}

function Spacer() {
  return <text>{" "}</text>
}

// ---- Helpers ----

function bar(ratio: number, width: number): { full: string; empty: string } {
  const clamped = Math.max(0, Math.min(1, ratio))
  const eighths = Math.round(clamped * width * 8)
  const full = Math.floor(eighths / 8)
  const partial = eighths % 8
  const filled = "█".repeat(full) + (partial > 0 ? EIGHTHS[partial] : "")
  return { full: filled, empty: "░".repeat(width - filled.length) }
}

function useTick(intervalMs: number): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function useCombatKeys({
  onStrike,
  onBrace,
  onEscape,
}: {
  onStrike: () => void
  onBrace: () => void
  onEscape: () => void
}) {
  useKeyboard((e) => {
    if (e.repeated) return
    if (e.name === "s") onStrike()
    else if (e.name === "b") onBrace()
    else if (e.name === "e") onEscape()
  })
}
