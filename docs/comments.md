# Agents

## Comment Convention

### Doc comments (`///`)

Required on every public function, method, struct, enum, and trait.
Keep to one line when possible. Describe *what* it does, not *how*.

```rust
/// Send a message to this player. Silently drops if disconnected.
pub async fn send(&self, msg: impl Into<String>) {
```

For enum variants, doc each variant inline:

```rust
pub enum Message {
    /// A system-generated line (welcome banners, server notices, etc.).
    System(String),
}
```

Multi-line doc comments are fine when a variant or field needs extra
context. Use `///` on consecutive lines, not `/** */`.

### Module-level docs (`//!`)

Use `//!` at the top of a file to explain the module's purpose and how
it fits into the larger system. Keep it brief — a few lines max.

```rust
//! Typed events that flow through the render pipeline.
//!
//! Code that wants to send something to a player builds a `Message`
//! and lets the renderer turn it into bytes.
```

### Section dividers

Use `// ---- LABEL ----` to separate logical sections within a file.
All-caps label, four dashes each side.

```rust
// ---- TCP ----

// ---- HTTP + WebSocket ----
```

### Inline comments (`//`)

Use sparingly. Only when the *why* isn't obvious from the code.
No comments that restate what the code does.

```rust
// good — explains a non-obvious choice
let (tx, rx) = mpsc::channel::<String>(64); // buffer enough to avoid backpressure under normal load

// bad — restates the code
let id = *next; // get the id
```

### What NOT to comment

- Imports
- Obvious control flow
- Closing braces
- TODO/FIXME without a tracked issue
