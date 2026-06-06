// First-launch title screen.
//
// Top: an ASCII title in dried-blood red.
// Middle: the landing prose drips line-by-line every CUTSCENE_LINE_MS.
// Bottom: once the drip finishes, "name yourself." and the input
// reveal. The player cannot skip the prose by typing fast — the input
// isn't mounted until the last line lands. Registering is, narratively,
// the act of waking up; the post-register opening cutscene picks up at
// "you wake."

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

interface RegisterProps {
  onDone: (account: Account) => void
}

export function Register({ onDone }: RegisterProps) {
  const { width, height } = useTerminalDimensions()
  const [lines, setLines] = useState<Emit[]>([])
  const [promptReady, setPromptReady] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  // Drip the landing prose, then reveal the prompt one beat later.
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      if (i < LANDING_PROSE.length) {
        setLines((prev) => [...prev, LANDING_PROSE[i]!])
        i += 1
        return
      }
      setPromptReady(true)
      clearInterval(id)
    }, CUTSCENE_LINE_MS)
    return () => clearInterval(id)
  }, [])

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
  // it inherits onSubmit(SubmitEvent) from Textarea and the React
  // wrapper redeclares onSubmit(string), so they intersect. At runtime
  // the wrapper passes the value as a string; we accept unknown and narrow.
  const onSubmit = (arg: unknown) => {
    if (typeof arg !== "string") return
    void submit(arg.trim().toLowerCase())
  }

  // Fixed-width inner column. The outer centers it horizontally; text
  // inside reads left-aligned.
  const inner = Math.min(64, Math.max(0, width - 4))

  // Clip the dripped lines so the title and prompt always fit inside
  // the terminal viewport. On shorter terminals the oldest visible
  // line falls off the top as new ones arrive — no flex anchoring, no
  // bottom gap, just a top-down render of whatever fits. Chrome rows:
  // paddingTop (2) + title (6) + spacer (1) + rule (1) + spacer (1) = 11;
  // with prompt add rule + spacer + "name yourself." + input = +4.
  // Each prose line takes 2 rows (text + trailing gap).
  const chrome = promptReady ? 15 : 11
  const visibleCount = Math.max(1, Math.floor((height - chrome) / 2))
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
        {promptReady && <Rule width={inner} />}
        {promptReady && <text>{" "}</text>}
        {promptReady && <text fg={theme.fg}>name yourself.</text>}
        {promptReady && (
          <box style={{ flexDirection: "row" }}>
            <text fg={theme.dim}>{"> "}</text>
            <input
              focused
              maxLength={NAME_MAX}
              onSubmit={onSubmit}
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
