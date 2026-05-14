-- etch — D1 schema.
-- Two tables. Names claim ownership of inscriptions via a token.

CREATE TABLE IF NOT EXISTS accounts (
    name       TEXT PRIMARY KEY,
    token      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    depth      INTEGER NOT NULL,
    text       TEXT NOT NULL,
    written_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (name) REFERENCES accounts(name)
);

CREATE INDEX IF NOT EXISTS idx_inscriptions_depth ON inscriptions(depth);
