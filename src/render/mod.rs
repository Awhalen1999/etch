//! The render pipeline. Every outgoing message goes through here.
//!
//! Game logic constructs typed `Message` values; `render_for` turns them
//! into bytes for a specific session, applying per-player effects (color,
//! corruption, hud, psychosis). Right now this is a thin pass-through —
//! effects land here as features ship.

pub mod messages;

use rand::Rng;

use crate::session::Session;
pub use messages::Message;

/// Render a message into bytes for a specific session.
pub fn render_for(_session: &Session, msg: &Message) -> String {
    match msg {
        Message::System(text) => format!("{text}\r\n"),
        Message::Said { from_name, text } => format!("[{from_name}]: {text}\r\n"),
        Message::Shouted { from_name, text, distance } => {
            let corrupted = corrupt(text, *distance);
            format!("[{from_name} shouts]: {corrupted}\r\n")
        }
        Message::Private(text) => format!("{text}\r\n"),
    }
}

/// Replace characters with noise based on distance. Farther = more corruption.
fn corrupt(text: &str, distance: u32) -> String {
    if distance == 0 {
        return text.to_string();
    }
    let ratio = (distance as f32 / 20.0).min(1.0);
    let mut rng = rand::thread_rng();
    text.chars()
        .map(|c| {
            if c == ' ' || rng.gen::<f32>() > ratio {
                c
            } else {
                '.'
            }
        })
        .collect()
}