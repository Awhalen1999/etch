#!/usr/bin/env bash
# Build the CLI as a Bun-compiled binary for every supported platform and
# stage each binary into its matching package under packages/.
#
# After this runs, each packages/etch-cli-<os>-<arch>/bin/etch (or
# etch.exe on Windows) is a real binary ready to be tested or published.
#
# Bun cross-compiles from any host, so this runs on a single machine.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/cli"

build() {
    local target="$1"
    local pkg="$2"
    local filename="$3"
    local outdir="$ROOT/packages/$pkg/bin"
    local out="$outdir/$filename"

    echo "→ $target → packages/$pkg/bin/$filename"
    mkdir -p "$outdir"
    bun build \
        --compile \
        --minify \
        --target="$target" \
        --outfile="$out" \
        src/index.tsx
}

build bun-darwin-arm64  etch-cli-darwin-arm64  etch
build bun-darwin-x64    etch-cli-darwin-x64    etch
build bun-linux-x64     etch-cli-linux-x64     etch
build bun-linux-arm64   etch-cli-linux-arm64   etch
build bun-windows-x64   etch-cli-win32-x64     etch.exe

echo ""
echo "done. binaries staged in packages/*/bin/."
