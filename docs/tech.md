# etch — technical reference

## what etch is, technically

A **single-player text horror game** with a thin shared layer (inscriptions on
walls). Game runs entirely locally; the only network calls are to a tiny
REST API for shared world state.

No persistent connections. No real-time multiplayer. No Rust server.

## stack

| piece | what | hosted on |
|---|---|---|
| **CLI** (the game) | TypeScript + OpenTUI on Bun (React reconciler over a native Zig core) | published to npm as per-platform compiled binaries, runs locally via `npx etch` |
| **API** | TypeScript on Cloudflare Workers + D1 (SQLite) | Cloudflare, free tier |
| **Landing page** | Astro | Cloudflare Pages, free |
| **Domain + DNS** | `etch.rip` | Cloudflare |

**Total monthly cost: $0** at expected scale (free tier covers 10k+ daily players).

## architecture

```
                              etch.rip (Cloudflare DNS)
                                       │
              ┌────────────────────────┼─────────────────────────┐
              │                        │                         │
        etch.rip                api.etch.rip                  (no other
        (Astro static site,     (Cloudflare Worker            subdomains for now)
         Pages)                  + D1 SQLite)
        marketing,              REST endpoints:
        prose excerpts,         - POST /api/account
        connection info        - POST /api/inscriptions
                                - GET  /api/inscriptions

                                       ▲
                                       │ HTTPS (occasional)
                                       │
                          ┌────────────┴────────────┐
                          │  npx etch               │
                          │  Bun + OpenTUI          │
                          │  runs in player's term  │
                          │  local save + account   │
                          └─────────────────────────┘
```

## the CLI client

**Where the game lives.** Single-player. All game logic in TypeScript. Bun is
the runtime (required for OpenTUI's Bun FFI bindings into the native Zig
rendering core). pnpm is still the workspace package manager.

- Runs locally in the player's terminal via `npx etch`
- Renders the UI with [OpenTUI](https://github.com/anomalyco/opentui) — a React
  reconciler over a native Zig core. JSX intrinsics are lowercase (`<box>`,
  `<text>`, `<input>`, `<select>`, …). Color and layout flow through the same
  React tree the rest of the UI uses.
- Stores state in `~/.etch/`:
  - `account.json` — `{ name, token }` (created on first launch)
  - `save.json` — game state (depth, stamina, inventory, deepest, queen flag)
- Connects to the API occasionally for inscription sync — non-blocking, offline-safe

### CLI directory shape

```
cli/
├── package.json          name: "@etch/cli", bin: { "etch": "./dist/etch" }
├── tsconfig.json         jsxImportSource: "@opentui/react"
└── src/
    ├── index.tsx         entry — createCliRenderer() + createRoot(...).render(<App />)
    ├── game/             pure logic: encounter, items, death, world, commands, tick
    │   ├── types.ts      PlayerState, EncounterState, Session, Outcome, Line
    │   ├── world.ts      depth → band / encounter chance / enemy HP
    │   ├── items.ts      catalog + bonus math + spawn roll
    │   ├── encounter.ts  combat math, telegraph pools, bouncing-bar position
    │   ├── commands.ts   text command dispatcher (out-of-combat)
    │   └── tick.ts       1Hz tick: recovery, spawn rolls, pre-combat timeout
    ├── ui/               OpenTUI React components
    │   ├── app.tsx       screen router (loading → register → game)
    │   ├── register.tsx  first-launch name prompt
    │   ├── game.tsx      reducer + HUD + scroll + input + key dispatch
    │   ├── combat-scene.tsx   full-screen combat layout
    │   ├── hooks.ts      useTerminalDimensions wrappers, command-input hook
    │   ├── line-color.ts LineStyle → palette color
    │   └── theme.ts      palette constants (sourced from docs/theme.md)
    ├── api/
    │   └── client.ts     fetch wrapper for api.etch.rip
    └── store/
        ├── account.ts    ~/.etch/account.json I/O
        └── save.ts       ~/.etch/save.json I/O
```

Game logic in one place. Future browser version would extract `game/` into a
shared package, but for now keep it together — refactor later if it happens.

The current `src/` is a minimal OpenTUI bootstrap; the structure above is the
target shape as game systems get ported over.

## the API

**Tiny.** Three endpoints, two tables. Cloudflare Worker (TypeScript) + D1.

### endpoints

| method | path | purpose |
|---|---|---|
| `POST` | `/api/account` | claim a name, get a token |
| `POST` | `/api/inscriptions` | carve a new inscription; returns the full updated list |
| `GET` | `/api/inscriptions` | fetch the full list (supports `If-None-Match` for 304s) |

### D1 schema

```sql
CREATE TABLE accounts (
    name       TEXT PRIMARY KEY,
    token      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    depth      INTEGER NOT NULL,
    text       TEXT NOT NULL,
    written_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (name) REFERENCES accounts(name)
);

CREATE INDEX idx_inscriptions_depth ON inscriptions(depth);
```

### api directory shape

```
api/
├── wrangler.toml         Cloudflare Worker config
├── package.json
├── tsconfig.json
├── schema.sql            D1 schema
└── src/
    └── index.ts          three route handlers
```

## the landing page

Astro static site on Cloudflare Pages.

- Sells the game: prose excerpt, atmosphere, install instructions
- May (later) embed a live inscription feed from the API
- Statically generated; zero server cost

### web directory shape

```
web/
├── package.json
├── astro.config.mjs
├── public/               static assets (fonts, images)
└── src/
    ├── pages/
    │   └── index.astro   landing page
    ├── layouts/
    └── components/
```

## hosting + deploy

Everything on Cloudflare:

| artifact | deploy command | where |
|---|---|---|
| API | `cd api && wrangler deploy` | Cloudflare Workers + D1 |
| Landing | `cd web && wrangler pages deploy` (or git-connected) | Cloudflare Pages |
| CLI | `bun build --compile` per platform → `npm publish` | npm registry |

All free tier. Account + DNS through Cloudflare.

### CLI distribution

`npx etch` is the player-facing install, but the published `etch` package
contains no JavaScript runtime of its own — it ships per-platform compiled
binaries (same pattern as esbuild/biome/swc):

- For each target (`bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`,
  `bun-linux-arm64`, `bun-windows-x64`), CI runs
  `bun build --compile --target=<target> src/index.tsx --outfile=…` and
  publishes a tiny subpackage containing just that binary
  (e.g. `etch-darwin-arm64`).
- The main `etch` package's `optionalDependencies` lists all platform
  subpackages; npm installs only the one matching the user's OS/arch.
- The main `bin` field points at a small JS shim that resolves and `exec`s
  the platform binary.

Result: `npx etch` works without Bun installed on the player's machine. Bun
is only required for development and the build step.

## game state and persistence

**Local first.** Everything about your specific run lives in `~/.etch/save.json`:

- depth, stamina, deepest_depth, resting state
- inventory (items + their stats)
- queen flag, diacritic
- which bands you've crossed (for first-visit messages)

**Remote** only for shared world: inscriptions on walls. Accessed via the API,
cached locally for the session.

Local saves survive across npm updates. Hand-editable if anyone really wants.

## tick / game loop

State lives in a `useReducer` with three action types: `input` (text command),
`combat` (single keystroke during an encounter), and `tick` (heartbeat).

A `setInterval` dispatches `tick` actions at ~33ms (30fps). Game logic gates
itself by `Date.now()`-since-last so the fast tick is purely a render concern.
Per-tick work:

- stamina recovery while resting (+1 per second)
- encounter spawn rolls while resting (every 5s)
- pre-combat inaction timeout (15s, then death)
- combat bouncing-bar redraw (smooth via Unicode partial-block characters)

In-combat has no timeout — the player times the bouncing bar at their own pace.
Single source of truth for bar position: `barPosition(elapsedMs)` in
`game/encounter.ts`, used by both the renderer and the hit detector.

## auth

**No passwords, no accounts in the traditional sense.**

1. First launch: player picks a name.
2. CLI POSTs `/api/account { name }`.
3. API returns a UUID token. CLI saves `{ name, token }` locally.
4. Future writes (inscription posts) include `{ name, token }` for verification.

Reads (`GET /api/inscriptions`) are public — no auth.

## conventions

- TypeScript strict mode, `tsconfig` extends a shared config
- No `any` outside test fixtures
- Pure functions for game logic (testable)
- Side effects (file I/O, fetches) isolated to dedicated modules
- Game logic must be deterministic given input + RNG seed (future: replay)
