use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{mpsc, RwLock};
use tracing::debug;

pub type SessionId = u64;

/// Handle to a connected player, transport-agnostic.
#[derive(Clone)]
pub struct Session {
    pub id: SessionId,
    pub outgoing: mpsc::Sender<String>,
}

impl Session {
    /// Send a message to this player. Silently drops if disconnected.
    pub async fn send(&self, msg: impl Into<String>) {
        let _ = self.outgoing.send(msg.into()).await;
    }
}

/// Registry of all connected players.
#[derive(Default)]
pub struct Sessions {
    inner: RwLock<HashMap<SessionId, Session>>,
    next_id: RwLock<SessionId>,
}

impl Sessions {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Create and register a new session. Returns the session and its message receiver.
    pub async fn register(&self) -> (Session, mpsc::Receiver<String>) {
        let mut next = self.next_id.write().await;
        *next += 1;
        let id = *next;
        drop(next);

        let (tx, rx) = mpsc::channel::<String>(64);
        let session = Session { id, outgoing: tx };

        self.inner.write().await.insert(id, session.clone());
        debug!(session_id = id, "session registered");

        (session, rx)
    }

    /// Remove a session when its connection closes.
    pub async fn unregister(&self, id: SessionId) {
        self.inner.write().await.remove(&id);
        debug!(session_id = id, "session unregistered");
    }

    /// Send a message to every connected session.
    pub async fn broadcast(&self, msg: &str) {
        let sessions: Vec<Session> =
            self.inner.read().await.values().cloned().collect();
        for s in sessions {
            s.send(msg.to_string()).await;
        }
    }

    /// Number of active sessions.
    pub async fn count(&self) -> usize {
        self.inner.read().await.len()
    }
}