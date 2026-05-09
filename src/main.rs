use std::sync::Arc;

use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::{TcpListener, TcpStream},
};
use tracing::{error, info};

mod commands;
mod render;
mod session;

use session::Sessions;

const TCP_ADDR: &str = "0.0.0.0:4000";
const HTTP_ADDR: &str = "0.0.0.0:8080";
const INDEX_HTML: &str = include_str!("../static/index.html");

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    info!("etch starting up");

    let sessions = Sessions::new();

    spawn_tcp(sessions.clone());
    spawn_http(sessions.clone());

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

/// Spawn TCP listener as background task.
fn spawn_tcp(sessions: Arc<Sessions>) {
    tokio::spawn(async move {
        if let Err(e) = run_tcp(sessions).await {
            error!("tcp listener error: {e}");
        }
    });
}

/// Accept TCP connections in a loop, spawning a task per client.
async fn run_tcp(sessions: Arc<Sessions>) -> Result<()> {
    let listener = TcpListener::bind(TCP_ADDR).await?;
    loop {
        let (stream, addr) = listener.accept().await?;
        info!("tcp connection from {addr}");

        let sessions = sessions.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_tcp(stream, sessions).await {
                error!("tcp connection error: {e}");
            }
        });
    }
}

/// Handle a single TCP client: read lines, route through commands.
async fn handle_tcp(stream: TcpStream, sessions: Arc<Sessions>) -> Result<()> {
    let (read_half, mut write_half) = stream.into_split();

    let (session, mut rx) = sessions.register().await;
    let session_id = session.id;

    session
        .send("etch - connected. type /who to see how many are here.\r\n")
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
        commands::handle_input(&sessions, &session, &line).await;
    }

    sessions.unregister(session_id).await;
    writer.abort();
    Ok(())
}

// ---- HTTP + WebSocket ----

/// Spawn HTTP/WebSocket server as background task.
fn spawn_http(sessions: Arc<Sessions>) {
    tokio::spawn(async move {
        if let Err(e) = run_http(sessions).await {
            error!("http listener error: {e}");
        }
    });
}

/// Build routes and start axum server.
async fn run_http(sessions: Arc<Sessions>) -> Result<()> {
    let app = Router::new()
        .route("/", get(serve_index))
        .route("/ws", get(ws_handler))
        .with_state(sessions);

    let listener = TcpListener::bind(HTTP_ADDR).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn serve_index() -> impl IntoResponse {
    Html(INDEX_HTML)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(sessions): State<Arc<Sessions>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, sessions))
}

/// Handle a single WebSocket client: read messages, route through commands.
async fn handle_ws(socket: WebSocket, sessions: Arc<Sessions>) {
    info!("ws connection opened");

    let (mut sink, mut stream) = socket.split();

    let (session, mut rx) = sessions.register().await;
    let session_id = session.id;

    session
        .send("etch - connected. type /who to see how many are here.\r\n")
        .await;

    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        if let Message::Text(text) = msg {
            commands::handle_input(&sessions, &session, &text).await;
        }
    }

    sessions.unregister(session_id).await;
    writer.abort();
    info!("ws connection closed");
}