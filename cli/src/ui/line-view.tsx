// One row in the scroll. Color comes from the line's style. Story and
// ambient lines get a blank row below for breathing space; mechanical
// output (echo, system, error) stays tight so command lists read cleanly.

import type { Line, LineStyle } from "../game/types.ts"
import { theme } from "./theme.ts"

export function LineView({ line }: { line: Line }) {
  const text = line.style === "echo" ? `> ${line.text}` : line.text
  const spaced = line.style === "story" || line.style === "ambient"
  return <text fg={colorFor(line.style)} style={{ marginBottom: spaced ? 1 : 0 }}>{text}</text>
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
