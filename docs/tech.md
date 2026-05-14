# etch — technical reference

## what etch is, technically

A **single-player text horror game** with a thin shared layer (inscriptions on
walls). Game runs entirely locally; the only network calls are to a tiny
REST API for shared world state.

No persistent connections. No real-time multiplayer. No Rust server.

## stack

| piece | what | hosted on |
|---|---|---|
| **CLI** (the game) | TypeScript + OpenTUI | published to npm, runs locally via `npx @etch/cli` |
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
                          │  npx @etch/cli          │
                          │  TypeScript + OpenTUI   │
                          │  runs in player's term  │
                          │  local save + account   │
                          └─────────────────────────┘
```

## the CLI client

**Where the game lives.** Single-player. All game logic in TypeScript.

- Runs locally in the player's terminal via `npx @etch/cli`
- Renders TUI with OpenTUI components
- Stores state in `~/.etch/`:
  - `account.json` — `{ name, token }` (created on first launch)
  - `save.json` — game state (depth, stamina, items, deepest)
- Connects to the API occasionally for inscription sync — non-blocking, offline-safe

### CLI directory shape

```
cli/
├── package.json          name: "@etch/cli", bin: { "etch": "./dist/index.js" }
├── tsconfig.json
└── src/
    ├── index.ts          entry — first-launch flow, then game loop
    ├── game/             encounter logic, items, death, world ticks
    ├── ui/               OpenTUI components (hud, scroll, input)
    ├── api/              fetch wrapper for api.etch.rip
    └── store/            local file I/O for account + save
```

Game logic in one place. Future browser version would extract `game/` into a
shared package, but for now keep it together — refactor later if it happens.

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
| CLI | `cd cli && npm publish` | npm registry |

All free tier. Account + DNS through Cloudflare.

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

Game runs in a single TypeScript loop driven by user input + setInterval for
time-based effects. With no server, latency stops mattering — we can now do:

- Real-time telegraph windows (combat reaction timing)
- Smooth stamina recovery animation
- Per-frame screen redraw via OpenTUI
- Tighter feedback loops without protocol roundtrips

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
