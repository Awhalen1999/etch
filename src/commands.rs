//! Command parsing and dispatch.

use sqlx::SqlitePool;

use crate::auth::{self, LoginOutcome};
use crate::render::Message;
use crate::session::{Session, Sessions};

/// Plain text reaches only players at the same depth.
const SPEECH_RANGE: u32 = 0;

const COST_DOWN: u32 = 4;
const COST_UP: u32 = 8;
const MAX_MARK_LEN: usize = 240;

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

    handle_auth(sessions, db, session, line).await;
}

// ---- AUTHENTICATED ----

/// Dispatch input from a logged-in player.
async fn handle_auth(sessions: &Sessions, db: &SqlitePool, session: &Session, line: &str) {
    match line {
        "/who" => cmd_who(sessions, session).await,
        "/down" => cmd_down(session).await,
        "/up" => cmd_up(session).await,
        "/rest" => cmd_rest(session).await,
        "/read" => cmd_read(db, session).await,
        l if l.starts_with("/mark ") => cmd_mark(db, session, &l[6..]).await,
        "/mark" => {
            session
                .send_message(&Message::Private("carve what?".into()))
                .await;
        }
        "/quit" => cmd_quit(db, session).await,
        l if l.starts_with('/') => {
            session
                .send_message(&Message::Private(format!("unknown command: {l}")))
                .await;
        }
        _ => cmd_speak(sessions, session, line).await,
    }
}

/// Show the count of currently connected players.
async fn cmd_who(sessions: &Sessions, session: &Session) {
    let n = sessions.count().await;
    session
        .send_message(&Message::Private(format!("{n} connected.")))
        .await;
}

/// Descend one level. Costs stamina, respects cooldown.
async fn cmd_down(session: &Session) {
    if !precheck_movement(session).await {
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    if state.stamina < COST_DOWN {
        session
            .send_message(&Message::Private("you don't have the strength.".into()))
            .await;
        return;
    }

    let new = session
        .update_player(|s| {
            s.stamina -= COST_DOWN;
            s.depth += 1;
            if s.depth > s.deepest_depth {
                s.deepest_depth = s.depth;
            }
        })
        .await;

    if let Some(s) = new {
        session
            .send_message(&Message::System(format!(
                "you descend to depth {}.",
                s.depth
            )))
            .await;
        session.mark_moved().await;
    }
}

/// Ascend one level. Costs more stamina than descending.
async fn cmd_up(session: &Session) {
    if !precheck_movement(session).await {
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    if state.depth <= 1 {
        session
            .send_message(&Message::Private(
                "the lip overhangs. no climbing back.".into(),
            ))
            .await;
        return;
    }

    if state.stamina < COST_UP {
        session
            .send_message(&Message::Private(
                "you don't have the strength to climb.".into(),
            ))
            .await;
        return;
    }

    let new = session
        .update_player(|s| {
            s.stamina -= COST_UP;
            s.depth -= 1;
        })
        .await;

    if let Some(s) = new {
        let msg = format!("you climb to depth {}.", s.depth);
        session.send_message(&Message::System(msg)).await;
        session.mark_moved().await;
    }
}

/// Toggle resting. While resting, the tick loop grants +1 stamina periodically.
async fn cmd_rest(session: &Session) {
    let new = session
        .update_player(|s| {
            s.resting = !s.resting;
        })
        .await;

    if let Some(s) = new {
        let msg = if s.resting {
            "you sit. your back finds the wall."
        } else {
            "you stand."
        };
        session.send_message(&Message::System(msg.into())).await;
    }
}

/// Save state and disconnect.
async fn cmd_quit(db: &SqlitePool, session: &Session) {
    let Some(name) = session.name().await else {
        return;
    };
    if let Some(state) = session.player().await {
        let _ = auth::save_state(db, &name, &state).await;
    }
    session.send("goodbye.\r\n").await;
}

/// Carve an inscription at the player's current depth.
async fn cmd_mark(db: &SqlitePool, session: &Session, text: &str) {
    let text = text.trim();
    if text.is_empty() {
        session
            .send_message(&Message::Private("carve what?".into()))
            .await;
        return;
    }
    if text.len() > MAX_MARK_LEN {
        session
            .send_message(&Message::Private(
                "too much to carve. 240 characters max.".into(),
            ))
            .await;
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };
    let Some(name) = session.name().await else {
        return;
    };

    let depth = state.depth as i64;
    let _ = sqlx::query(
        "INSERT INTO inscriptions (author_name, depth, text) VALUES (?, ?, ?)",
    )
    .bind(&name)
    .bind(depth)
    .bind(text)
    .execute(db)
    .await;

    session
        .send_message(&Message::System("you carve into the wall.".into()))
        .await;
}

/// Read all inscriptions at the player's current depth.
async fn cmd_read(db: &SqlitePool, session: &Session) {
    let Some(state) = session.player().await else {
        return;
    };

    let depth = state.depth as i64;
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT author_name, text, date(written_at) FROM inscriptions WHERE depth = ? ORDER BY written_at",
    )
    .bind(depth)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        session
            .send_message(&Message::Private("the walls are bare.".into()))
            .await;
        return;
    }

    for (author, text, date) in &rows {
        session
            .send_message(&Message::System(format!("{author} ({date}): {text}")))
            .await;
    }
}

/// Broadcast plain text to climbers within SPEECH_RANGE.
async fn cmd_speak(sessions: &Sessions, session: &Session, text: &str) {
    let Some(state) = session.player().await else {
        return;
    };
    let Some(name) = session.name().await else {
        return;
    };
    let msg = Message::Said {
        from_name: name,
        text: text.to_string(),
    };
    sessions.broadcast_at(state.depth, SPEECH_RANGE, &msg).await;
}

/// Shared movement gate. Returns true if the player may move now.
async fn precheck_movement(session: &Session) -> bool {
    if session.movement_on_cooldown().await {
        session
            .send_message(&Message::Private("you need to catch your breath.".into()))
            .await;
        return false;
    }

    if let Some(state) = session.player().await {
        if state.resting {
            session
                .send_message(&Message::Private("you are resting. /rest to stand.".into()))
                .await;
            return false;
        }
    }

    true
}

// ---- UNAUTHENTICATED ----

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

async fn attempt_login(db: &SqlitePool, session: &Session, name: &str, password: &str) {
    match auth::login_or_register(db, name, password).await {
        Ok(LoginOutcome::NewAccount(state)) => {
            session.set_name(name.to_lowercase()).await;
            session.set_player(state).await;
            session
                .send_message(&Message::System(format!(
                    "welcome, {}. you are at the surface.",
                    name.to_lowercase()
                )))
                .await;
        }
        Ok(LoginOutcome::Returning(state)) => {
            session.set_name(name.to_lowercase()).await;
            session.set_player(state.clone()).await;
            session
                .send_message(&Message::System(format!(
                    "welcome back, {}. you are at depth {}.",
                    name.to_lowercase(),
                    state.depth
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

async fn nudge(session: &Session) {
    session
        .send_message(&Message::Private("type:  login <name> <password>".into()))
        .await;
}