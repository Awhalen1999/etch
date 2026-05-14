//! The render pipeline. Every outgoing message goes through here.
//!
//! Game logic constructs typed `Message` values; `render_for` turns them into
//! bytes for a specific session. The output forks by transport:
//!
//! - Telnet sessions get ANSI text (line-based, will gain colors + sticky bars).
//! - Browser sessions get JSON events the webapp routes to UI components.
//!
//! Per-player effects (shout corruption, future color, future HUD) live here.

pub mod messages;
pub mod palette;

use rand::Rng;
use serde_json::json;

use crate::session::{Session, TransportKind};
pub use messages::Message;

/// Render a message into bytes for a specific session.
pub fn render_for(session: &Session, msg: &Message) -> String {
    match session.transport {
        TransportKind::Telnet => render_telnet(msg),
        TransportKind::Browser => render_browser(msg),
    }
}

/// Render a message as ANSI-friendly text for a telnet session.
fn render_telnet(msg: &Message) -> String {
    match msg {
        Message::System(text) => format!("{text}\r\n"),
        Message::Said { from_name, text } => format!("[{from_name}]: {text}\r\n"),
        Message::Shouted {
            from_name,
            text,
            distance,
        } => {
            let corrupted = corrupt(text, *distance);
            format!("[{from_name} shouts]: {corrupted}\r\n")
        }
        Message::Private(text) => format!("{text}\r\n"),
        // Telnet HUD will become an ANSI sticky bar; ignored for now.
        Message::Hud { .. } => String::new(),
    }
}

/// Render a message as a JSON event for a browser session. One event per line.
fn render_browser(msg: &Message) -> String {
    let value = match msg {
        Message::System(text) => json!({ "type": "system", "text": text }),
        Message::Said { from_name, text } => json!({
            "type": "said",
            "from_name": from_name,
            "text": text,
        }),
        Message::Shouted {
            from_name,
            text,
            distance,
        } => json!({
            "type": "shouted",
            "from_name": from_name,
            "text": text,
            "distance": distance,
        }),
        Message::Private(text) => json!({ "type": "private", "text": text }),
        Message::Hud {
            name,
            depth,
            stamina,
            max_stamina,
            deepest_depth,
            band,
        } => json!({
            "type": "hud",
            "name": name,
            "depth": depth,
            "stamina": stamina,
            "max_stamina": max_stamina,
            "deepest_depth": deepest_depth,
            "band": band,
        }),
    };
    format!("{value}\n")
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
