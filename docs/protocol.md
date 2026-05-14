# etch — API protocol

The contract between the CLI client and the etch API. HTTPS, REST, JSON.

Base URL: `https://api.etch.rip`

The game runs entirely locally; this API is **only for the shared inscription
layer** (the wall-carvings every player can see).

## endpoints

### `POST /api/account`

Claim a name. Called once, on the player's first launch.

**Request:**
```json
{ "name": "alex" }
```

**Response 200:**
```json
{ "name": "alex", "token": "9f2a4b1c-..." }
```

**Response 409 (name taken):**
```json
{ "error": "name taken" }
```

The client saves `{ name, token }` to `~/.etch/account.json` and reuses it
for all future writes.

---

### `POST /api/inscriptions`

Carve a new inscription. Called when the player types `/mark` or dies.

**Request:**
```json
{
    "name": "alex",
    "token": "9f2a4b1c-...",
    "depth": 88,
    "text": "alex fell here. 2026-05-14."
}
```

**Response 200:** the **full updated list** of inscriptions, so the client can
replace its local cache wholesale.

```json
[
    { "id": 1, "name": "alex", "depth": 88,
      "text": "alex fell here. 2026-05-14.", "written_at": "2026-05-14T..." },
    { "id": 2, "name": "vega", "depth": 152, "text": "...", "written_at": "..." }
]
```

**Response 401 (bad token):**
```json
{ "error": "unauthorized" }
```

**Response 400 (validation):**
```json
{ "error": "text too long" }
```

Validation rules:
- `text` ≤ 240 chars (matches `/mark` cap)
- `depth` in 1..200
- `name` matches the token's owner

---

### `GET /api/inscriptions`

Fetch the full list. Called once at launch and periodically (~every 5 min)
while playing.

**Request:** no body. Optionally include `If-None-Match: <etag>` to get a 304
when nothing changed.

**Response 200:**
```json
[
    { "id": 1, "name": "alex", "depth": 88, "text": "...", "written_at": "..." },
    ...
]
```

Response headers include `ETag: "<hash>"` and `Cache-Control: max-age=30`.

**Response 304:** empty body. Client keeps using its cached data.

## design principles

- **Server is the source of truth.** Client never invents data.
- **Single source of truth in responses.** POST returns the full updated list;
  client replaces its cache wholesale. No client-side merge logic.
- **Edge caching does most of the work.** GETs cached for 30s at Cloudflare's
  edge — concurrent fetches share one Worker invocation.
- **Offline-tolerant.** The game works fine if the API is unreachable. Marks
  queue and retry on next successful post (optional polish).
- **Additive.** New endpoints can be added without breaking existing clients.

## what's not in the protocol (yet)

- **Leaderboard** (deepest depths, queen kills) — likely later
- **Recent deaths feed** for the landing page — derived from inscriptions
  table; will probably be a separate GET endpoint when needed
- **Real multiplayer** (chat, presence, shouts) — not planned; would require
  a separate WebSocket service alongside this REST API

## why REST + Cloudflare instead of WebSocket + Rust

This game is single-player at its core. The only shared state is a slow-moving
collection of wall inscriptions. REST + edge cache fits that perfectly:

- No persistent connections to keep alive
- No server costs at our scale (free tier)
- Trivial to deploy and operate
- Trivial to expand additively

A WebSocket architecture would have been the right call for real-time
multiplayer. For asynchronous shared world, this is the right call.
