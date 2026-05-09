# etch — technical reference

## stack

rust 2021, tokio, axum, sqlx + sqlite, argon2, xterm.js. single binary, deploys to fly.io.

## transports

- tcp:4000 for telnet
- http:8080 for browser (websocket at `/ws`, html at `/`)

both feed the same session abstraction. game logic doesn't know which transport a player is on.

## architecture
tcp ──┐
├─→ sessions ─→ commands ─→ render ─→ channel ─→ socket
ws  ──┘

each connection registers a `Session` (id + outgoing channel). a writer task pumps the channel into the socket. game logic only touches `Session` and `Sessions`.

## render pipeline

every outgoing message goes through `render_for(session, message) -> bytes`.

game code constructs typed `Message` values. `render_for` turns them into bytes per recipient. all per-player effects (corruption, color, hud, psychosis) live here.

## modules
src/
├── main.rs           entry + listeners
├── session.rs        Session, Sessions
├── commands.rs       parsing + dispatch
└── render/
├── mod.rs        render_for
└── messages.rs   Message enum

more modules land as features go in (world, db, auth, stamina, inscriptions, encounters).

## persistence

sqlite via sqlx. one file. migrations in `migrations/`.

planned tables: `accounts`, `inscriptions`, `items`.

what persists: account, depth, stamina, inscriptions, items, deepest, psychosis, bottom flag.
what doesn't: online status, active climbs, encounter state.

## tick loop

one tokio task, one tick per second. handles climbs, rest, psychosis, encounters, ambient.

## auth

one command: `login <name> <password>`. creates the account if new, verifies if existing. argon2 hashes. logout = connection close. account state preserved exactly.

## anti-cheese

- logout during encounter or escape = death
- logout doesn't recover stamina or clear psychosis
- depth and stamina persist exactly across sessions

logging out is a pause, not a reset.

## deploy

fly.io, yyz region. dockerfile. volume at `/data` for sqlite. two services exposed.

## conventions

- `anyhow::Result` for app code, `thiserror` at module boundaries
- `tracing` for logging, filtered by `RUST_LOG`
- prefer `&str` in signatures
- no `unwrap()` outside tests
- typed `Message` values flow through the game; raw strings only at the edge