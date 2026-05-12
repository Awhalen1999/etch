//! Death and respawn logic.
//!
//! Called by encounters, the queen fight, and inaction timeouts.
//! Carves a death inscription, resets the player to depth 1, and
//! sends a death message.

use chrono::Utc;
use sqlx::SqlitePool;

use crate::render::Message;
use crate::session::Session;
use crate::world::STAMINA_MAX;

/// Kill the player. Carves a death inscription, resets state, notifies them.
pub async fn die(db: &SqlitePool, session: &Session) {
    let Some(state) = session.player().await else {
        return;
    };
    let Some(name) = session.name().await else {
        return;
    };

    // Carve death inscription at the depth they died.
    let date = Utc::now().format("%Y-%m-%d").to_string();
    let text = format!("{name} fell here. {date}.");
    let depth = state.depth as i64;
    let _ = sqlx::query(
        "INSERT INTO inscriptions (author_name, depth, text) VALUES (?, ?, ?)",
    )
    .bind(&name)
    .bind(depth)
    .bind(&text)
    .execute(db)
    .await;

    // Reset player to depth 1 with full stamina.
    session
        .update_player(|s| {
            s.depth = 1;
            s.stamina = STAMINA_MAX;
            s.resting = false;
        })
        .await;

    session
        .send_message(&Message::System("you died.".into()))
        .await;
    session
        .send_message(&Message::System(format!(
            "you wake at depth 1. stamina {STAMINA_MAX}/{STAMINA_MAX}."
        )))
        .await;
}
