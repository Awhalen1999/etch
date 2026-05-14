//! Entry point. Initializes the database, starts both transport listeners
//! and the world tick loop, waits for shutdown.

use std::sync::Arc;

use anyhow::Result;
use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use sqlx::SqlitePool;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::{TcpListener, TcpStream},
};
use tracing::{error, info};

mod auth;
mod commands;
mod db;
mod death;
mod encounter;
mod item;
mod render;
mod session;
mod world;

use session::{Session, Sessions};

const TCP_ADDR: &str = "0.0.0.0:4000";
const HTTP_ADDR: &str = "0.0.0.0:8080";
const DB_PATH: &str = "data/etch.db";
const INDEX_HTML: &str = include_str!("../static/index.html");

/// Long-lived shared state passed to both transports.
#[derive(Clone)]
struct AppState {
    sessions: Arc<Sessions>,
    db: SqlitePool,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    info!("etch starting up");

    let db = db::init(DB_PATH).await?;
    let sessions = Sessions::new();

    world::spawn_tick(sessions.clone(), db.clone());

    let state = AppState { sessions, db };

    spawn_tcp(state.clone());
    spawn_http(state.clone());

    info!("listening on tcp {TCP_ADDR} and http {HTTP_ADDR}");
    info!("press ctrl+c to quit");

    tokio::signal::ctrl_c().await?;
    info!("shutting down");
    Ok(())
}

/// Set up tracing with RUST_LOG or default to info.
fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();
}

/// Save the player's state on disconnect, if logged in. Anti-cheese: disconnecting
/// during an active encounter kills the player first, so they can't yank the cable
/// to escape a losing fight.
async fn save_on_disconnect(db: &SqlitePool, session: &Session) {
    let Some(name) = session.name().await else {
        return;
    };

    if session.in_encounter().await {
        death::die(db, session).await;
    }

    let Some(state) = session.player().await else {
        return;
    };
    if let Err(e) = auth::save_state(db, &name, &state).await {
        error!("failed to save state for {name}: {e}");
    }
}

// ---- TCP ----

fn spawn_tcp(state: AppState) {
    tokio::spawn(async move {
        if let Err(e) = run_tcp(state).await {
            error!("tcp listener error: {e}");
        }
    });
}

async fn run_tcp(state: AppState) -> Result<()> {
    let listener = TcpListener::bind(TCP_ADDR).await?;
    loop {
        let (stream, addr) = listener.accept().await?;
        info!("tcp connection from {addr}");

        let state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_tcp(stream, state).await {
                error!("tcp connection error: {e}");
            }
        });
    }
}

async fn handle_tcp(stream: TcpStream, state: AppState) -> Result<()> {
    let (read_half, mut write_half) = stream.into_split();

    let (session, mut rx) = state.sessions.register().await;
    let session_id = session.id;

    session
        .send("etch\r\ntype: login <name> <password>\r\n")
        .await;

    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write_half.write_all(msg.as_bytes()).await.is_err() {
                break;
            }
        }
    });

    let mut reader = BufReader::new(read_half).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        commands::handle_input(&state.sessions, &state.db, &session, &line).await;
    }

    save_on_disconnect(&state.db, &session).await;
    state.sessions.unregister(session_id).await;
    writer.abort();
    Ok(())
}

// ---- HTTP + WebSocket ----

fn spawn_http(state: AppState) {
    tokio::spawn(async move {
        if let Err(e) = run_http(state).await {
            error!("http listener error: {e}");
        }
    });
}

async fn run_http(state: AppState) -> Result<()> {
    let app = Router::new()
        .route("/", get(serve_index))
        .route("/ws", get(ws_handler))
        .with_state(state);

    let listener = TcpListener::bind(HTTP_ADDR).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn serve_index() -> impl IntoResponse {
    Html(INDEX_HTML)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    info!("ws connection opened");

    let (mut sink, mut stream) = socket.split();

    let (session, mut rx) = state.sessions.register().await;
    let session_id = session.id;

    session
        .send("etch\r\ntype: login <name> <password>\r\n")
        .await;

    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(WsMessage::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        if let WsMessage::Text(text) = msg {
            commands::handle_input(&state.sessions, &state.db, &session, &text).await;
        }
    }

    save_on_disconnect(&state.db, &session).await;
    state.sessions.unregister(session_id).await;
    writer.abort();
    info!("ws connection closed");
}