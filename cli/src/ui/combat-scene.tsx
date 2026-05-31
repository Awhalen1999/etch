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
import type { CombatState } from "../game/types.ts"
import {
  ROUND_CYCLE_MS,
  SWEET_SPOT_HIGH,
  SWEET_SPOT_LOW,
} from "../game/world.ts"
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
//   line 1: the previous round's result, dimmed with a "» " lead-in
//   line 2: blank breathing row
//   line 3: the current telegraph, bright
function MomentPanel({
  telegraph,
  lastResult,
}: {
  telegraph: string
  lastResult: string | null
}) {
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.dim}>{lastResult ? `» ${lastResult}` : " "}</text>
      <text>{" "}</text>
      <text fg={theme.fg}>{telegraph}</text>
    </box>
  )
}

function TimingPanel({ position }: { position: number }) {
  const sweetLow = Math.floor(TIMING_BAR_WIDTH * SWEET_SPOT_LOW)
  const sweetHigh = Math.floor(TIMING_BAR_WIDTH * SWEET_SPOT_HIGH)
  const indicator = Math.min(TIMING_BAR_WIDTH - 1, Math.floor(position * TIMING_BAR_WIDTH))

  return (
    <box style={{ flexDirection: "column" }}>
      <text>
        {Array.from({ length: TIMING_BAR_WIDTH }, (_, i) => {
          if (i === indicator) return <span key={i} fg={theme.fg}>{"█"}</span>
          const inSweet = i >= sweetLow && i <= sweetHigh
          return (
            <span key={i} fg={inSweet ? theme.accent : theme.rule}>
              {inSweet ? "▓" : "░"}
            </span>
          )
        })}
      </text>
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
}

function Spacer() {
  return <text>{" "}</text>
}

// ---- Helpers ----

// Triangular wave 0 -> 1 -> 0 over one ROUND_CYCLE_MS period.
function barPosition(startedAt: number, now: number): number {
  const elapsed = (now - startedAt) % ROUND_CYCLE_MS
  const frac = elapsed / ROUND_CYCLE_MS
  return 1 - Math.abs(2 * frac - 1)
}

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
