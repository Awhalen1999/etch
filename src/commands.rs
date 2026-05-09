use crate::session::{Session, Sessions};

/// Process a line of player input. Both transports call into this.
pub async fn handle_input(sessions: &Sessions, session: &Session, line: &str) {
    let line = line.trim();

    if line.is_empty() {
        return;
    }

    if line == "/who" {
        let n = sessions.count().await;
        session.send(format!("{n} connected.\r\n")).await;
    } else {
        let msg = format!("[{}]: {}\r\n", session.id, line);
        sessions.broadcast(&msg).await;
    }
}