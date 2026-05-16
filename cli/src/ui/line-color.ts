// Maps a Line's style to a theme color. One source of truth for both
// the scroll renderer (game.tsx) and the combat scene.

import type { LineStyle } from "../game/types";
import { theme } from "./theme";

export function colorFor(style: LineStyle): string {
    switch (style) {
        case "system":  return theme.fg;
        case "private": return theme.dim;
        case "danger":  return theme.danger;
        case "chat":    return theme.chat;
        case "input":   return theme.accent;
        case "success": return theme.chat;
    }
}
