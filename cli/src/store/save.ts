// Game state persisted to ~/.etch/save.json. Mirrors store/account.ts.
// Only PlayerState lives here — encounters and other ephemeral state never persist.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { PlayerState } from "../game/types";

const SAVE_DIR = path.join(os.homedir(), ".etch");
const SAVE_PATH = path.join(SAVE_DIR, "save.json");

export function defaultPlayer(): PlayerState {
    return {
        depth: 1,
        stamina: 100,
        deepest_depth: 0,
        resting: false,
        inventory: [],
        queen_killed: false,
    };
}

export async function loadSave(): Promise<PlayerState | null> {
    try {
        const raw = await fs.readFile(SAVE_PATH, "utf-8");
        const data = JSON.parse(raw);
        if (!isPlayerState(data)) return null;
        return data;
    } catch {
        return null;
    }
}

export async function saveSave(player: PlayerState): Promise<void> {
    await fs.mkdir(SAVE_DIR, { recursive: true });
    await fs.writeFile(SAVE_PATH, JSON.stringify(player, null, 2), "utf-8");
}

function isPlayerState(data: unknown): data is PlayerState {
    if (typeof data !== "object" || data === null) return false;
    const d = data as Record<string, unknown>;
    return (
        typeof d.depth === "number" &&
        typeof d.stamina === "number" &&
        typeof d.deepest_depth === "number" &&
        typeof d.resting === "boolean" &&
        Array.isArray(d.inventory) &&
        d.inventory.every((x) => typeof x === "string") &&
        typeof d.queen_killed === "boolean"
    );
}
