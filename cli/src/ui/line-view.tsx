// One row in the scroll plus a one-row trailing gap, applied uniformly
// regardless of style. Mixed prose + command output reads with consistent
// breathing room. Color comes from the line's style.

import type { Line, LineStyle } from "../game/types.ts"
import { theme } from "./theme.ts"

export function LineView({ line }: { line: Line }) {
  const text = line.style === "echo" ? `> ${line.text}` : line.text
  return <text fg={colorFor(line.style)} style={{ marginBottom: 1 }}>{text}</text>
}

function colorFor(style: LineStyle): string {
  switch (style) {
    case "system":  return theme.dim
    case "echo":    return theme.accent
    case "story":   return theme.fg
    case "error":   return theme.danger
    case "dialog":  return theme.chat
    case "thought": return theme.accent
    case "pause":   return theme.dim
  }
}
