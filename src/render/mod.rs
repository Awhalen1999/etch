//! The render pipeline. Every outgoing message goes through here.
//!
//! Game logic constructs typed `Message` values; `render_for` turns them
//! into bytes for a specific session, applying per-player effects (color,
//! corruption, hud, psychosis). Right now this is a thin pass-through —
//! effects land here as features ship.

pub mod messages;

use crate::session::Session;
pub use messages::Message;

/// Render a message into bytes for a specific session.
pub fn render_for(_session: &Session, msg: &Message) -> String {
    match msg {
        Message::System(text) => format!("{text}\r\n"),
        Message::Said { from_name, text } => format!("[{from_name}]: {text}\r\n"),
        Message::Private(text) => format!("{text}\r\n"),
    }
}