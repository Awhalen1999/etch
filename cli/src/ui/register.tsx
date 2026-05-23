// First-launch name prompt.
//
// Validates the name client-side (length, charset), POSTs to the API
// to claim it, and persists the returned token. Errors stay on screen
// so the player can edit and retry — the <input> keeps its value across
// re-renders.

import { useState } from "react"
import { theme } from "./theme.ts"
import { claimName } from "../api/account.ts"
import { saveAccount, type Account } from "../store/account.ts"

const NAME_MIN = 3
const NAME_MAX = 32
const NAME_REGEX = /^[a-z0-9_]+$/

interface RegisterProps {
  onDone: (account: Account) => void
}

export function Register({ onDone }: RegisterProps) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string }
  >({ kind: "idle" })

  async function submit(name: string) {
    if (status.kind === "submitting") return

    const localError = validate(name)
    if (localError) {
      setStatus({ kind: "error", message: localError })
      return
    }

    setStatus({ kind: "submitting" })
    const result = await claimName(name)
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error })
      return
    }

    saveAccount(result.data)
    onDone(result.data)
  }

  // OpenTUI 0.2.x has an unsatisfiable JSX type for <input onSubmit>:
  // InputRenderableOptions inherits onSubmit(SubmitEvent) from Textarea, and
  // the React wrapper redeclares onSubmit(string), so they intersect. At
  // runtime the wrapper passes the input's value as a string; we accept
  // `unknown` and narrow.
  const onSubmit = (arg: unknown) => {
    if (typeof arg !== "string") return
    void submit(arg.trim().toLowerCase())
  }

  return (
    <box style={{ padding: 2, flexDirection: "column" }}>
      <text fg={theme.accent}>etch</text>
      <text fg={theme.dim}>the only way is down.</text>
      <text> </text>
      <text fg={theme.fg}>name yourself.</text>
      <input
        focused
        placeholder="..."
        maxLength={NAME_MAX}
        onSubmit={onSubmit}
        style={{
          textColor: theme.fg,
          focusedTextColor: theme.fg,
          placeholderColor: theme.dim,
        }}
      />
      {status.kind === "error" && <text fg={theme.danger}>{status.message}</text>}
      {status.kind === "submitting" && <text fg={theme.dim}>carving...</text>}
    </box>
  )
}

function validate(name: string): string | null {
  if (name.length < NAME_MIN) return `too short. at least ${NAME_MIN} characters.`
  if (name.length > NAME_MAX) return `too long. ${NAME_MAX} characters max.`
  if (!NAME_REGEX.test(name)) return "only letters, numbers, and underscores."
  return null
}
