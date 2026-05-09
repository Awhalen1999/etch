use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{mpsc, RwLock};
use tracing::debug;

use crate::render::{render_for, Message};

pub type SessionId = u64;

#[derive(Clone)]
pub struct Session {
    pub id: SessionId,
    pub outgoing: mpsc::Sender<String>,
}

impl Session {
    /// Send raw text. Bypasses the render pipeline.
    /// Most game code should use `send_message` instead.
    pub async fn send(&self, msg: impl Into<String>) {
        let _ = self.outgoing.send(msg.into()).await;
    }

    /// Send a typed message through the render pipeline.
    pub async fn send_message(&self, msg: &Message) {
        let bytes = render_for(self, msg);
        let _ = self.outgoing.send(bytes).await;
    }
}

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
        let session = Session { id, outgoing: tx };

        self.inner.write().await.insert(id, session.clone());
        debug!(session_id = id, "session registered");

        (session, rx)
    }

    pub async fn unregister(&self, id: SessionId) {
        self.inner.write().await.remove(&id);
        debug!(session_id = id, "session unregistered");
    }

    /// Broadcast a typed message to every connected session, rendered
    /// per-recipient through the pipeline.
    pub async fn broadcast(&self, msg: &Message) {
        let sessions: Vec<Session> =
            self.inner.read().await.values().cloned().collect();
        for s in sessions {
            s.send_message(msg).await;
        }
    }

    pub async fn count(&self) -> usize {
        self.inner.read().await.len()
    }
}