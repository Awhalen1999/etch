use anyhow::Result;
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::{TcpListener, TcpStream},
};
use tracing::{error, info};

const TCP_ADDR: &str = "0.0.0.0:4000";
const HTTP_ADDR: &str = "0.0.0.0:8080";
const INDEX_HTML: &str = include_str!("../static/index.html");

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging. Default to INFO level if RUST_LOG isn't set.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    info!("etch starting up");

    // Spawn the TCP listener in its own task
    tokio::spawn(async move {
        if let Err(e) = run_tcp().await {
            error!("tcp listener error: {e}");
        }
    });

    // Spawn the HTTP/WebSocket server in another task
    tokio::spawn(async move {
        if let Err(e) = run_http().await {
            error!("http listener error: {e}");
        }
    });

    info!("listening on tcp {} and http {}", TCP_ADDR, HTTP_ADDR);
    info!("press ctrl+c to quit");

    // Wait forever (until ctrl+c kills us)
    tokio::signal::ctrl_c().await?;
    info!("shutting down");
    Ok(())
}

// ---- TCP ----

async fn run_tcp() -> Result<()> {
    let listener = TcpListener::bind(TCP_ADDR).await?;
    loop {
        let (stream, addr) = listener.accept().await?;
        info!("tcp connection from {}", addr);
        tokio::spawn(async move {
            if let Err(e) = handle_tcp(stream).await {
                error!("tcp connection error: {e}");
            }
        });
    }
}

async fn handle_tcp(stream: TcpStream) -> Result<()> {
    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half).lines();

    write_half.write_all(b"etch - echoing your input\r\n").await?;

    while let Some(line) = reader.next_line().await? {
        let response = format!("you said: {line}\r\n");
        write_half.write_all(response.as_bytes()).await?;
    }
    Ok(())
}

// ---- HTTP + WebSocket ----

async fn run_http() -> Result<()> {
    let app = Router::new()
        .route("/", get(serve_index))
        .route("/ws", get(ws_handler));

    let listener = TcpListener::bind(HTTP_ADDR).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn serve_index() -> impl IntoResponse {
    Html(INDEX_HTML)
}

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_ws)
}

async fn handle_ws(mut socket: WebSocket) {
    info!("ws connection opened");

    if socket
        .send(Message::Text("etch — echoing your input\r\n".into()))
        .await
        .is_err()
    {
        return;
    }

    while let Some(msg) = socket.recv().await {
        let Ok(msg) = msg else { break };
        if let Message::Text(text) = msg {
            let response = format!("you said: {}\r\n", text.trim());
            if socket.send(Message::Text(response.into())).await.is_err() {
                break;
            }
        }
    }

    info!("ws connection closed");
}