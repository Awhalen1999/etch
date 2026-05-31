// One row in the scroll. Color comes from the line's style. Atmospheric
// lines (story, ambient, dialog, thought, pause) get a blank row below
// for breathing space; mechanical output (echo, system, error) stays
// tight so command lists read cleanly.

import type { Line, LineStyle } from "../game/types.ts"
import { theme } from "./theme.ts"

const SPACED: ReadonlySet<LineStyle> = new Set([
  "story", "ambient", "dialog", "thought", "pause",
])

export function LineView({ line }: { line: Line }) {
  const text = line.style === "echo" ? `> ${line.text}` : line.text
  const margin = SPACED.has(line.style) ? 1 : 0
  return <text fg={colorFor(line.style)} style={{ marginBottom: margin }}>{text}</text>
}

function colorFor(style: LineStyle): string {
  switch (style) {
    case "system":  return theme.dim
    case "echo":    return theme.accent
    case "story":   return theme.fg
    case "ambient": return theme.dim
    case "error":   return theme.danger
    case "dialog":  return theme.chat
    case "thought": return theme.accent
    case "pause":   return theme.dim
  }
}
