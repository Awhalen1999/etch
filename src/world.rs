//! Tick loop. One tokio task, once per second, drives all time-based systems:
//! stamina recovery, encounter spawn rolls, inaction checks.

use std::sync::Arc;
use std::time::Duration;

use sqlx::SqlitePool;
use tokio::time::interval;

use crate::encounter;
use crate::item;
use crate::session::Sessions;

/// Stamina recovery: 1 point every N ticks while resting.
/// At 1 tick/sec, this gives the design.md rate of 1-per-2-seconds.
const REST_RECOVERY_TICKS: u32 = 2;

/// Encounter rolls happen every N ticks while resting (every 5 seconds).
const ENCOUNTER_ROLL_TICKS: u32 = 5;

pub const STAMINA_MAX: u32 = 100;

/// Map a depth to its band name. Pure function of depth.
pub fn band_name(depth: u32) -> &'static str {
    match depth {
        0 => "the surface",
        1..=30 => "the dust",
        31..=80 => "the stone",
        81..=120 => "the writing",
        121..=160 => "the damp",
        161..=199 => "the quiet",
        200 => "the queen",
        _ => "unknown",
    }
}

/// Spawn the tick loop as a background task. Runs once per second forever.
pub fn spawn_tick(sessions: Arc<Sessions>, db: SqlitePool) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(1));
        let mut tick_count: u32 = 0;
        loop {
            ticker.tick().await;
            tick_count = tick_count.wrapping_add(1);

            if tick_count % REST_RECOVERY_TICKS == 0 {
                recover_stamina(&sessions, &db).await;
            }

            // Roll for encounters on resting players.
            if tick_count % ENCOUNTER_ROLL_TICKS == 0 {
                for s in sessions.all().await {
                    encounter::try_spawn(&s).await;
                }
            }

            // Check for inaction deaths every tick.
            for s in sessions.all().await {
                encounter::check_inaction(&db, &s).await;
            }
        }
    });
}

/// Walk all sessions and grant +1 stamina to anyone currently resting,
/// up to their cap (STAMINA_MAX plus any stamina-item bonus).
async fn recover_stamina(sessions: &Sessions, db: &SqlitePool) {
    for s in sessions.all().await {
        let Some(state) = s.player().await else {
            continue;
        };
        if !state.resting {
            continue;
        }
        let Some(name) = s.name().await else {
            continue;
        };
        let cap = STAMINA_MAX + item::stamina_bonus(db, &name).await;
        let _ = s
            .update_player(|st| {
                if st.resting && st.stamina < cap {
                    st.stamina += 1;
                }
            })
            .await;
    }
}
