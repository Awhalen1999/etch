// One row in the scroll, with a blank row below it for breathing space.
// Color comes from the line's style.

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
    case "ambient": return theme.dim
    case "error":   return theme.danger
  }
}
