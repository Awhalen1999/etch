//! Enemy encounter system.
//!
//! Encounters are per-player and ephemeral. While resting below depth 40,
//! the tick loop rolls for a spawn. Once active, the player must /fight
//! (enter combat) or /escape. Combat is round-based: each round the player
//! reads a telegraph and chooses /strike or /brace.

use std::time::Duration;

use rand::Rng;
use sqlx::SqlitePool;

use crate::death;
use crate::render::Message;
use crate::session::Session;

/// No encounters above this depth.
const ENCOUNTER_MIN_DEPTH: u32 = 40;

/// Seconds of inaction before the enemy kills you.
const INACTION_LIMIT: Duration = Duration::from_secs(15);

/// Stamina cost for /escape.
const ESCAPE_COST: u32 = 30;

/// Stamina cost per combat action (/strike or /brace).
const ACTION_COST: u32 = 5;

/// Base damage per successful strike.
const BASE_STRIKE_DAMAGE: u32 = 50;

/// Stamina damage taken on a wrong strike.
const WRONG_STRIKE_PENALTY: u32 = 40;

// ---- Telegraphs ----

/// Telegraphs shown when the enemy is attacking (player should /brace).
const TELEGRAPH_ATTACKING: &[&str] = &[
    "it lowers its head and charges.",
    "it lunges at you. fast.",
    "its mandibles snap open. it rushes forward.",
    "it coils and springs toward you.",
    "it clicks rapidly and surges at you.",
    "it throws its weight at you.",
];

/// Telegraphs shown when the enemy is open (player should /strike).
const TELEGRAPH_OPEN: &[&str] = &[
    "it hesitates. its legs buckle.",
    "it turns sideways. you see an opening.",
    "it backs away. antennae twitching.",
    "it stumbles. off balance.",
    "its movements slow. it's exposed.",
    "it pauses. watching you.",
];

/// Ambiguous telegraphs (used at deeper levels). Could be either.
const TELEGRAPH_AMBIGUOUS: &[&str] = &[
    "it moves.",
    "something shifts.",
    "you can't read it.",
    "it changes stance.",
];

/// Roll for an encounter on a resting player. Called from the tick loop.
pub async fn try_spawn(session: &Session) {
    if session.in_encounter().await {
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    if !state.resting || state.depth <= ENCOUNTER_MIN_DEPTH {
        return;
    }

    let chance = encounter_chance(state.depth);
    let roll: f32 = rand::thread_rng().gen();
    if roll >= chance {
        return;
    }

    session.start_encounter().await;
    session
        .send_message(&Message::System("something moves in the dark.".into()))
        .await;
    session
        .send_message(&Message::System("/fight to engage. /escape to run.".into()))
        .await;
}

/// Check for inaction death. Called from the tick loop.
pub async fn check_inaction(db: &SqlitePool, session: &Session) {
    if let Some(elapsed) = session.encounter_elapsed().await {
        if elapsed >= INACTION_LIMIT {
            session
                .send_message(&Message::System("you waited too long.".into()))
                .await;
            session.end_encounter().await;
            death::die(db, session).await;
        }
    }
}

/// Player enters combat (/fight). Sets up enemy HP and sends first telegraph.
pub async fn fight(session: &Session) {
    if !session.in_encounter().await {
        session
            .send_message(&Message::Private("there is nothing to fight.".into()))
            .await;
        return;
    }

    if session.in_combat().await {
        session
            .send_message(&Message::Private("you are already fighting. /strike or /brace.".into()))
            .await;
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    let hp = enemy_hp(state.depth);
    session.enter_combat(hp).await;

    session
        .send_message(&Message::System(format!("you engage. enemy HP: {hp}/{hp}")))
        .await;

    send_telegraph(session, state.depth).await;
}

/// Player strikes during combat.
pub async fn strike(db: &SqlitePool, session: &Session) {
    if !session.in_combat().await {
        session
            .send_message(&Message::Private("there is nothing to strike.".into()))
            .await;
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    if state.stamina < ACTION_COST {
        session
            .send_message(&Message::Private("you don't have the strength.".into()))
            .await;
        return;
    }

    session.reset_encounter_timer().await;
    session.update_player(|s| s.stamina -= ACTION_COST).await;

    let enemy_attacks = rand::thread_rng().gen_bool(0.5);

    if enemy_attacks {
        // Wrong call. Player takes damage, deals none.
        let penalty = WRONG_STRIKE_PENALTY; // TODO: reduce by defense items
        session
            .update_player(|s| s.stamina = s.stamina.saturating_sub(penalty))
            .await;
        session
            .send_message(&Message::System(format!(
                "it's faster. it hits you. stamina -{penalty}."
            )))
            .await;

        // Check if player died from the hit.
        let new_state = session.player().await;
        if new_state.is_some_and(|s| s.stamina == 0) {
            session
                .send_message(&Message::System("you collapse.".into()))
                .await;
            session.end_encounter().await;
            death::die(db, session).await;
            return;
        }
    } else {
        // Correct call. Deal damage.
        let damage = BASE_STRIKE_DAMAGE; // TODO: add attack item bonuses
        let remaining = session.damage_enemy(damage).await;
        session
            .send_message(&Message::System(format!(
                "you connect. enemy takes {damage} damage. HP: {remaining}."
            )))
            .await;

        if remaining == 0 {
            session
                .send_message(&Message::System("you kill it. its body crumples.".into()))
                .await;
            session.end_encounter().await;
            return;
        }
    }

    // Next round.
    let depth = state.depth;
    send_telegraph(session, depth).await;
}

/// Player braces during combat.
pub async fn brace(_db: &SqlitePool, session: &Session) {
    if !session.in_combat().await {
        session
            .send_message(&Message::Private("there is nothing to brace against.".into()))
            .await;
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    if state.stamina < ACTION_COST {
        session
            .send_message(&Message::Private("you don't have the strength.".into()))
            .await;
        return;
    }

    session.reset_encounter_timer().await;
    session.update_player(|s| s.stamina -= ACTION_COST).await;

    let enemy_attacks = rand::thread_rng().gen_bool(0.5);

    if enemy_attacks {
        // Correct call. Blocked the hit.
        session
            .send_message(&Message::System("you brace. it hits but you hold.".into()))
            .await;
    } else {
        // Wrong call. Wasted a turn.
        session
            .send_message(&Message::System("you brace but nothing comes. wasted effort.".into()))
            .await;
    }

    // Next round.
    let depth = state.depth;
    send_telegraph(session, depth).await;
}

/// Player escapes the encounter. Moves up 10% of current depth.
pub async fn escape(session: &Session) {
    if !session.in_encounter().await {
        session
            .send_message(&Message::Private("there is nothing to escape from.".into()))
            .await;
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    if state.stamina < ESCAPE_COST {
        session
            .send_message(&Message::Private("you don't have the strength.".into()))
            .await;
        return;
    }

    let levels_up = (state.depth as f32 * 0.10).ceil() as u32;
    let new_depth = state.depth.saturating_sub(levels_up).max(1);

    session
        .update_player(|s| {
            s.stamina -= ESCAPE_COST;
            s.depth = new_depth;
            s.resting = false;
        })
        .await;

    session.end_encounter().await;
    session
        .send_message(&Message::System(format!(
            "you scramble upward. depth {new_depth}."
        )))
        .await;
}

// ---- Internal helpers ----

/// Send a telegraph for the next round. Picks from the appropriate pool.
async fn send_telegraph(session: &Session, depth: u32) {
    let telegraph = pick_telegraph(depth);

    if let Some(enc) = session.get_encounter().await {
        session
            .send_message(&Message::System(format!(
                "\n{telegraph}\nenemy HP: {}/{}\n/strike  /brace  /escape",
                enc.enemy_hp, enc.enemy_max_hp
            )))
            .await;
    }
}

/// Pick a telegraph string based on depth. Deeper = more ambiguous.
fn pick_telegraph(depth: u32) -> &'static str {
    let mut rng = rand::thread_rng();

    let ambiguous_chance = match depth {
        0..=80 => 0.0,
        81..=120 => 0.10,
        121..=160 => 0.20,
        161..=199 => 0.30,
        _ => 0.0,
    };

    if rng.gen::<f32>() < ambiguous_chance {
        TELEGRAPH_AMBIGUOUS[rng.gen_range(0..TELEGRAPH_AMBIGUOUS.len())]
    } else if rng.gen_bool(0.5) {
        TELEGRAPH_ATTACKING[rng.gen_range(0..TELEGRAPH_ATTACKING.len())]
    } else {
        TELEGRAPH_OPEN[rng.gen_range(0..TELEGRAPH_OPEN.len())]
    }
}

/// Enemy HP based on depth.
fn enemy_hp(depth: u32) -> u32 {
    match depth {
        0..=40 => 100,
        41..=80 => 100,
        81..=120 => 175,
        121..=160 => 225,
        161..=199 => 275,
        200 => 1000,
        _ => 100,
    }
}

/// Encounter chance per 5-second roll, based on depth.
fn encounter_chance(depth: u32) -> f32 {
    match depth {
        0..=40 => 0.0,
        41..=80 => 0.05,
        81..=120 => 0.10,
        121..=160 => 0.15,
        161..=199 => 0.20,
        _ => 0.0,
    }
}
