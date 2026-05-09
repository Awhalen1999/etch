//! Command parsing and dispatch. The single entry point is `handle_input`,
//! which both transports call into. Unauthenticated players can only log
//! in or get help; everything else is gated behind a successful login.

use sqlx::SqlitePool;

use crate::auth::{self, LoginOutcome};
use crate::render::Message;
use crate::session::{Session, Sessions};

/// Process one line of input from a player.
pub async fn handle_input(
    sessions: &Sessions,
    db: &SqlitePool,
    session: &Session,
    line: &str,
) {
    let line = line.trim();
    if line.is_empty() {
        return;
    }

    if !session.is_authenticated().await {
        handle_unauth(db, session, line).await;
        return;
    }

    handle_auth(sessions, session, line).await;
}

// ---- AUTHENTICATED ----

/// Dispatch input from a logged-in player.
async fn handle_auth(sessions: &Sessions, session: &Session, line: &str) {
    if line == "/who" {
        let n = sessions.count().await;
        session
            .send_message(&Message::Private(format!("{n} connected.")))
            .await;
        return;
    }

    if line.starts_with('/') {
        session
            .send_message(&Message::Private(format!("unknown command: {line}")))
            .await;
        return;
    }

    let from_name = session.name().await.unwrap_or_else(|| "?".into());
    let msg = Message::Said {
        from_name,
        text: line.to_string(),
    };
    sessions.broadcast(&msg).await;
}

// ---- UNAUTHENTICATED ----

/// Dispatch input from a player who hasn't logged in yet.
async fn handle_unauth(db: &SqlitePool, session: &Session, line: &str) {
    if line == "/help" {
        nudge(session).await;
        return;
    }

    if line == "/quit" {
        session.send("goodbye.\r\n").await;
        return;
    }

    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() == 3 && parts[0].eq_ignore_ascii_case("login") {
        attempt_login(db, session, parts[1], parts[2]).await;
        return;
    }

    nudge(session).await;
}

/// Try to log in. Sets the session name on success.
async fn attempt_login(db: &SqlitePool, session: &Session, name: &str, password: &str) {
    match auth::login_or_register(db, name, password).await {
        Ok(LoginOutcome::NewAccount) => {
            session.set_name(name.to_lowercase()).await;
            session
                .send_message(&Message::System(format!(
                    "welcome, {}.",
                    name.to_lowercase()
                )))
                .await;
        }
        Ok(LoginOutcome::Returning) => {
            session.set_name(name.to_lowercase()).await;
            session
                .send_message(&Message::System(format!(
                    "welcome back, {}.",
                    name.to_lowercase()
                )))
                .await;
        }
        Ok(LoginOutcome::WrongPassword) => {
            session
                .send_message(&Message::Private("wrong password.".into()))
                .await;
        }
        Err(e) => {
            session
                .send_message(&Message::Private(format!("{e}")))
                .await;
        }
    }
}

/// Hint at the only command that works pre-login.
async fn nudge(session: &Session) {
    session
        .send_message(&Message::Private("type:  login <name> <password>".into()))
        .await;
}