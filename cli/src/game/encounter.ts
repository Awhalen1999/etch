// Combat. Pure functions only — no I/O, no side effects.
//
// Single-press model: each round, a timing bar bounces left↔right at constant
// speed (no timeout). The player presses S or B at any moment. The bar
// position at press time determines hit vs miss:
//   - in sweet spot + right read = clean strike or block
//   - in sweet spot + wrong read = wrong-call damage (the original math)
//   - outside sweet spot         = timing miss; enemy resolves anyway

import { attackBonus, defenseBonus, maxStamina } from "./items";
import type { EncounterState, Line, Outcome, Session } from "./types";
import { encounterChance, enemyHp, STAMINA_BASE_MAX } from "./world";

export const COST_ACTION = 5;
export const COST_ESCAPE = 30;
export const WRONG_STRIKE_PENALTY = 40;
export const BASE_STRIKE_DAMAGE = 50;

// Pre-combat (F/E choice): 15-second window. After that, the enemy takes you.
export const INACTION_LIMIT_MS = 15_000;

// Bouncing timing bar: full cycle = 2 * BOUNCE_HALF_MS.
// Sweet spot is the SWEET_START..SWEET_END fraction of the bar.
export const BOUNCE_HALF_MS = 800;
export const SWEET_START = 0.4;
export const SWEET_END = 0.6;

// ---- Telegraph pools ----

const TELEGRAPH_ATTACKING = [
    "it lowers its head and charges.",
    "it lunges at you. fast.",
    "its mandibles snap open. it rushes forward.",
    "it coils and springs toward you.",
    "it clicks rapidly and surges at you.",
    "it throws its weight at you.",
];

const TELEGRAPH_OPEN = [
    "it hesitates. its legs buckle.",
    "it turns sideways. you see an opening.",
    "it backs away. antennae twitching.",
    "it stumbles. off balance.",
    "its movements slow. it's exposed.",
    "it pauses. watching you.",
];

const TELEGRAPH_AMBIGUOUS = [
    "it moves.",
    "something shifts.",
    "you can't read it.",
    "it changes stance.",
];

function pickRandom<T>(pool: readonly T[]): T {
    return pool[Math.floor(Math.random() * pool.length)]!;
}

function ambiguousChance(depth: number): number {
    if (depth <= 80) return 0;
    if (depth <= 120) return 0.10;
    if (depth <= 160) return 0.20;
    return 0.30;
}

function rollNextRound(depth: number): { attacks: boolean; telegraph: string } {
    const attacks = Math.random() < 0.5;
    const ambiguous = Math.random() < ambiguousChance(depth);
    if (ambiguous) return { attacks, telegraph: pickRandom(TELEGRAPH_AMBIGUOUS) };
    return {
        attacks,
        telegraph: attacks ? pickRandom(TELEGRAPH_ATTACKING) : pickRandom(TELEGRAPH_OPEN),
    };
}

// ---- Bar position (shared by UI render and combat hit detection) ----

// Triangle wave: 0 → 1 → 0 over 2 * BOUNCE_HALF_MS.
export function barPosition(elapsedMs: number): number {
    const cycle = elapsedMs % (2 * BOUNCE_HALF_MS);
    if (cycle < BOUNCE_HALF_MS) return cycle / BOUNCE_HALF_MS;
    return 1 - (cycle - BOUNCE_HALF_MS) / BOUNCE_HALF_MS;
}

function inSweetSpot(position: number): boolean {
    return position >= SWEET_START && position < SWEET_END;
}

// ---- Encounter lifecycle ----

export function newEncounter(depth: number): EncounterState {
    const hp = enemyHp(depth);
    return {
        started_at: Date.now(),
        in_combat: false,
        enemy_hp: hp,
        enemy_max_hp: hp,
        next_attacks: false,
        current_telegraph: "",
        last_result: null,
    };
}

export function shouldSpawn(session: Session): boolean {
    if (session.encounter) return false;
    if (!session.player.resting) return false;
    return Math.random() < encounterChance(session.player.depth);
}

// ---- Player actions ----

export function applyFight(session: Session): Outcome {
    const enc = session.encounter;
    if (!enc) return ignored(session, "there is nothing to fight.");
    if (enc.in_combat) return ignored(session, "you are already fighting.");

    const next = rollNextRound(session.player.depth);
    const newEnc: EncounterState = {
        ...enc,
        in_combat: true,
        next_attacks: next.attacks,
        started_at: Date.now(),
        current_telegraph: next.telegraph,
        last_result: null,
    };
    return {
        session: { ...session, encounter: newEnc },
        lines: [
            { text: "you engage.", style: "system" },
            { text: next.telegraph, style: "system" },
        ],
    };
}

// Single-press combat action. Reads bar position at call time and either
// applies the action cleanly (in sweet spot) or resolves as a timing miss.
export function applyTimedAction(session: Session, action: "strike" | "brace"): Outcome {
    const enc = session.encounter;
    if (!enc?.in_combat) return ignored(session, "you can't do that now.");
    if (session.player.stamina < COST_ACTION) {
        return ignored(session, "you don't have the strength.");
    }

    const elapsed = Date.now() - enc.started_at;
    const position = barPosition(elapsed);

    if (!inSweetSpot(position)) {
        // Outside the sweet spot. Action fails; enemy resolves anyway.
        return resolveTimingMiss(session, "your timing slips.");
    }

    if (action === "strike") return applyStrike(session);
    return applyBrace(session);
}

export function applyEscape(session: Session): Outcome {
    if (!session.encounter) return ignored(session, "there is nothing to escape from.");
    if (session.player.stamina < COST_ESCAPE) {
        return ignored(session, "you don't have the strength.");
    }

    const levelsUp = Math.max(1, Math.ceil(session.player.depth * 0.1));
    const newDepth = Math.max(1, session.player.depth - levelsUp);

    return {
        session: {
            ...session,
            player: {
                ...session.player,
                depth: newDepth,
                stamina: session.player.stamina - COST_ESCAPE,
                resting: false,
            },
            encounter: null,
            last_moved_at: Date.now(),
            pending_item: null,
        },
        lines: [{ text: `you scramble upward. depth ${newDepth}.`, style: "system" }],
    };
}

// ---- Timing miss + pre-combat inaction resolution ----

function resolveTimingMiss(session: Session, prefix: string): Outcome {
    const enc = session.encounter;
    if (!enc) return { session, lines: [] };

    if (enc.next_attacks) {
        return takeHit(session, `${prefix} it lands a hit.`);
    }
    return advanceRound(session, [
        { text: `${prefix} the moment is gone.`, style: "private" },
    ]);
}

export function resolveInactionRound(session: Session): Outcome {
    const enc = session.encounter;
    if (!enc) return { session, lines: [] };

    // Pre-combat: 15s with no action means the enemy takes you.
    return death(session, [{ text: "you waited too long.", style: "danger" }]);
}

// ---- Death ----

function death(session: Session, prelude: Line[]): Outcome {
    return {
        session: {
            player: {
                ...session.player,
                depth: 1,
                stamina: maxStamina([]),
                resting: false,
                inventory: [],
            },
            encounter: null,
            last_moved_at: Date.now(),
            last_recovery_at: Date.now(),
            last_spawn_roll_at: Date.now(),
            pending_item: null,
        },
        lines: [
            ...prelude,
            { text: "you died.", style: "danger" },
            { text: `you wake at depth 1. stamina ${STAMINA_BASE_MAX}/${STAMINA_BASE_MAX}.`, style: "system" },
        ],
    };
}

// ---- Internal: per-action math ----

function applyStrike(session: Session): Outcome {
    const enc = session.encounter!;
    const payed = payAction(session);

    if (enc.next_attacks) {
        // Wrong read. Take the hit.
        return takeHit(payed, "it's faster. it hits you.");
    }
    return dealHit(payed);
}

function applyBrace(session: Session): Outcome {
    const enc = session.encounter!;
    const payed = payAction(session);
    const line: Line = enc.next_attacks
        ? { text: "you brace. it hits but you hold.", style: "success" }
        : { text: "you brace but nothing comes. wasted effort.", style: "private" };

    return advanceRound(payed, [line]);
}

function payAction(session: Session): Session {
    return {
        ...session,
        player: { ...session.player, stamina: session.player.stamina - COST_ACTION },
    };
}

function takeHit(session: Session, prefix: string): Outcome {
    const penalty = Math.max(0, WRONG_STRIKE_PENALTY - defenseBonus(session.player.inventory));
    const newStamina = Math.max(0, session.player.stamina - penalty);
    const lines: Line[] = [{ text: `${prefix} stamina -${penalty}.`, style: "danger" }];

    if (newStamina === 0) {
        lines.push({ text: "you collapse.", style: "danger" });
        return death(session, lines);
    }
    return advanceRound(
        { ...session, player: { ...session.player, stamina: newStamina } },
        lines,
    );
}

function dealHit(session: Session): Outcome {
    const enc = session.encounter!;
    const damage = BASE_STRIKE_DAMAGE + attackBonus(session.player.inventory);
    const remaining = Math.max(0, enc.enemy_hp - damage);

    const lines: Line[] = [
        { text: `you connect. enemy takes ${damage} damage.`, style: "success" },
    ];

    if (remaining === 0) {
        lines.push({ text: "you kill it. its body crumples.", style: "success" });
        return { session: { ...session, encounter: null }, lines };
    }

    return advanceRound(
        { ...session, encounter: { ...enc, enemy_hp: remaining } },
        lines,
    );
}

function advanceRound(session: Session, prelude: Line[]): Outcome {
    const enc = session.encounter!;
    const next = rollNextRound(session.player.depth);
    return {
        session: {
            ...session,
            encounter: {
                ...enc,
                next_attacks: next.attacks,
                started_at: Date.now(),
                current_telegraph: next.telegraph,
                last_result: prelude[0] ?? null,
            },
        },
        lines: [
            ...prelude,
            { text: next.telegraph, style: "system" },
        ],
    };
}

function ignored(session: Session, message: string): Outcome {
    return { session, lines: [{ text: message, style: "private" }] };
}
