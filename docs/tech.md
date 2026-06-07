# etch — technical reference

## what etch is, technically

A **single-player text horror game** with a thin shared layer (inscriptions on
walls). Game runs entirely locally; the only network calls are to a tiny
REST API for shared world state.

No persistent connections. No real-time multiplayer. No server-side game state.

## stack

| piece | what | hosted on |
|---|---|---|
| **CLI** (the game) | TypeScript + OpenTUI on Bun (React reconciler over a native Zig core) | npm — published as a small JS wrapper that resolves a per-platform Bun-compiled binary, run via `npx etch-cli` |
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
        install instructions    - POST /api/inscriptions
                                - GET  /api/inscriptions

                                       ▲
                                       │ HTTPS (occasional, offline-tolerant)
                                       │
                          ┌────────────┴────────────┐
                          │  npx etch-cli           │
                          │  Bun + OpenTUI          │
                          │  runs in player's term  │
                          │  local save + account   │
                          └─────────────────────────┘
```

## the CLI client

**Where the game lives.** Single-player. All game logic in TypeScript. Bun is
the runtime (required for OpenTUI's Bun FFI bindings into the native Zig
rendering core). pnpm is the workspace package manager.

- Runs locally in the player's terminal via `npx etch-cli`
- Renders the UI with [OpenTUI](https://github.com/anomalyco/opentui) — a React
  reconciler over a native Zig core. JSX intrinsics are lowercase (`<box>`,
  `<text>`, `<input>`, …). Color and layout flow through the same React tree.
- Stores state in `~/.etch/`:
  - `account.json` — `{ name, token }` (created on first launch)
  - `save.json` — player state (depth, stamina, inventory, deepest, flags)
  - `inscriptions.json` — cached list of every wall inscription
  - `combat-lock.json` — present only while in pre-/in-combat; survives crashes
- Connects to the API occasionally for inscription sync — non-blocking, offline-safe

### CLI directory shape

```
cli/
├── package.json          name: "@etch/cli" (private; source-only workspace)
├── tsconfig.json         jsxImportSource: "@opentui/react"
└── src/
    ├── index.tsx         entry — createCliRenderer() + createRoot(...).render(<App />)
    ├── game/             pure logic (no React); easy to unit-test in isolation
    │   ├── types.ts      PlayerState, GameState, CombatState, Line, Emit, LineStyle
    │   ├── world.ts      bands, costs, encounter/ambiguous chances, enemy HP, timings
    │   ├── reducer.ts    single useReducer: command/tick/strike/brace/engage/escape/forceQuit/setInscriptions/emit/respawn
    │   ├── commands.ts   text command dispatcher (/down /up /rest /take /drop /read /me /help /quit)
    │   ├── combat.ts     bouncing-bar position math, sweet-spot detection, outcome resolution
    │   ├── encounter.ts  enemy registry + per-tick encounter spawn rolls
    │   ├── items.ts      catalog (28 kinds × 3 categories × 4 rarities), spawn pools, inventory math
    │   ├── prose.ts      all authored narrative — single source of truth (see story.md)
    │   ├── cutscenes.ts  band first-visit narration pickers
    │   ├── ambient.ts    ambient-line picker per band (one every ~90s while exploring)
    │   ├── horris.ts     depth-1 NPC dialog pools (return / respawn / idle)
    │   ├── queen.ts      queen approach + victory pickers; depth-200 arrival check
    │   ├── death.ts      death marker carving (async, hits API outside the reducer)
    │   └── mark.ts       /mark command (async, hits API outside the reducer)
    ├── ui/               OpenTUI React components
    │   ├── app.tsx       screen router (register → game)
    │   ├── register.tsx  first-launch title + landing prose + name prompt
    │   ├── game.tsx      reducer host, side effects (save, sync, exit, death, combat-lock)
    │   ├── layouts.tsx   MainLayout + CombatLayout (state-driven, no inner conditionals)
    │   ├── panels.tsx    Hud, Rule, Scroll, InputBar, NarrationIndicator, PreCombatBar
    │   ├── combat-panels.tsx  EnemyPanel, MomentPanel, TimingPanel (the in-combat UI)
    │   ├── line-view.tsx LineStyle → color, one row + trailing gap
    │   ├── stamina-bar.tsx  sub-cell filled bar using Unicode eighths
    │   └── theme.ts      palette constants (mirrors docs/theme.md)
    ├── api/              fetch wrappers — pure Result<T> shape, no exceptions
    │   ├── client.ts     base fetch + BASE_URL override via env
    │   ├── account.ts    claimName()
    │   └── inscriptions.ts  getInscriptions(), postInscription()
    └── store/            ~/.etch/* file I/O
        ├── json-file.ts    generic JSON read/write/clear
        ├── account.ts      account.json
        ├── save.ts         save.json
        ├── inscriptions.ts inscriptions.json (local cache of the world)
        └── combat-lock.ts  combat-lock.json (force-quit anti-cheese)
```

**Pure / impure split.** `game/` is pure data + functions. The only impure
modules in `game/` are `mark.ts` and `death.ts` — both touch the network
and dispatch into the reducer asynchronously; they live there because the
*decision* to mark or die is game logic, but the side effect can't be
inside the reducer. `ui/` and `store/` hold the side-effecty world.

## the API

**Tiny.** Three endpoints, two tables. Cloudflare Worker (TypeScript) + D1.

### endpoints

| method | path | purpose |
|---|---|---|
| `POST` | `/api/account` | claim a name, get a token |
| `POST` | `/api/inscriptions` | carve a new inscription; returns the full updated list |
| `GET` | `/api/inscriptions` | fetch the full list (supports `If-None-Match` for 304s) |
| `GET` | `/` | sanity-check root (`"etch api"`) |

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
    └── index.ts          all four route handlers (incl. /)
```

Currently deployed at `https://etch-api.awhalendev.workers.dev`. The
`api.etch.rip` DNS alias is the eventual production address; the CLI's
`BASE_URL` switches via env var.

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
    │   ├── index.astro   landing page
    │   └── story.astro   prose excerpt
    ├── layouts/
    │   └── Layout.astro
    ├── components/
    │   └── InstallBox.astro
    └── styles/
        ├── base.css
        └── theme.css     mirrors the palette in docs/theme.md
```

## hosting + deploy

Everything on Cloudflare except npm:

| artifact | deploy command | where |
|---|---|---|
| API | `cd api && wrangler deploy` | Cloudflare Workers + D1 |
| Landing | `cd web && wrangler pages deploy` (or git-connected) | Cloudflare Pages |
| CLI | CI builds per-platform binaries → `npm publish` per package | npm registry |

All free tier. Account + DNS through Cloudflare.

### CLI distribution (the `npx etch-cli` pattern)

`npx etch-cli` is the player-facing install, but the published `etch-cli`
package contains no JavaScript runtime of its own — it ships per-platform
compiled binaries (same pattern as esbuild, biome, swc, opencode):

- **Wrapper package** (`etch-cli`, at `packages/etch-cli/`) — what users
  `npx`. A tiny Node shim (`bin/etch-cli.js`) that resolves the
  platform-matching subpackage and `execFileSync`s its binary. Lists every
  platform package in `optionalDependencies`.
- **Platform subpackages** (`etch-cli-darwin-arm64`, `etch-cli-darwin-x64`,
  `etch-cli-linux-x64`, `etch-cli-linux-arm64`, `etch-cli-win32-x64`) —
  each contains one file: the Bun-compiled binary. Each declares its `os`
  and `cpu` fields, so npm silently skips packages that don't match the
  player's machine. Only one binary actually downloads.
- **Build matrix** — `scripts/build-all.sh` runs
  `bun build --compile --target=bun-<platform>` once per target. Bun
  cross-compiles from any host, so a single CI runner builds all five
  and publishes them together with the wrapper on tag.

Result: `npx etch-cli` works without Bun installed on the player's
machine. Bun is only required for development and the build step.

See `packages/README.md` for the full explainer + release flow.

## game state and persistence

**Local first.** Everything about your specific run lives in `~/.etch/`:

- `save.json` — depth, stamina, deepest, queenKilled, seenQueenApproach,
  resting state, inventory, last-move time, ambient timer
- `account.json` — `{ name, token }`
- `inscriptions.json` — cached list of every inscription (refreshed in
  the background; the game keeps working offline against this cache)
- `combat-lock.json` — present only while in pre-/in-combat. If found at
  launch it means the previous session force-quit mid-encounter; the
  player wakes into the death-recovery flow.

**Remote** only for shared world: inscriptions on walls. Accessed via the API,
cached locally for the session.

Local saves survive across npm updates. Hand-editable if anyone really wants.

## game loop

State lives in a single `useReducer` (`game/reducer.ts`) with action types:
`command`, `tick`, `strike`, `brace`, `engage`, `escape`, `forceQuit`,
`setInscriptions`, `emit`, `respawn`.

A `setInterval` dispatches `tick` actions every second (`TICK_MS = 1000`).
The reducer is pure; per-tick work it triggers:

- stamina recovery while resting (+2 per second)
- encounter spawn rolls (every 5s, only at depth ≥ 41, only while resting)
- pre-combat inaction timeout (15s, then death)
- cutscene line drip (`CUTSCENE_LINE_MS = 2000` — one line every 2s)
- ambient line picker while exploring (~every 90s)

`in_combat` has no timeout — the player times the bouncing bar at their own
pace. Bar position is derived from `(now - startedAt) % ROUND_CYCLE_MS`
in `game/combat.ts` (`ROUND_CYCLE_MS = 2000`). Same function feeds the
renderer and the hit detector — one source of truth.

### phases

`GameState.phase` is `"explore" | "pre_combat" | "in_combat"`. The UI's
layout switches off this state (in `layouts.tsx`), so each phase is its
own self-contained component tree rather than a layout with conditionals.

### cutscene system

Narration (opening, band first-visits, ant first encounter, queen approach,
queen victory) plays inline through the same scroll. While a cutscene is
active, `state.cutscene` is set and the footer swaps from `InputBar` to
a dim `"..."` indicator — input is locked, but the world keeps ticking.
Each tick emits the next queued line until the queue empties.

### line styles

Every line in the scroll has a `LineStyle`:

| style | use | color |
|---|---|---|
| `system` | meta ("you wake at depth 1.") | dim |
| `story`  | authored narration | fg |
| `dialog` | NPC speech, wrapped in quotes | chat |
| `thought`| player's internal voice | accent |
| `ambient`| atmosphere | dim |
| `pause`  | the `"..."` beat in a cutscene | dim |
| `echo`   | player's own command, prefixed `> ` | accent |
| `error`  | refusal lines ("you don't have the strength.") | danger |

### force-quit anti-cheese

If a player quits while in `pre_combat` or `in_combat`, `combat-lock.json`
is left on disk. On the next launch, the game detects it and forces the
death-recovery flow: marker is carved at the lock's depth, the player
wakes at depth 1. Lock is cleared on every normal exit.

## auth

**No passwords, no accounts in the traditional sense.**

1. First launch: player picks a name.
2. CLI POSTs `/api/account { name }`.
3. API returns a UUID token. CLI saves `{ name, token }` locally.
4. Future writes (inscription posts) include `{ name, token }` for verification.

Reads (`GET /api/inscriptions`) are public — no auth.

## conventions

- TypeScript strict mode
- No `any` outside test fixtures
- Pure functions for game logic (testable, deterministic)
- Side effects (file I/O, fetches) isolated to `store/`, `api/`, and the
  handful of network-bound `game/` modules (`mark.ts`, `death.ts`)
- Reducer is pure; impure work happens in `useEffect` hooks in `game.tsx`
- Commenting conventions live in `docs/comments.md`
