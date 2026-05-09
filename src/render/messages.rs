//! Typed events that flow through the render pipeline.
//!
//! Code that wants to send something to a player builds a `Message`
//! and lets the renderer turn it into bytes. This keeps presentation
//! concerns (color, corruption, HUD) out of game logic.

use crate::session::SessionId;

#[derive(Debug, Clone)]
pub enum Message {
    /// A system-generated line (welcome banners, server notices, etc.).
    System(String),

    /// Another player said something. The renderer decides how to
    /// display it based on who's receiving.
    Said {
        from_id: SessionId,
        text: String,
    },

    /// A private response only the recipient sees (e.g., /who output).
    Private(String),
}