//! Entry point. Initializes the database, starts both transport listeners,
//! and waits for shutdown.

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
mod render;
mod session;

use session::Sessions;

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

// ---- TCP ----

/// Spawn the TCP listener as a background task.
fn spawn_tcp(state: AppState) {
    tokio::spawn(async move {
        if let Err(e) = run_tcp(state).await {
            error!("tcp listener error: {e}");
        }
    });
}

/// Accept TCP connections, spawn a task per client.
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

/// Handle a single TCP client: read lines, route through commands.
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

    state.sessions.unregister(session_id).await;
    writer.abort();
    Ok(())
}

// ---- HTTP + WebSocket ----

/// Spawn the HTTP/WebSocket server as a background task.
fn spawn_http(state: AppState) {
    tokio::spawn(async move {
        if let Err(e) = run_http(state).await {
            error!("http listener error: {e}");
        }
    });
}

/// Build routes and start axum server.
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

/// Handle a single WebSocket client: read messages, route through commands.
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

    state.sessions.unregister(session_id).await;
    writer.abort();
    info!("ws connection closed");
}