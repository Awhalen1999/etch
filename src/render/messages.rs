//! Typed events that flow through the render pipeline.
//!
//! Code that wants to send something to a player builds a `Message` and
//! lets the renderer turn it into bytes. Keeps presentation concerns
//! out of game logic.

#[derive(Debug, Clone)]
pub enum Message {
    /// A server-generated line (welcome banners, system notices).
    System(String),

    /// Another player said something.
    Said {
        from_name: String,
        text: String,
    },

    /// A shout from another player. Corrupted by distance.
    Shouted {
        from_name: String,
        text: String,
        distance: u32,
    },

    /// A private response only the recipient sees (e.g. /who output).
    Private(String),

    /// Snapshot of the player's persistent state for HUD rendering.
    /// Browser routes to the HUD region; telnet ignores (future: ANSI sticky bar).
    Hud {
        name: String,
        depth: u32,
        stamina: u32,
        max_stamina: u32,
        deepest_depth: u32,
        band: String,
    },
}