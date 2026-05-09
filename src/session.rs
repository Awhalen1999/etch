//! Per-connection session state and the live registry of all sessions.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{mpsc, RwLock};
use tracing::debug;

use crate::render::{render_for, Message};

/// Unique identifier for a connection.
pub type SessionId = u64;

/// A handle to a connected player. Game logic uses this to send messages
/// without caring whether the player is on tcp or ws.
#[derive(Clone)]
pub struct Session {
    pub id: SessionId,
    pub outgoing: mpsc::Sender<String>,
    /// The logged-in account name. `None` until the player logs in.
    pub name: Arc<RwLock<Option<String>>>,
}

impl Session {
    /// Send raw text. Bypasses the render pipeline. Most game code should
    /// use `send_message` instead.
    pub async fn send(&self, msg: impl Into<String>) {
        let _ = self.outgoing.send(msg.into()).await;
    }

    /// Send a typed message through the render pipeline.
    pub async fn send_message(&self, msg: &Message) {
        let bytes = render_for(self, msg);
        let _ = self.outgoing.send(bytes).await;
    }

    /// True if the player has logged in.
    pub async fn is_authenticated(&self) -> bool {
        self.name.read().await.is_some()
    }

    /// Get the logged-in name, or `None`.
    pub async fn name(&self) -> Option<String> {
        self.name.read().await.clone()
    }

    /// Set the logged-in name.
    pub async fn set_name(&self, name: String) {
        *self.name.write().await = Some(name);
    }
}

/// The registry of all currently-connected players.
#[derive(Default)]
pub struct Sessions {
    inner: RwLock<HashMap<SessionId, Session>>,
    next_id: RwLock<SessionId>,
}

impl Sessions {
    /// Create an empty registry wrapped in an `Arc` for sharing.
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Register a new connection. Returns the session and a receiver
    /// for the writer task to pump out to the actual socket.
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
        };

        self.inner.write().await.insert(id, session.clone());
        debug!(session_id = id, "session registered");

        (session, rx)
    }

    /// Remove a session — call when its connection closes.
    pub async fn unregister(&self, id: SessionId) {
        self.inner.write().await.remove(&id);
        debug!(session_id = id, "session unregistered");
    }

    /// Send a typed message to every connected session, rendered per-recipient.
    pub async fn broadcast(&self, msg: &Message) {
        let sessions: Vec<Session> = self.inner.read().await.values().cloned().collect();
        for s in sessions {
            s.send_message(msg).await;
        }
    }

    /// Count of active sessions.
    pub async fn count(&self) -> usize {
        self.inner.read().await.len()
    }
}