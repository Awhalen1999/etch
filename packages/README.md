# distribution packages

This directory holds the npm packages users actually install. It is **not**
a pnpm workspace — these packages stand alone and are published independently
during a manual release.

## the pattern

Users run `npx etch-cli`. npm resolves the `etch-cli` wrapper here, which is
a tiny Node shim. The wrapper's `optionalDependencies` lists five platform
packages — one per `(os, arch)` we support. Each platform package declares
its `os` and `cpu` fields, so **npm silently skips downloading the ones that
don't match the user's machine**. Exactly one platform package ends up
installed.

The shim looks up which platform package matched, resolves its binary, and
`execFileSync`s it with the user's args + inherited stdio. The game runs as
if invoked directly.

Same pattern as esbuild, biome, swc, opencode, lightningcss, rolldown, and
every other native-toolchain CLI on npm.

## the packages

| package                  | role                                              | binary in git    |
|--------------------------|---------------------------------------------------|------------------|
| `etch-cli/`              | wrapper. Ships the Node shim. Listed as the `bin`.| n/a (source)     |
| `etch-cli-darwin-arm64/` | macOS Apple Silicon binary                        | no (built locally) |
| `etch-cli-darwin-x64/`   | macOS Intel binary                                | no               |
| `etch-cli-linux-x64/`    | Linux x64 binary                                  | no               |
| `etch-cli-linux-arm64/`  | Linux arm64 binary                                | no               |
| `etch-cli-win32-x64/`    | Windows x64 binary                                | no               |

Only the `package.json` files for the platform packages are checked in; the
binaries themselves are produced by the build script and ignored.

## build flow (local)

```sh
./scripts/build-all.sh
```

Builds all five binaries via `bun build --compile --target=bun-<platform>` and
stages each into the matching `packages/etch-cli-<os>-<arch>/bin/` directory.
Bun cross-compiles from any host, so this runs on a single machine.

## release flow (manual)

From a machine logged in to npm with publish rights:

1. `scripts/set-version.sh X.Y.Z` — bumps every `package.json` in `packages/`
   to the new version, including the wrapper's `optionalDependencies` entries.
2. `scripts/build-all.sh` — builds all five binaries.
3. `npm publish` each platform package (the wrapper requires them to exist
   in the registry before it publishes):
   ```sh
   for pkg in packages/etch-cli-*; do
     (cd "$pkg" && npm publish --access public)
   done
   ```
4. `npm publish` the wrapper:
   ```sh
   cd packages/etch-cli && npm publish --access public
   ```
5. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

## why this works for a Bun app

`bun build --compile` produces a single static binary with the Bun runtime
embedded. Users don't need Bun installed — the binary *is* Bun + the app.

The Node shim is just enough to do the platform lookup at install time; Node
is already on the user's machine via `npx`.
