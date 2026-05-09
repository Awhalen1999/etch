//! Database setup. Opens the SQLite file, runs migrations, returns a pool.

use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::Path;
use tracing::info;

/// Open or create the SQLite database, run migrations, return a connection pool.
pub async fn init(db_path: &str) -> Result<SqlitePool> {
    if let Some(parent) = Path::new(db_path).parent() {
        if !parent.as_os_str().is_empty() {
            tokio::fs::create_dir_all(parent).await.ok();
        }
    }

    let url = format!("sqlite://{db_path}?mode=rwc");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    info!("db ready at {db_path}");
    Ok(pool)
}