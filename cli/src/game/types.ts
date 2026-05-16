// Shared types for game state and the result of every action.
//
// PlayerState is the only thing persisted to disk (save.json).
// Session bundles it with ephemeral state (encounter, timers, pending item).
// Outcome is what every command and the tick loop return: new session + lines.

export interface PlayerState {
    depth: number;
    stamina: number;
    deepest_depth: number;
    resting: boolean;
    inventory: string[];     // item IDs; duplicates allowed for stacks
    queen_killed: boolean;
}

export interface EncounterState {
    started_at: number;      // Date.now() — set when this round began (drives the bouncing bar)
    in_combat: boolean;      // false = pre-combat (waiting on F/E)
    enemy_hp: number;
    enemy_max_hp: number;
    next_attacks: boolean;   // intent the player must read off the telegraph

    // Strings shown by CombatScene. current_telegraph is the prose for the round
    // the player is reading right now. last_result is the result of the previous
    // round (rendered dimmer).
    current_telegraph: string;
    last_result: Line | null;
}

export interface Session {
    player: PlayerState;
    encounter: EncounterState | null;
    last_moved_at: number;
    last_recovery_at: number;
    last_spawn_roll_at: number;
    pending_item: string | null;  // item id available to /take at current depth
}

export type LineStyle = "system" | "private" | "danger" | "chat" | "input" | "success";

export interface Line {
    text: string;
    style: LineStyle;
}

export interface Outcome {
    session: Session;
    lines: Line[];
}
