// Command dispatcher. Handles text commands typed outside of combat.
// (During an encounter, the text input is disabled and single keystrokes
// drive combat. See ui/game.tsx for that handler.)

import {
    findItem,
    findItemByName,
    INVENTORY_SIZE,
    maxStamina,
    rollItemSpawn,
} from "./items";
import type { Line, Outcome, Session } from "./types";
import { bandFor, MAX_DEPTH } from "./world";

const COST_DOWN = 4;
const COST_UP = 8;
const MOVE_COOLDOWN_MS = 2_000;

export function runCommand(session: Session, input: string): Outcome {
    const text = input.trim();

    if (text === "/down")   return cmdDown(session);
    if (text === "/up")     return cmdUp(session);
    if (text === "/rest")   return cmdRest(session);

    if (text === "/take")   return cmdTake(session);
    if (text.startsWith("/drop ")) return cmdDrop(session, text.slice(6));

    if (text === "/me")     return cmdMe(session);
    if (text === "/help")   return cmdHelp(session);

    if (text.startsWith("/")) {
        return ignored(session, `unknown command: ${text}`);
    }
    // Plain text is chat. Single-player for now — silent.
    return { session, lines: [] };
}

// ---- Movement ----

function cmdDown(session: Session): Outcome {
    if (session.encounter) return ignored(session, "you can't move during an encounter.");
    if (session.player.resting) return ignored(session, "you are resting. /rest to stand.");
    if (Date.now() - session.last_moved_at < MOVE_COOLDOWN_MS) {
        return ignored(session, "you need to catch your breath.");
    }
    if (session.player.depth >= MAX_DEPTH) {
        return ignored(session, "you can go no deeper.");
    }
    if (session.player.stamina < COST_DOWN) {
        return ignored(session, "you don't have the strength.");
    }

    const newDepth = session.player.depth + 1;
    const pendingItem = rollItemSpawn(newDepth);
    const lines: Line[] = [
        { text: `you descend to depth ${newDepth}.`, style: "system" },
    ];
    if (pendingItem) {
        const item = findItem(pendingItem);
        if (item) lines.push({ text: `something catches your eye. a ${item.name}.`, style: "system" });
    }

    return {
        session: {
            ...session,
            player: {
                ...session.player,
                depth: newDepth,
                stamina: session.player.stamina - COST_DOWN,
                deepest_depth: Math.max(session.player.deepest_depth, newDepth),
            },
            last_moved_at: Date.now(),
            pending_item: pendingItem,
        },
        lines,
    };
}

function cmdUp(session: Session): Outcome {
    if (session.encounter) return ignored(session, "you can't move during an encounter.");
    if (session.player.resting) return ignored(session, "you are resting. /rest to stand.");
    if (Date.now() - session.last_moved_at < MOVE_COOLDOWN_MS) {
        return ignored(session, "you need to catch your breath.");
    }
    if (session.player.depth <= 1) {
        return ignored(session, "the lip overhangs. no climbing back.");
    }
    if (session.player.stamina < COST_UP) {
        return ignored(session, "you don't have the strength to climb.");
    }

    const newDepth = session.player.depth - 1;
    const pendingItem = rollItemSpawn(newDepth);
    const lines: Line[] = [
        { text: `you climb to depth ${newDepth}.`, style: "system" },
    ];
    if (pendingItem) {
        const item = findItem(pendingItem);
        if (item) lines.push({ text: `something catches your eye. a ${item.name}.`, style: "system" });
    }

    return {
        session: {
            ...session,
            player: {
                ...session.player,
                depth: newDepth,
                stamina: session.player.stamina - COST_UP,
            },
            last_moved_at: Date.now(),
            pending_item: pendingItem,
        },
        lines,
    };
}

function cmdRest(session: Session): Outcome {
    if (session.encounter) return ignored(session, "you can't rest during an encounter.");

    const resting = !session.player.resting;
    return {
        session: {
            ...session,
            player: { ...session.player, resting },
            last_recovery_at: Date.now(),
            last_spawn_roll_at: Date.now(),
        },
        lines: [
            {
                text: resting ? "you sit. your back finds the wall." : "you stand.",
                style: "system",
            },
        ],
    };
}

// ---- Inventory ----

function cmdTake(session: Session): Outcome {
    if (!session.pending_item) {
        return ignored(session, "there is nothing here to take.");
    }
    const item = findItem(session.pending_item);
    if (!item) return ignored(session, "there is nothing here to take.");
    if (session.player.inventory.length >= INVENTORY_SIZE) {
        return ignored(session, "your hands are full. 5 items max.");
    }

    return {
        session: {
            ...session,
            player: {
                ...session.player,
                inventory: [...session.player.inventory, item.id],
            },
            pending_item: null,
        },
        lines: [{ text: `you pick up the ${item.name}.`, style: "system" }],
    };
}

function cmdDrop(session: Session, name: string): Outcome {
    const item = findItemByName(name);
    if (!item) return ignored(session, "you don't have that.");

    const index = session.player.inventory.indexOf(item.id);
    if (index < 0) return ignored(session, "you don't have that.");

    const inventory = [...session.player.inventory];
    inventory.splice(index, 1);

    return {
        session: { ...session, player: { ...session.player, inventory } },
        lines: [{ text: `you drop the ${item.name}. it's gone.`, style: "system" }],
    };
}

// ---- Info ----

function cmdMe(session: Session): Outcome {
    const { player } = session;
    const max = maxStamina(player.inventory);
    const band = bandFor(player.depth);

    const lines: Line[] = [
        { text: `depth ${player.depth} · ${band}`, style: "private" },
        { text: `stamina ${player.stamina}/${max}`, style: "private" },
        { text: `deepest ${player.deepest_depth}`, style: "private" },
    ];

    if (player.inventory.length === 0) {
        lines.push({ text: "carrying: nothing", style: "private" });
    } else {
        lines.push({ text: "carrying:", style: "private" });
        for (const id of player.inventory) {
            const item = findItem(id);
            if (!item) continue;
            const stat =
                item.category === "attack"  ? `+${item.stat} attack` :
                item.category === "defense" ? `-${item.stat} damage taken` :
                                              `+${item.stat} max stamina`;
            lines.push({ text: `  ${item.name} (${stat})`, style: "private" });
        }
        const empty = INVENTORY_SIZE - player.inventory.length;
        if (empty > 0) {
            lines.push({
                text: `  ${empty} empty slot${empty === 1 ? "" : "s"}`,
                style: "private",
            });
        }
    }

    return { session, lines };
}

function cmdHelp(session: Session): Outcome {
    return {
        session,
        lines: [
            { text: "/down /up /rest         move and rest", style: "private" },
            { text: "/take /drop <item>      inventory", style: "private" },
            { text: "/me /help               info", style: "private" },
            { text: "/quit                   exit", style: "private" },
            { text: "", style: "private" },
            { text: "in combat (single keystrokes):", style: "private" },
            { text: "  F     engage when an encounter appears", style: "private" },
            { text: "  S     strike — press when the bar is in the sweet spot", style: "private" },
            { text: "  B     brace — same timing rule", style: "private" },
            { text: "  E     escape (costs 30 stamina)", style: "private" },
        ],
    };
}

// ---- Shared ----

function ignored(session: Session, message: string): Outcome {
    return { session, lines: [{ text: message, style: "private" }] };
}
