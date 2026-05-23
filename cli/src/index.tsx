import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard } from "@opentui/react"

function App() {
  useKeyboard((key) => {
    if (key.name === "q" || (key.name === "c" && key.ctrl)) {
      process.exit(0)
    }
  })

  return (
    <box style={{ padding: 1, flexDirection: "column" }}>
      <text>etch</text>
      <text>the only way is down.</text>
      <text> </text>
      <text>press q to leave.</text>
    </box>
  )
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
