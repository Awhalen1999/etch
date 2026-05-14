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
use crate::item;
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

/// First escalation line, fired after a few seconds of inaction.
const ESCALATIONS_EARLY: &[&str] = &[
    "it's closer now.",
    "it shifts toward you.",
    "the air moves.",
    "you hear its legs.",
    "it tenses.",
];

/// Second escalation line, fired closer to the inaction death.
const ESCALATIONS_LATE: &[&str] = &[
    "you're running out of time.",
    "it's almost on you.",
    "the moment is closing.",
    "you can feel its breath.",
];

/// Seconds of inaction before the first escalation line fires.
const ESCALATION_EARLY_AT: u64 = 5;

/// Seconds of inaction before the second escalation line fires.
const ESCALATION_LATE_AT: u64 = 10;

/// Roll for an encounter on a resting player. Called from the tick loop.
pub async fn try_spawn(session: &Session) {
    if session.in_encounter().await {
        return;
    }

    let Some(state) = session.player().await else {
        return;
    };

    if !state.resting {
        return;
    }

    // TEST: depth 5 always spawns for combat testing. Remove this block before ship.
    if state.depth != 5 && state.depth <= ENCOUNTER_MIN_DEPTH {
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

/// Check inaction. Pushes escalation lines at intervals. On the hard limit:
/// pre-combat → death; in-combat → auto-resolve the round as if no action was taken.
/// Called from the tick loop.
pub async fn check_inaction(db: &SqlitePool, session: &Session) {
    let Some(enc) = session.get_encounter().await else {
        return;
    };
    let elapsed = enc.started_at.elapsed();

    if elapsed >= INACTION_LIMIT {
        if enc.in_combat {
            resolve_inaction(db, session).await;
        } else {
            session
                .send_message(&Message::System("you waited too long.".into()))
                .await;
            session.end_encounter().await;
            death::die(db, session).await;
        }
        return;
    }

    let secs = elapsed.as_secs();
    let expected = if secs >= ESCALATION_LATE_AT {
        2
    } else if secs >= ESCALATION_EARLY_AT {
        1
    } else {
        0
    };

    if enc.escalations_sent < expected {
        let late = enc.escalations_sent >= 1;
        let line = pick_escalation(late);
        session.send_message(&Message::System(line.into())).await;
        session.record_escalation().await;
    }
}

/// Resolve an in-combat round where the player didn't act. Enemy attacking = take
/// the hit (same as wrong /strike). Enemy open = the moment passes, no damage either way.
///
/// Re-verifies state on entry: a concurrent /strike, /brace, or /escape may have
/// raced us between the tick loop's read and this call.
async fn resolve_inaction(db: &SqlitePool, session: &Session) {
    let Some(enc) = session.get_encounter().await else {
        return;
    };
    if !enc.in_combat || enc.started_at.elapsed() < INACTION_LIMIT {
        return;
    }
    let enemy_attacks = enc.next_attacks;

    let fight_ended = if enemy_attacks {
        take_hit(db, session, "you don't move. it does.").await
    } else {
        session
            .send_message(&Message::System("the moment passes.".into()))
            .await;
        false
    };

    if !fight_ended {
        advance_round(session).await;
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
    let Some(name) = session.name().await else {
        return;
    };

    if state.stamina < ACTION_COST {
        session
            .send_message(&Message::Private("you don't have the strength.".into()))
            .await;
        return;
    }

    let enemy_attacks = session
        .get_encounter()
        .await
        .map(|e| e.next_attacks)
        .unwrap_or(false);

    session.update_player(|s| s.stamina -= ACTION_COST).await;

    let fight_ended = if enemy_attacks {
        take_hit(db, session, "it's faster. it hits you.").await
    } else {
        deal_hit(db, session, &name).await
    };

    if !fight_ended {
        advance_round(session).await;
    }
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

    let enemy_attacks = session
        .get_encounter()
        .await
        .map(|e| e.next_attacks)
        .unwrap_or(false);

    session.update_player(|s| s.stamina -= ACTION_COST).await;

    let line = if enemy_attacks {
        "you brace. it hits but you hold."
    } else {
        "you brace but nothing comes. wasted effort."
    };
    session.send_message(&Message::System(line.into())).await;

    advance_round(session).await;
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

/// Apply a stamina hit to the player. Narrates with `prefix` followed by the
/// penalty. Returns true if the hit killed them and the fight ended.
async fn take_hit(db: &SqlitePool, session: &Session, prefix: &str) -> bool {
    let Some(name) = session.name().await else {
        return true;
    };
    let def_bonus = item::defense_bonus(db, &name).await;
    let penalty = WRONG_STRIKE_PENALTY.saturating_sub(def_bonus);
    session
        .update_player(|s| s.stamina = s.stamina.saturating_sub(penalty))
        .await;
    session
        .send_message(&Message::System(format!("{prefix} stamina -{penalty}.")))
        .await;

    if session.player().await.is_some_and(|s| s.stamina == 0) {
        session
            .send_message(&Message::System("you collapse.".into()))
            .await;
        session.end_encounter().await;
        death::die(db, session).await;
        return true;
    }
    false
}

/// Apply a successful strike to the enemy. Returns true if the enemy died
/// and the fight ended.
async fn deal_hit(db: &SqlitePool, session: &Session, name: &str) -> bool {
    let atk_bonus = item::attack_bonus(db, name).await;
    let damage = BASE_STRIKE_DAMAGE + atk_bonus;
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
        return true;
    }
    false
}

/// Reset the inaction timer and send the next round's telegraph.
async fn advance_round(session: &Session) {
    let Some(state) = session.player().await else {
        return;
    };
    session.reset_encounter_timer().await;
    send_telegraph(session, state.depth).await;
}

/// Roll the next round's enemy intent, store it on the session, and send the matching telegraph.
async fn send_telegraph(session: &Session, depth: u32) {
    let (attacks, telegraph) = roll_next_round(depth);
    session.set_next_attacks(attacks).await;

    if let Some(enc) = session.get_encounter().await {
        session
            .send_message(&Message::System(format!(
                "\n{telegraph}\nenemy HP: {}/{}\n/strike  /brace  /escape",
                enc.enemy_hp, enc.enemy_max_hp
            )))
            .await;
    }
}

/// Roll enemy intent for the next round and pick a matching telegraph.
/// At deeper depths the telegraph may be ambiguous — the underlying intent
/// is still committed; the player just can't read it from the prose.
fn roll_next_round(depth: u32) -> (bool, &'static str) {
    let mut rng = rand::thread_rng();
    let attacks = rng.gen_bool(0.5);

    let ambiguous_chance = match depth {
        0..=80 => 0.0,
        81..=120 => 0.10,
        121..=160 => 0.20,
        161..=199 => 0.30,
        _ => 0.0,
    };

    let telegraph = if rng.gen::<f32>() < ambiguous_chance {
        TELEGRAPH_AMBIGUOUS[rng.gen_range(0..TELEGRAPH_AMBIGUOUS.len())]
    } else if attacks {
        TELEGRAPH_ATTACKING[rng.gen_range(0..TELEGRAPH_ATTACKING.len())]
    } else {
        TELEGRAPH_OPEN[rng.gen_range(0..TELEGRAPH_OPEN.len())]
    };

    (attacks, telegraph)
}

/// Pick a random escalation line. `late` selects the more urgent pool.
fn pick_escalation(late: bool) -> &'static str {
    let mut rng = rand::thread_rng();
    let pool = if late { ESCALATIONS_LATE } else { ESCALATIONS_EARLY };
    pool[rng.gen_range(0..pool.len())]
}

/// Enemy HP based on depth.
fn enemy_hp(depth: u32) -> u32 {
    match depth {
        0..=80 => 100,
        81..=120 => 175,
        121..=160 => 225,
        161..=199 => 275,
        200 => 1000,
        _ => 100,
    }
}

/// Encounter chance per 5-second roll, based on depth.
fn encounter_chance(depth: u32) -> f32 {
    // TEST: depth 5 = 100% for combat testing. Remove before ship.
    if depth == 5 {
        return 1.0;
    }
    match depth {
        0..=40 => 0.0,
        41..=80 => 0.05,
        81..=120 => 0.10,
        121..=160 => 0.15,
        161..=199 => 0.20,
        _ => 0.0,
    }
}
