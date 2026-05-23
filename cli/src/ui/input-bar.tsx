// The > prompt at the bottom of the screen.
//
// OpenTUI's <input> is uncontrolled - it owns its own value. To clear it
// after each submit we bump a `key` so React re-mounts the element.

import { useState } from "react"
import { theme } from "./theme.ts"

interface InputBarProps {
  onSubmit: (raw: string) => void
}

export function InputBar({ onSubmit }: InputBarProps) {
  const [resetKey, setResetKey] = useState(0)

  // OpenTUI 0.2.x JSX types intersect onSubmit(SubmitEvent) (from core)
  // with onSubmit(string) (from the React adapter). At runtime it's a
  // string; we accept `unknown` and narrow. Same workaround as register.
  const handle = (arg: unknown) => {
    if (typeof arg !== "string") return
    onSubmit(arg)
    setResetKey((k) => k + 1)
  }

  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
      <text fg={theme.dim}>{"> "}</text>
      <input
        key={resetKey}
        focused
        onSubmit={handle}
        style={{
          flexGrow: 1,
          textColor: theme.fg,
          focusedTextColor: theme.fg,
          placeholderColor: theme.dim,
        }}
      />
    </box>
  )
}
