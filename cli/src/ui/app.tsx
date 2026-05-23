// Screen router. Decides on boot whether the player needs to register,
// then hands off to the game once an account is in hand.

import { useState } from "react"
import { loadAccount, type Account } from "../store/account.ts"
import { Register } from "./register.tsx"
import { theme } from "./theme.ts"

type Screen =
  | { kind: "register" }
  | { kind: "game"; account: Account }

export function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const account = loadAccount()
    return account ? { kind: "game", account } : { kind: "register" }
  })

  if (screen.kind === "register") {
    return <Register onDone={(account) => setScreen({ kind: "game", account })} />
  }

  return (
    <box style={{ padding: 2, flexDirection: "column" }}>
      <text fg={theme.accent}>welcome, {screen.account.name}.</text>
      <text fg={theme.dim}>the shaft waits.</text>
    </box>
  )
}
