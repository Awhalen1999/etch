// Sub-cell-smooth stamina bar.
//
// Unicode partial blocks give us 8 fill steps per cell — at default width
// 16 that's 128 distinct fill levels. Color shifts as the player drains:
// calm dust → warmer amber → deep red.

import { theme } from "./theme.ts"

interface StaminaBarProps {
  value: number
  max: number
  width?: number
}

const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const

export function StaminaBar({ value, max, width = 16 }: StaminaBarProps) {
  const ratio = Math.max(0, Math.min(1, value / max))
  const eighths = Math.round(ratio * width * 8)
  const full = Math.floor(eighths / 8)
  const partial = eighths % 8

  const filled = "█".repeat(full) + (partial > 0 ? EIGHTHS[partial] : "")
  const empty = "░".repeat(width - filled.length)

  const fill =
    ratio < 0.25 ? theme.danger :
    ratio < 0.5  ? theme.accent :
    theme.fg

  return (
    <text>
      <span fg={fill}>{filled}</span>
      <span fg={theme.dim}>{empty}</span>
    </text>
  )
}
