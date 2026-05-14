# etch

a text horror game. the only way is down.

## what's in here

| directory | what |
|---|---|
| `cli/` | the game itself. TypeScript + OpenTUI. published to npm as `@etch/cli`. |
| `api/` | the inscription service. TypeScript on Cloudflare Workers + D1. |
| `web/` | the landing page at etch.rip. Astro on Cloudflare Pages. |
| `docs/` | game design, story, tech reference, protocol, theme. |

## how to play (eventually)

```
npx @etch/cli
```

## dev

requires `pnpm` and `node 20+`.

```
pnpm install                # from the root, installs everything
cd cli && pnpm dev          # run the game locally
cd api && pnpm dev          # run the API locally (wrangler)
cd web && pnpm dev          # run the landing page locally (astro)
```

## docs

start with [docs/design.md](docs/design.md) for what etch is.
[docs/tech.md](docs/tech.md) explains the architecture.
[docs/protocol.md](docs/protocol.md) is the API contract.
