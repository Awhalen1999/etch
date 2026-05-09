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

    /// A private response only the recipient sees (e.g. /who output).
    Private(String),
}