import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard } from "@opentui/react"
import { App } from "./ui/app.tsx"

function Root() {
  useKeyboard((key) => {
    if (key.name === "c" && key.ctrl) process.exit(0)
  })
  return <App />
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<Root />)
