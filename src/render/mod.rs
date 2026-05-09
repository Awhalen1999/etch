//! The render pipeline. Every outgoing message goes through here.
//!
//! In-game events are represented as typed `Message` values. When a
//! `Message` needs to reach a specific player, `render_for` converts it
//! into the bytes that player's terminal should display, applying any
//! per-player effects (color, distance corruption, HUD adjustments, etc.).
//!
//! Right now this is a thin pass-through. As features land, this is
//! the one place transformations get added.

pub mod messages;

use crate::session::Session;
pub use messages::Message;

/// Render a message into bytes for a specific session.
///
/// This is the single place where typed events become text. Every
/// per-player transformation lives here.
pub fn render_for(_session: &Session, msg: &Message) -> String {
    match msg {
        // system messages
        Message::System(text) => format!("{text}\r\n"),
        // player messages
        Message::Said { from_id, text } => {
            format!("[{from_id}]: {text}\r\n")
        }
        // private messages
        Message::Private(text) => format!("{text}\r\n"),
    }
}