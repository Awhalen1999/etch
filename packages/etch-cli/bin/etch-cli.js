#!/usr/bin/env node
// etch-cli — wrapper shim.
//
// Resolves the platform-matching subpackage (etch-cli-<os>-<arch>) that
// npm auto-installed via optionalDependencies, then execs its binary
// with the user's args and inherited stdio. The wrapper itself ships no
// runtime; the heavy lifting is in the platform binary, which is the
// CLI compiled via `bun build --compile`.

const { execFileSync } = require("node:child_process")

const PLATFORM_PACKAGES = {
  "darwin-arm64": "etch-cli-darwin-arm64",
  "darwin-x64":   "etch-cli-darwin-x64",
  "linux-x64":    "etch-cli-linux-x64",
  "linux-arm64":  "etch-cli-linux-arm64",
  "win32-x64":    "etch-cli-win32-x64",
}

const key = `${process.platform}-${process.arch}`
const pkg = PLATFORM_PACKAGES[key]
if (!pkg) {
  console.error(`etch-cli: no prebuilt binary for ${key}.`)
  console.error(`supported: ${Object.keys(PLATFORM_PACKAGES).join(", ")}`)
  process.exit(1)
}

const ext = process.platform === "win32" ? ".exe" : ""
let binary
try {
  binary = require.resolve(`${pkg}/bin/etch${ext}`)
} catch {
  console.error(`etch-cli: ${pkg} is not installed.`)
  console.error(`the platform binary should install automatically via optionalDependencies.`)
  console.error(`if you installed with --no-optional or --ignore-optional, reinstall without those flags.`)
  process.exit(1)
}

try {
  execFileSync(binary, process.argv.slice(2), { stdio: "inherit" })
} catch (err) {
  process.exit(err.status ?? 1)
}
