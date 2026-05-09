use crate::render::Message;
use crate::session::{Session, Sessions};

pub async fn handle_input(sessions: &Sessions, session: &Session, line: &str) {
    let line = line.trim();

    if line.is_empty() {
        return;
    }

    if line == "/who" {
        let n = sessions.count().await;
        session
            .send_message(&Message::Private(format!("{n} connected.")))
            .await;
    } else {
        let msg = Message::Said {
            from_id: session.id,
            text: line.to_string(),
        };
        sessions.broadcast(&msg).await;
    }
}