# etch

a text horror game. the only way is down.

## what's in here

| directory   | what |
|-------------|------|
| `cli/`      | the game source. TypeScript + OpenTUI on Bun. Private workspace — not published directly. |
| `api/`      | the inscription service. TypeScript on Cloudflare Workers + D1. |
| `web/`      | the landing page at etch.rip. Astro on Cloudflare Pages. |
| `packages/` | published npm packages — the `etch-cli` wrapper + per-platform binary subpackages. See `packages/README.md`. |
| `scripts/`  | `build-all.sh` (cross-compile all binaries), `set-version.sh` (sync versions). |
| `docs/`     | game design, story, tech reference, protocol, theme. |
| `.github/`  | release workflow — tag `v*` triggers build + npm publish. |

## how to play

```
npx etch-cli
```

The published `etch-cli` package on npm is a tiny Node shim. It resolves
the prebuilt Bun-compiled binary for the user's platform (provided as
separate subpackages via `optionalDependencies`) and executes it. **Bun
is not required on the user's machine.**

## dev

Requires `pnpm`, `node 20+`, and `bun` (for the CLI — OpenTUI needs Bun FFI).

```sh
pnpm install                # from the root, installs everything
cd cli && pnpm dev          # run the game locally
cd api && pnpm dev          # run the API locally (wrangler)
cd web && pnpm dev          # run the landing page locally (astro)
```

Build all five platform binaries (for testing or local publish dry-runs):

```sh
./scripts/build-all.sh
```

Cut a release (CI handles the rest):

```sh
git tag v0.1.0 && git push --tags
```

## docs

Start with [docs/design.md](docs/design.md) for what etch is.
[docs/tech.md](docs/tech.md) explains the architecture.
[docs/protocol.md](docs/protocol.md) is the API contract.
[packages/README.md](packages/README.md) explains the distribution pattern.
