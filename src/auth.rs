//! Login and account creation. Names are normalized to lowercase.

use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use sqlx::SqlitePool;

use crate::session::PlayerState;

/// Result of a login attempt. Carries player state on success.
#[derive(Debug)]
pub enum LoginOutcome {
    NewAccount(PlayerState),
    Returning(PlayerState),
    WrongPassword,
}

/// Names that confuse chat output, command parsing, or impersonate the server.
const RESERVED_NAMES: &[&str] = &[
    "login", "help", "quit", "who", "me", "look",
    "down", "up", "rest", "read", "mark", "shout",
    "whisper", "take", "drop", "depths", "escape",
    "system", "server", "etch", "admin", "root",
    "keeper", "null", "none", "nobody", "anonymous",
    "bot", "mod", "moderator", "owner",
];

/// Try to log in. Creates the account if the name doesn't exist.
pub async fn login_or_register(
    db: &SqlitePool,
    name: &str,
    password: &str,
) -> Result<LoginOutcome> {
    let name = name.trim().to_lowercase();

    validate_name(&name)?;
    validate_password(password)?;

    let row: Option<(String, i64, i64, i64)> = sqlx::query_as(
        "SELECT password_hash, current_depth, current_stamina, deepest_depth
         FROM accounts WHERE name = ?",
    )
    .bind(&name)
    .fetch_optional(db)
    .await?;

    match row {
        Some((hash, depth, stamina, deepest)) => {
            verify_existing(db, &name, password, &hash, depth, stamina, deepest).await
        }
        None => create_new(db, &name, password).await,
    }
}

/// Save the player's current state to the database.
pub async fn save_state(db: &SqlitePool, name: &str, state: &PlayerState) -> Result<()> {
    sqlx::query(
        "UPDATE accounts SET current_depth = ?, current_stamina = ?, deepest_depth = ?
         WHERE name = ?",
    )
    .bind(state.depth as i64)
    .bind(state.stamina as i64)
    .bind(state.deepest_depth as i64)
    .bind(name)
    .execute(db)
    .await?;
    Ok(())
}

/// Verify a password against a stored hash. Returns loaded player state on success.
async fn verify_existing(
    db: &SqlitePool,
    name: &str,
    password: &str,
    stored_hash: &str,
    depth: i64,
    stamina: i64,
    deepest: i64,
) -> Result<LoginOutcome> {
    let parsed =
        PasswordHash::new(stored_hash).map_err(|e| anyhow!("stored hash parse error: {e}"))?;

    if Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
    {
        sqlx::query("UPDATE accounts SET last_seen_at = CURRENT_TIMESTAMP WHERE name = ?")
            .bind(name)
            .execute(db)
            .await?;

        Ok(LoginOutcome::Returning(PlayerState {
            depth: depth as u32,
            stamina: stamina as u32,
            deepest_depth: deepest as u32,
            resting: false,
        }))
    } else {
        Ok(LoginOutcome::WrongPassword)
    }
}

/// Hash the password and insert a new account row. Returns default player state.
async fn create_new(db: &SqlitePool, name: &str, password: &str) -> Result<LoginOutcome> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow!("hash error: {e}"))?
        .to_string();

    sqlx::query("INSERT INTO accounts (name, password_hash) VALUES (?, ?)")
        .bind(name)
        .bind(&hash)
        .execute(db)
        .await?;

    Ok(LoginOutcome::NewAccount(PlayerState {
        depth: 0,
        stamina: 100,
        deepest_depth: 0,
        resting: false,
    }))
}

/// 3-32 chars, lowercase ascii + digits + underscore, not reserved.
fn validate_name(name: &str) -> Result<()> {
    if name.len() < 3 || name.len() > 32 {
        return Err(anyhow!("name must be 3-32 characters"));
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(anyhow!(
            "name can only contain lowercase letters, digits, and underscores"
        ));
    }
    if RESERVED_NAMES.contains(&name) {
        return Err(anyhow!("that name is reserved"));
    }
    Ok(())
}

/// 6-128 characters; the upper bound prevents argon2 dos.
fn validate_password(password: &str) -> Result<()> {
    if password.len() < 6 {
        return Err(anyhow!("password must be at least 6 characters"));
    }
    if password.len() > 128 {
        return Err(anyhow!("password must be at most 128 characters"));
    }
    Ok(())
}