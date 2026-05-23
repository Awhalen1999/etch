// The top status bar.
//
// One row: name . depth . stamina bar . X/MAX . deepest. Separators
// use the rule color so they fade into the background; values use fg
// or accent so the eye can find them.

import { StaminaBar } from "./stamina-bar.tsx"
import { theme } from "./theme.ts"

interface HudProps {
  name: string
  depth: number
  stamina: number
  maxStamina: number
  deepest: number
}

export function Hud({ name, depth, stamina, maxStamina, deepest }: HudProps) {
  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
      <text>
        <span fg={theme.accent}>{name}</span>
        <Sep />
        <span fg={theme.dim}>depth </span>
        <span fg={theme.fg}>{String(depth)}</span>
        <Sep />
        <span fg={theme.dim}>stamina </span>
      </text>
      <StaminaBar value={stamina} max={maxStamina} />
      <text>
        <span fg={theme.fg}>{` ${stamina}/${maxStamina}`}</span>
        <Sep />
        <span fg={theme.dim}>deepest </span>
        <span fg={theme.fg}>{String(deepest)}</span>
      </text>
    </box>
  )
}

function Sep() {
  return <span fg={theme.rule}>{"  ·  "}</span>
}
