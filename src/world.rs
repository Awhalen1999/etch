//! In-memory world state and the global tick loop.
//!
//! `WorldState` will hold shared, non-per-session data (inscriptions,
//! item locations, encounter state). Currently empty — placeholder.
//!
//! `spawn_tick` runs forever, once per second, advancing all
//! time-driven systems. Currently handles stamina recovery; will
//! also handle encounter rolls, psychosis, ambient effects, item
//! spawning.

use std::sync::Arc;
use std::time::Duration;

use sqlx::SqlitePool;
use tokio::time::interval;

use crate::encounter;
use crate::session::Sessions;

/// Stamina recovery: 1 point every N ticks while resting.
/// At 1 tick/sec, this gives the design.md rate of 1-per-2-seconds.
const REST_RECOVERY_TICKS: u32 = 2;

/// Encounter rolls happen every N ticks while resting (every 5 seconds).
const ENCOUNTER_ROLL_TICKS: u32 = 5;

pub const STAMINA_MAX: u32 = 100;

/// Shared, mutable world state. Empty for now.
#[derive(Default)]
pub struct WorldState {
    // Future: inscriptions cache, item locations, encounter state, etc.
}

impl WorldState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }
}

/// Spawn the tick loop as a background task. Runs once per second forever.
pub fn spawn_tick(sessions: Arc<Sessions>, _world: Arc<WorldState>, db: SqlitePool) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(1));
        let mut tick_count: u32 = 0;
        loop {
            ticker.tick().await;
            tick_count = tick_count.wrapping_add(1);

            if tick_count % REST_RECOVERY_TICKS == 0 {
                recover_stamina(&sessions).await;
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

/// Walk all sessions and grant +1 stamina to anyone currently resting.
async fn recover_stamina(sessions: &Sessions) {
    for s in sessions.all().await {
        let _ = s
            .update_player(|state| {
                if state.resting && state.stamina < STAMINA_MAX {
                    state.stamina += 1;
                }
            })
            .await;
    }
}