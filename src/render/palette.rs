//! Named color roles for ANSI 256-color rendering. The web client mirrors these
//! in CSS custom properties; see `docs/theme.md` for the authoritative role table.
//!
//! These are placeholders for now — wired in once the telnet path grows colors.

#![allow(dead_code)]

// ---- 256-color palette indices ----

pub const BG: u8 = 232;
pub const FG: u8 = 187;
pub const DIM: u8 = 240;
pub const ACCENT: u8 = 179;
pub const DANGER: u8 = 124;
pub const CHAT: u8 = 108;
pub const RULE: u8 = 234;

// ---- Helpers ----

/// Wrap text in an ANSI foreground color, with reset afterward.
pub fn fg(color: u8, text: &str) -> String {
    format!("\x1b[38;5;{color}m{text}\x1b[0m")
}

/// Wrap text in an ANSI background color, with reset afterward.
pub fn bg(color: u8, text: &str) -> String {
    format!("\x1b[48;5;{color}m{text}\x1b[0m")
}
