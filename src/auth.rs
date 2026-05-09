//! Login and account creation. Names are normalized to lowercase.

use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use sqlx::SqlitePool;

/// Result of a login attempt.
#[derive(Debug)]
pub enum LoginOutcome {
    /// Account didn't exist; created with the given password.
    NewAccount,
    /// Account existed and password matched.
    Returning,
    /// Account existed but password didn't match.
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

    let row: Option<(String,)> =
        sqlx::query_as("SELECT password_hash FROM accounts WHERE name = ?")
            .bind(&name)
            .fetch_optional(db)
            .await?;

    match row {
        Some((stored_hash,)) => verify_existing(db, &name, password, &stored_hash).await,
        None => create_new(db, &name, password).await,
    }
}

/// Verify a password against a stored hash. Updates last_seen_at on success.
async fn verify_existing(
    db: &SqlitePool,
    name: &str,
    password: &str,
    stored_hash: &str,
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
        Ok(LoginOutcome::Returning)
    } else {
        Ok(LoginOutcome::WrongPassword)
    }
}

/// Hash the password and insert a new account row.
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

    Ok(LoginOutcome::NewAccount)
}

/// Validate a name. 3-32 chars, lowercase ascii + digits + underscore, not reserved.
fn validate_name(name: &str) -> Result<()> {
    if name.len() < 3 || name.len() > 32 {
        return Err(anyhow!("name must be 3-32 characters"));
    }
    if !name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') {
        return Err(anyhow!("name can only contain lowercase letters, digits, and underscores"));
    }
    if RESERVED_NAMES.contains(&name) {
        return Err(anyhow!("that name is reserved"));
    }
    Ok(())
}

/// Validate a password. 6-128 characters; the upper bound prevents argon2 dos.
fn validate_password(password: &str) -> Result<()> {
    if password.len() < 6 {
        return Err(anyhow!("password must be at least 6 characters"));
    }
    if password.len() > 128 {
        return Err(anyhow!("password must be at most 128 characters"));
    }
    Ok(())
}