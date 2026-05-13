//! Per-connection session state and the live registry of all sessions.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{mpsc, RwLock};
use tracing::debug;

use crate::render::{render_for, Message};

pub type SessionId = u64;

/// Movement cooldown — minimum time between successful /down or /up.
const MOVE_COOLDOWN: Duration = Duration::from_secs(2);

/// State of a logged-in player. Persisted across disconnects.
#[derive(Clone, Debug)]
pub struct PlayerState {
    pub depth: u32,
    pub stamina: u32,
    pub deepest_depth: u32,
    pub resting: bool,
}

/// Ephemeral state for an active encounter. Not persisted.
#[derive(Clone, Debug)]
pub struct EncounterState {
    /// When the encounter started (for inaction timer).
    pub started_at: Instant,
    /// Whether the player has entered combat (/fight).
    pub in_combat: bool,
    /// Enemy's remaining HP. Set when /fight is issued.
    pub enemy_hp: u32,
    /// Enemy's max HP.
    pub enemy_max_hp: u32,
}

/// A handle to a connected player.
#[derive(Clone)]
pub struct Session {
    pub id: SessionId,
    pub outgoing: mpsc::Sender<String>,
    /// `None` until the player logs in.
    pub name: Arc<RwLock<Option<String>>>,
    pub player: Arc<RwLock<Option<PlayerState>>>,
    /// Timestamp of the last successful /down or /up.
    pub last_moved: Arc<RwLock<Option<Instant>>>,
    /// Active encounter state. `Some` = encounter/combat active.
    pub encounter: Arc<RwLock<Option<EncounterState>>>,
    /// Item available to /take at current depth. Cleared on movement.
    pub pending_item: Arc<RwLock<Option<String>>>,
}

impl Session {
    /// Send raw text. Bypasses the render pipeline.
    pub async fn send(&self, msg: impl Into<String>) {
        let _ = self.outgoing.send(msg.into()).await;
    }

    /// Send a typed message through the render pipeline.
    pub async fn send_message(&self, msg: &Message) {
        let bytes = render_for(self, msg);
        let _ = self.outgoing.send(bytes).await;
    }

    pub async fn is_authenticated(&self) -> bool {
        self.name.read().await.is_some()
    }

    pub async fn name(&self) -> Option<String> {
        self.name.read().await.clone()
    }

    pub async fn set_name(&self, name: String) {
        *self.name.write().await = Some(name);
    }

    /// Clear auth state, returning the session to the login prompt.
    pub async fn clear_auth(&self) {
        *self.name.write().await = None;
        *self.player.write().await = None;
    }

    /// Set the player's loaded state on login.
    pub async fn set_player(&self, state: PlayerState) {
        *self.player.write().await = Some(state);
    }

    /// Get a copy of the player's state, if logged in.
    pub async fn player(&self) -> Option<PlayerState> {
        self.player.read().await.clone()
    }

    /// Apply a function to the player's state in place.
    /// Returns the new state if the player is logged in.
    pub async fn update_player<F>(&self, f: F) -> Option<PlayerState>
    where
        F: FnOnce(&mut PlayerState),
    {
        let mut guard = self.player.write().await;
        if let Some(state) = guard.as_mut() {
            f(state);
            Some(state.clone())
        } else {
            None
        }
    }

    /// True if the player has moved within the cooldown window.
    pub async fn movement_on_cooldown(&self) -> bool {
        let guard = self.last_moved.read().await;
        match *guard {
            Some(last) => last.elapsed() < MOVE_COOLDOWN,
            None => false,
        }
    }

    /// Mark a move as just-happened (called after a successful /down or /up).
    pub async fn mark_moved(&self) {
        *self.last_moved.write().await = Some(Instant::now());
    }

    /// Whether the player is currently in an encounter (pre-combat or combat).
    pub async fn in_encounter(&self) -> bool {
        self.encounter.read().await.is_some()
    }

    /// Whether the player is in active combat (past /fight).
    pub async fn in_combat(&self) -> bool {
        self.encounter.read().await.as_ref().is_some_and(|e| e.in_combat)
    }

    /// Get a copy of the encounter state.
    pub async fn get_encounter(&self) -> Option<EncounterState> {
        self.encounter.read().await.clone()
    }

    /// Start an encounter (pre-combat). Player must /fight or /escape.
    pub async fn start_encounter(&self) {
        *self.encounter.write().await = Some(EncounterState {
            started_at: Instant::now(),
            in_combat: false,
            enemy_hp: 0,
            enemy_max_hp: 0,
        });
    }

    /// Transition to combat. Sets enemy HP.
    pub async fn enter_combat(&self, enemy_hp: u32) {
        let mut guard = self.encounter.write().await;
        if let Some(enc) = guard.as_mut() {
            enc.in_combat = true;
            enc.enemy_hp = enemy_hp;
            enc.enemy_max_hp = enemy_hp;
            enc.started_at = Instant::now();
        }
    }

    /// Apply damage to the enemy. Returns remaining HP.
    pub async fn damage_enemy(&self, damage: u32) -> u32 {
        let mut guard = self.encounter.write().await;
        if let Some(enc) = guard.as_mut() {
            enc.enemy_hp = enc.enemy_hp.saturating_sub(damage);
            enc.enemy_hp
        } else {
            0
        }
    }

    /// Reset inaction timer (called after each player action in combat).
    pub async fn reset_encounter_timer(&self) {
        let mut guard = self.encounter.write().await;
        if let Some(enc) = guard.as_mut() {
            enc.started_at = Instant::now();
        }
    }

    /// End the current encounter.
    pub async fn end_encounter(&self) {
        *self.encounter.write().await = None;
    }

    /// How long since last action in the encounter.
    pub async fn encounter_elapsed(&self) -> Option<Duration> {
        self.encounter.read().await.as_ref().map(|e| e.started_at.elapsed())
    }
}

/// The registry of all currently-connected players.
#[derive(Default)]
pub struct Sessions {
    inner: RwLock<HashMap<SessionId, Session>>,
    next_id: RwLock<SessionId>,
}

impl Sessions {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub async fn register(&self) -> (Session, mpsc::Receiver<String>) {
        let mut next = self.next_id.write().await;
        *next += 1;
        let id = *next;
        drop(next);

        let (tx, rx) = mpsc::channel::<String>(64);
        let session = Session {
            id,
            outgoing: tx,
            name: Arc::new(RwLock::new(None)),
            player: Arc::new(RwLock::new(None)),
            last_moved: Arc::new(RwLock::new(None)),
            encounter: Arc::new(RwLock::new(None)),
            pending_item: Arc::new(RwLock::new(None)),
        };

        self.inner.write().await.insert(id, session.clone());
        debug!(session_id = id, "session registered");

        (session, rx)
    }

    pub async fn unregister(&self, id: SessionId) {
        self.inner.write().await.remove(&id);
        debug!(session_id = id, "session unregistered");
    }

    /// Broadcast to every connected, authenticated session.
    pub async fn broadcast(&self, msg: &Message) {
        let sessions: Vec<Session> = self.inner.read().await.values().cloned().collect();
        for s in sessions {
            s.send_message(msg).await;
        }
    }

    /// Broadcast to authenticated sessions whose depth is within `range` of `depth`.
    pub async fn broadcast_at(&self, depth: u32, range: u32, msg: &Message) {
        let sessions: Vec<Session> = self.inner.read().await.values().cloned().collect();
        for s in sessions {
            if let Some(state) = s.player().await {
                if state.depth.abs_diff(depth) <= range {
                    s.send_message(msg).await;
                }
            }
        }
    }

    /// Send a shout to all players within range. Each recipient gets distance-based corruption.
    pub async fn broadcast_shout(&self, from_depth: u32, range: u32, from_name: &str, text: &str) {
        let sessions: Vec<Session> = self.inner.read().await.values().cloned().collect();
        for s in sessions {
            if let Some(state) = s.player().await {
                let distance = state.depth.abs_diff(from_depth);
                if distance <= range {
                    let msg = Message::Shouted {
                        from_name: from_name.to_string(),
                        text: text.to_string(),
                        distance,
                    };
                    s.send_message(&msg).await;
                }
            }
        }
    }

    pub async fn count(&self) -> usize {
        self.inner.read().await.len()
    }

    /// Find an active session by player name, if one exists.
    pub async fn find_by_name(&self, name: &str) -> Option<Session> {
        let sessions = self.inner.read().await;
        for s in sessions.values() {
            if let Some(n) = s.name().await {
                if n == name {
                    return Some(s.clone());
                }
            }
        }
        None
    }

    /// Get a clone of every connected session. Used by the tick loop.
    pub async fn all(&self) -> Vec<Session> {
        self.inner.read().await.values().cloned().collect()
    }
}