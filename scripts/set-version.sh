#!/usr/bin/env bash
# Set the same version on the wrapper, every platform package, and the
# wrapper's optionalDependencies entries. Called by CI on tag push, but
# safe to run by hand for testing.
#
# usage: scripts/set-version.sh 0.1.0

set -euo pipefail

VERSION="${1:?usage: scripts/set-version.sh <version>}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Update each platform package's version.
for pkg in packages/etch-cli-*; do
    jq ".version = \"$VERSION\"" "$pkg/package.json" > "$pkg/package.json.tmp"
    mv "$pkg/package.json.tmp" "$pkg/package.json"
done

# Update the wrapper: its version + every optionalDependencies entry, in
# lockstep so npm resolves the correct binary for this release.
jq --arg v "$VERSION" '
    .version = $v
    | .optionalDependencies |= with_entries(.value = $v)
' packages/etch-cli/package.json > packages/etch-cli/package.json.tmp
mv packages/etch-cli/package.json.tmp packages/etch-cli/package.json

echo "version set to $VERSION across:"
for pkg in packages/etch-cli*/; do
    name="$(basename "$pkg")"
    echo "  - $name"
done
