# etch — API protocol

The contract between the CLI client and the etch API. HTTPS, REST, JSON.

**Production URL:** `https://api.etch.rip` (eventual; DNS alias).
**Currently deployed at:** `https://etch-api.awhalendev.workers.dev`.
The CLI reads `ETCH_API_URL` to override the base for local dev against
`wrangler dev`.

The game runs entirely locally; this API exists **only for the shared
inscription layer** (the wall-carvings every player can see).

## endpoints

### `GET /`

Sanity-check root. Returns `"etch api\n"` as `text/plain`. Useful for
liveness probes and `curl`-eyeballing the worker.

---

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

**Response 400 (validation):**
```json
{ "error": "name must be 3-32 characters" }
```

Other 400 messages: `"name can only contain lowercase letters, digits, and underscore"`,
`"that name is reserved"`, `"name required"`, `"invalid json"`.

**Response 409 (name taken):**
```json
{ "error": "name taken" }
```

Validation rules (server-side):

- `name` is trimmed and lowercased before storage
- `^[a-z0-9_]+$`
- 3 ≤ length ≤ 32
- not in the reserved list: `system`, `admin`, `etch`, `horris`, `server`,
  `owner`, `mod`, `moderator`, `root`, `keeper`, `null`, `none`, `nobody`,
  `anonymous`, `bot`

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

**Response 200:** the **full updated list** of inscriptions (most-recent
first), so the client can replace its local cache wholesale. Response
includes a fresh `ETag` header.

```json
[
    { "id": 2, "name": "vega", "depth": 152, "text": "...",
      "written_at": "2026-05-16T..." },
    { "id": 1, "name": "alex", "depth": 88,
      "text": "alex fell here. 2026-05-14.", "written_at": "2026-05-14T..." }
]
```

**Response 400 (validation):**
```json
{ "error": "text must be 240 characters or fewer" }
```

Other 400 messages: `"depth must be 0-200"`, `"depth must be an integer"`,
`"text is empty"`, `"depth required"`, `"text required"`, `"invalid json"`.

**Response 401 (bad token or missing credentials):**
```json
{ "error": "unauthorized" }
```

(Also `"missing credentials"` if `name` or `token` is missing.)

Validation rules (server-side):

- `text` ≤ 240 chars (matches `/mark` cap), trimmed before save, non-empty
- `depth` integer in 0-200 (0 is the post-queen surface)
- `name` matches the token's owner

---

### `GET /api/inscriptions`

Fetch the full list. Called once at launch and periodically (~every 5 min)
while playing.

**Request:** no body. Optionally include `If-None-Match: <etag>` to get a
304 when nothing changed.

**Response 200:**
```json
[
    { "id": 2, "name": "vega", "depth": 152, "text": "...", "written_at": "..." },
    { "id": 1, "name": "alex", "depth": 88,  "text": "...", "written_at": "..." }
]
```

Sorted by `written_at DESC` (most recent first).

Response headers include `ETag: "<count>-<max_id>"` and
`Cache-Control: public, max-age=30`.

**Response 304:** empty body. Client keeps using its cached data.

---

### CORS

All routes set:

```
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: content-type, if-none-match
```

`OPTIONS` preflight returns 204 with the headers above. Reads are intended
to be embeddable from the landing page (e.g., live inscription feed).

---

## design principles

- **Server is the source of truth.** Client never invents data.
- **Single source of truth in responses.** `POST /api/inscriptions` returns
  the full updated list; client replaces its cache wholesale. No
  client-side merge logic.
- **Edge caching does most of the work.** `GET /api/inscriptions` cached for
  30s at Cloudflare's edge — concurrent fetches share one Worker invocation.
- **Cheap ETag.** The list endpoint computes the ETag from `COUNT(*)` and
  `MAX(id)` before fetching rows — a `304` response never touches the row data.
- **Offline-tolerant.** The game works fine if the API is unreachable. The
  CLI ships an `inscriptions.json` cache and falls back to it silently
  (`Result<T>` returns `{ ok: false, error: "the wall is silent." }` on
  network failure).
- **Additive.** New endpoints can be added without breaking existing clients.

## what's not in the protocol (yet)

- **Leaderboard** (deepest depths, queen kills) — likely later
- **Recent deaths feed** for the landing page — derived from the
  `inscriptions` table; will probably be a separate `GET` endpoint when needed
- **Real multiplayer** (chat, presence, shouts) — not planned; would require
  a separate WebSocket service alongside this REST API

## why REST + Cloudflare instead of WebSocket + Rust

This game is single-player at its core. The only shared state is a
slow-moving collection of wall inscriptions. REST + edge cache fits that
perfectly:

- No persistent connections to keep alive
- No server costs at our scale (free tier)
- Trivial to deploy and operate
- Trivial to expand additively

A WebSocket architecture would have been the right call for real-time
multiplayer. For an asynchronous shared world, this is the right call.
