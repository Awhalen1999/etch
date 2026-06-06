// Combat-only panels. CombatLayout stacks these three with rules between:
//
//   EnemyPanel   - the name and HP bar (ascii art lands here later)
//   MomentPanel  - last round's result (dim) + the current telegraph
//   TimingPanel  - the bouncing tick bar + key hints; owns S/B/E input
//
// Bar position math lives in game/combat.ts (one source of truth shared
// with the press resolver in the reducer).

import { useEffect, useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { CombatState, ResultSeverity } from "../game/types.ts"
import { SWEET_SPOT_HIGH, SWEET_SPOT_LOW } from "../game/world.ts"
import { barPosition } from "../game/combat.ts"
import { ENEMY_DEFS } from "../game/encounter.ts"
import { theme } from "./theme.ts"

const HP_BAR_WIDTH = 24
const TIMING_BAR_WIDTH = 40
// 60fps polling so the rendered tick stays close to the true bar
// position — at 30fps the gap can be over a cell at peak bar speed,
// which reads as input lag when pressing near the sweet-spot edges.
const FRAME_MS = 16
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const

// ---- EnemyPanel ---------------------------------------------------------

export function EnemyPanel({
  enemy, hp, maxHp,
}: {
  enemy: CombatState["enemy"]
  hp: number
  maxHp: number
}) {
  const def = ENEMY_DEFS[enemy]
  const { filled, empty } = leftAlignedFill(hp / maxHp, HP_BAR_WIDTH)
  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
      <text>
        <span fg={theme.dim}>{def.name}</span>
        <span fg={theme.dim}>{"   "}</span>
        <span fg={theme.danger}>{filled}</span>
        <span fg={theme.dim}>{empty}</span>
        <span fg={theme.fg}>{`  ${hp}/${maxHp}`}</span>
      </text>
    </box>
  )
}

// ---- MomentPanel --------------------------------------------------------
//
// Three fixed rows so the bar below doesn't bob between rounds:
//   row 1: previous round's result, color-coded by severity
//   row 2: blank breath
//   row 3: the current telegraph, bright
export function MomentPanel({
  telegraph, lastResult,
}: {
  telegraph: string
  lastResult: { text: string; severity: ResultSeverity } | null
}) {
  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
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

// ---- TimingPanel --------------------------------------------------------
//
// A solid colored track with a single bright tick sliding across it.
// The track is dim outside the sweet zone, accent inside. The tick is
// 1 cell wide; when it sits between cells it spans two using partial
// block characters with inverted fg/bg so motion is sub-cell smooth.
export function TimingPanel({
  round, onStrike, onBrace, onEscape,
}: {
  round: CombatState["round"]
  onStrike: () => void
  onBrace: () => void
  onEscape: () => void
}) {
  const now = useNow(FRAME_MS)
  useKeyboard((e) => {
    if (e.repeated) return
    if      (e.name === "s") onStrike()
    else if (e.name === "b") onBrace()
    else if (e.name === "e") onEscape()
  })

  const position = barPosition(round.startedAt, now)
  const sweetLow  = Math.floor(TIMING_BAR_WIDTH * SWEET_SPOT_LOW)
  const sweetHigh = Math.floor(TIMING_BAR_WIDTH * SWEET_SPOT_HIGH)
  const sub       = Math.round(position * (TIMING_BAR_WIDTH - 1) * 8)
  const tickCell  = Math.floor(sub / 8)
  const tickFrac  = sub % 8

  function trackBg(i: number): string {
    return i >= sweetLow && i <= sweetHigh ? theme.accent : theme.dim
  }

  // One tick color across the whole bar — a dark notch on both the dim
  // brown track and the amber sweet zone. No cell-by-cell switching.
  const tickFg = theme.bg

  function renderCell(i: number) {
    const bg = trackBg(i)
    // Tick lands cleanly inside this cell.
    if (i === tickCell && tickFrac === 0) {
      return <span key={i} fg={tickFg} bg={bg}>{"█"}</span>
    }
    // Tick straddles: this cell has track on the left, tick on the right.
    if (i === tickCell && tickFrac > 0) {
      return <span key={i} fg={bg} bg={tickFg}>{EIGHTHS[tickFrac]}</span>
    }
    // Tick straddles: this cell has tick on the left, track on the right.
    if (i === tickCell + 1 && tickFrac > 0) {
      return <span key={i} fg={tickFg} bg={bg}>{EIGHTHS[tickFrac]}</span>
    }
    return <span key={i} bg={bg}>{" "}</span>
  }

  // Render the bar as two identical rows so the track reads with weight
  // instead of as a thin line. The tick is the same in both rows; its
  // sub-cell straddle aligns so it looks like a 1-wide, 2-tall pillar.
  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
      <text>{Array.from({ length: TIMING_BAR_WIDTH }, (_, i) => renderCell(i))}</text>
      <text>{Array.from({ length: TIMING_BAR_WIDTH }, (_, i) => renderCell(i))}</text>
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
}

// ---- Local helpers ------------------------------------------------------

function leftAlignedFill(ratio: number, width: number): { filled: string; empty: string } {
  const clamped = Math.max(0, Math.min(1, ratio))
  const eighths = Math.round(clamped * width * 8)
  const full = Math.floor(eighths / 8)
  const partial = eighths % 8
  const filled = "█".repeat(full) + (partial > 0 ? EIGHTHS[partial] : "")
  return { filled, empty: "░".repeat(width - filled.length) }
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
