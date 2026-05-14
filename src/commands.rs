//! Command parsing and dispatch.

use sqlx::SqlitePool;

use crate::auth::{self, LoginOutcome};
use crate::encounter;
use crate::item;
use crate::render::Message;
use crate::session::{Session, Sessions};
use crate::world::{self, STAMINA_MAX};

/// Plain text reaches only players at the same depth.
const SPEECH_RANGE: u32 = 0;

const COST_DOWN: u32 = 4;
const COST_UP: u32 = 8;
const MAX_MARK_LEN: usize = 240;
const SHOUT_RANGE: u32 = 20;

/// Maximum length of a single input line. Anything longer is silently dropped.
const MAX_INPUT_LEN: usize = 1000;

/// Process one line of input from a player.
pub async fn handle_input(
    sessions: &Sessions,
    db: &SqlitePool,
    session: &Session,
    line: &str,
) {
    if line.len() > MAX_INPUT_LEN {
        return;
    }
    let line = line.trim();
    if line.is_empty() {
        return;
    }

    if !session.is_authenticated().await {
        handle_unauth(sessions, db, session, line).await;
        return;
    }

    handle_auth(sessions, db, session, line).await;
}

// ---- AUTHENTICATED ----

/// Dispatch input from a logged-in player.
async fn handle_auth(sessions: &Sessions, db: &SqlitePool, session: &Session, line: &str) {
    match line {
        "/who" => cmd_who(sessions, session).await,
        "/down" => cmd_down(db, session).await,
        "/up" => cmd_up(session).await,
        "/rest" => cmd_rest(session).await,
        "/fight" => encounter::fight(session).await,
        "/strike" => encounter::strike(db, session).await,
        "/brace" => encounter::brace(db, session).await,
        "/escape" => encounter::escape(session).await,
        "/me" => cmd_me(db, session).await,
        "/read" => cmd_read(db, session).await,
        l if l.starts_with("/mark ") => cmd_mark(db, session, &l[6..]).await,
        "/mark" => {
            session
                .send_message(&Message::Private("carve what?".into()))
                .await;
        }
        l if l.starts_with("/shout ") => cmd_shout(sessions, session, &l[7..]).await,
        "/shout" => {
            session
                .send_message(&Message::Private("shout what?".into()))
                .await;
        }
        l if l.starts_with("/take") => cmd_take(db, session).await,
        l if l.starts_with("/drop ") => cmd_drop(db, session, &l[6..]).await,
        "/drop" => {
            session
                .send_message(&Message::Private("drop what?".into()))
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

/// Descend one level. Costs stamina, respects cooldown. Rolls for item spawn.
async fn cmd_down(db: &SqlitePool, session: &Session) {
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
        *session.pending_item.write().await = None;
        item::try_spawn(db, session, s.depth).await;
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
        *session.pending_item.write().await = None;
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

/// Display character sheet with inventory.
async fn cmd_me(db: &SqlitePool, session: &Session) {
    let Some(state) = session.player().await else {
        return;
    };
    let Some(name) = session.name().await else {
        return;
    };
    let band = world::band_name(state.depth);
    let stam_bonus = item::stamina_bonus(db, &name).await;
    let max = STAMINA_MAX + stam_bonus;

    let mut lines = format!(
        "{name}\r\ndepth {depth} · {band}\r\nstamina {stam}/{max}\r\ndeepest {deep}",
        depth = state.depth,
        stam = state.stamina,
        deep = state.deepest_depth,
    );

    let items = item::load(db, &name).await;
    if items.is_empty() {
        lines.push_str("\r\ncarrying: nothing");
    } else {
        lines.push_str("\r\ncarrying:");
        for item_id in &items {
            if let Some(def) = item::find(item_id) {
                let stat_label = match def.category {
                    item::Category::Attack => format!("+{} attack", def.stat),
                    item::Category::Defense => format!("-{} damage taken", def.stat),
                    item::Category::Stamina => format!("+{} max stamina", def.stat),
                };
                lines.push_str(&format!("\r\n  {} ({})", def.name, stat_label));
            }
        }
        let empty = item::INVENTORY_SIZE - items.len();
        if empty > 0 {
            lines.push_str(&format!("\r\n  {empty} empty slot{}", if empty == 1 { "" } else { "s" }));
        }
    }

    session.send_message(&Message::Private(lines)).await;
}

/// Save state and return to the login prompt.
async fn cmd_quit(db: &SqlitePool, session: &Session) {
    let Some(name) = session.name().await else {
        return;
    };
    if let Some(state) = session.player().await {
        let _ = auth::save_state(db, &name, &state).await;
    }
    session.clear_auth().await;
    session.send("goodbye.\r\ntype: login <name> <password>\r\n").await;
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

/// Pick up the pending item at this depth.
async fn cmd_take(db: &SqlitePool, session: &Session) {
    let Some(name) = session.name().await else {
        return;
    };

    let pending = session.pending_item.read().await.clone();
    let Some(item_id) = pending else {
        session
            .send_message(&Message::Private("there is nothing here to take.".into()))
            .await;
        return;
    };

    let Some(def) = item::find(&item_id) else {
        return;
    };

    if !item::add(db, &name, &item_id).await {
        session
            .send_message(&Message::Private("your hands are full. 5 items max.".into()))
            .await;
        return;
    }

    *session.pending_item.write().await = None;
    session
        .send_message(&Message::System(format!("you pick up the {}.", def.name)))
        .await;
}

/// Drop an item by name.
async fn cmd_drop(db: &SqlitePool, session: &Session, input: &str) {
    let input = input.trim().to_lowercase();
    let Some(name) = session.name().await else {
        return;
    };

    // Find matching item definition by name.
    let Some(def) = item::ITEMS.iter().find(|i| i.name == input) else {
        session
            .send_message(&Message::Private("you don't have that.".into()))
            .await;
        return;
    };

    if !item::remove(db, &name, def.id).await {
        session
            .send_message(&Message::Private("you don't have that.".into()))
            .await;
        return;
    }

    session
        .send_message(&Message::System(format!("you drop the {}. it's gone.", def.name)))
        .await;
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

/// Shout to players within ±SHOUT_RANGE depths. Corrupted by distance.
async fn cmd_shout(sessions: &Sessions, session: &Session, text: &str) {
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    let Some(state) = session.player().await else {
        return;
    };
    let Some(name) = session.name().await else {
        return;
    };
    sessions
        .broadcast_shout(state.depth, SHOUT_RANGE, &name, text)
        .await;
}

/// Shared movement gate. Returns true if the player may move now.
async fn precheck_movement(session: &Session) -> bool {
    if session.in_encounter().await {
        session
            .send_message(&Message::Private("/fight or /escape.".into()))
            .await;
        return false;
    }

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

async fn handle_unauth(sessions: &Sessions, db: &SqlitePool, session: &Session, line: &str) {
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
        attempt_login(sessions, db, session, parts[1], parts[2]).await;
        return;
    }

    nudge(session).await;
}

async fn attempt_login(
    sessions: &Sessions,
    db: &SqlitePool,
    session: &Session,
    name: &str,
    password: &str,
) {
    let logged_in = match auth::login_or_register(db, name, password).await {
        Ok(LoginOutcome::NewAccount(state)) => {
            session.set_name(name.to_lowercase()).await;
            session.set_player(state).await;
            session
                .send_message(&Message::System(format!(
                    "welcome, {}. you are at the surface.",
                    name.to_lowercase()
                )))
                .await;
            true
        }
        Ok(LoginOutcome::Returning(state)) => {
            // Kick any existing session for this account.
            kick_duplicate(sessions, db, &name.to_lowercase()).await;

            session.set_name(name.to_lowercase()).await;
            session.set_player(state.clone()).await;
            session
                .send_message(&Message::System(format!(
                    "welcome back, {}. you are at depth {}.",
                    name.to_lowercase(),
                    state.depth
                )))
                .await;
            true
        }
        Ok(LoginOutcome::WrongPassword) => {
            session
                .send_message(&Message::Private("wrong password.".into()))
                .await;
            false
        }
        Err(e) => {
            session
                .send_message(&Message::Private(format!("{e}")))
                .await;
            false
        }
    };

    if logged_in {
        session.send_hud(db).await;
    }
}

/// If another session is logged in as this name, save its state and kick it.
async fn kick_duplicate(sessions: &Sessions, db: &SqlitePool, name: &str) {
    if let Some(old) = sessions.find_by_name(name).await {
        if let Some(state) = old.player().await {
            let _ = auth::save_state(db, name, &state).await;
        }
        old.send_message(&Message::System("logged in from another session.".into()))
            .await;
        old.clear_auth().await;
        old.send("type: login <name> <password>\r\n").await;
    }
}

async fn nudge(session: &Session) {
    session
        .send_message(&Message::Private("type:  login <name> <password>".into()))
        .await;
}