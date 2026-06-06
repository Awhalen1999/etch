// First-launch title screen. ETCH logo, dripping landing prose ending
// with the "name yourself." prompt, then the input. The prompt is just
// the final line in the drip sequence so it inherits the same styling
// as every other line. The input mounts when the drip finishes — the
// player can't skip the prose by typing fast.

import { useEffect, useState } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { theme } from "./theme.ts"
import { LineView } from "./line-view.tsx"
import { Rule } from "./panels.tsx"
import { claimName } from "../api/account.ts"
import { saveAccount, type Account } from "../store/account.ts"
import { LANDING_PROSE } from "../game/prose.ts"
import type { Emit } from "../game/types.ts"
import { CUTSCENE_LINE_MS } from "../game/world.ts"

const NAME_MIN = 3
const NAME_MAX = 32
const NAME_REGEX = /^[a-z0-9_]+$/

const DRIP: Emit[] = [
  ...LANDING_PROSE,
  { style: "story", text: "name yourself." },
]

// Pre-rendered ANSI-Shadow-style block lettering. Lives here as a const
// (no figlet runtime dep) so colors and spacing are entirely under our
// control. 6 rows tall, 33 cells wide.
const TITLE = [
  "███████╗████████╗ ██████╗██╗  ██╗",
  "██╔════╝╚══██╔══╝██╔════╝██║  ██║",
  "█████╗     ██║   ██║     ███████║",
  "██╔══╝     ██║   ██║     ██╔══██║",
  "███████╗   ██║   ╚██████╗██║  ██║",
  "╚══════╝   ╚═╝    ╚═════╝╚═╝  ╚═╝",
]

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }

export function Register({ onDone }: { onDone: (account: Account) => void }) {
  const { width, height } = useTerminalDimensions()
  const [lines, setLines] = useState<Emit[]>([])
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  // Drip the prose + prompt together. Ready flips on the same tick as
  // the last line lands so the input doesn't lag behind it.
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      setLines((prev) => [...prev, DRIP[i]!])
      i += 1
      if (i >= DRIP.length) {
        setReady(true)
        clearInterval(id)
      }
    }, CUTSCENE_LINE_MS)
    return () => clearInterval(id)
  }, [])

  // OpenTUI 0.2.x's <input onSubmit> type intersects SubmitEvent and
  // string. At runtime we get a string; narrow it here.
  async function handleSubmit(arg: unknown) {
    if (typeof arg !== "string" || status.kind === "submitting") return
    const name = arg.trim().toLowerCase()
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

  // Fixed inner column, centered horizontally. Chrome rows: paddingTop
  // (2) + title (6) + spacer (1) + rule (1) + spacer (1) + input (1) = 12.
  // Each prose line takes 2 rows; the oldest falls off the top when the
  // viewport can't hold them all.
  const inner = Math.min(64, Math.max(0, width - 4))
  const visibleCount = Math.max(1, Math.floor((height - 12) / 2))
  const recent = lines.slice(-visibleCount)

  return (
    <box style={{
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 2,
    }}>
      {TITLE.map((row, i) => (
        <text key={i} fg={theme.danger}>{row}</text>
      ))}
      <text>{" "}</text>

      <box style={{ width: inner, flexDirection: "column" }}>
        <Rule width={inner} />
        <text>{" "}</text>
        {recent.map((emit, i) => (
          <LineView key={i} line={{ id: i, ...emit }} />
        ))}
        {ready && (
          <box style={{ flexDirection: "row" }}>
            <text fg={theme.dim}>{"> "}</text>
            <input
              focused
              maxLength={NAME_MAX}
              onSubmit={handleSubmit}
              style={{
                flexGrow: 1,
                textColor: theme.fg,
                focusedTextColor: theme.fg,
                placeholderColor: theme.dim,
              }}
            />
          </box>
        )}
        {status.kind === "error" && <text fg={theme.danger}>{status.message}</text>}
        {status.kind === "submitting" && <text fg={theme.dim}>carving...</text>}
      </box>
    </box>
  )
}

function validate(name: string): string | null {
  if (name.length < NAME_MIN) return `too short. at least ${NAME_MIN} characters.`
  if (name.length > NAME_MAX) return `too long. ${NAME_MAX} characters max.`
  if (!NAME_REGEX.test(name)) return "only letters, numbers, and underscores."
  return null
}
