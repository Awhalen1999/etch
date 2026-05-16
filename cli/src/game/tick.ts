// Heartbeat. Called every 33ms by the UI for smooth combat bar redraws;
// the actual game logic gates itself by time-since-last so the faster tick
// is purely a render concern.
//
// Drives:
//   - stamina recovery while resting
//   - encounter spawn rolls while resting
//   - pre-combat inaction death (15s window with no escalations)
//
// In-combat has no timeout — the player times the bouncing bar at their own pace.

import {
    INACTION_LIMIT_MS,
    newEncounter,
    resolveInactionRound,
    shouldSpawn,
} from "./encounter";
import { maxStamina } from "./items";
import type { Line, Outcome, Session } from "./types";

const RECOVERY_PERIOD_MS = 1_000;
const SPAWN_ROLL_PERIOD_MS = 5_000;

export function tick(session: Session): Outcome {
    let cur = session;
    const lines: Line[] = [];
    const now = Date.now();

    cur = tickRecovery(cur, now);
    const spawned = tickSpawnRoll(cur, now);
    cur = spawned.session;
    lines.push(...spawned.lines);

    const encounterStep = tickEncounter(cur, now);
    cur = encounterStep.session;
    lines.push(...encounterStep.lines);

    return { session: cur, lines };
}

function tickRecovery(session: Session, now: number): Session {
    if (!session.player.resting) return session;
    if (now - session.last_recovery_at < RECOVERY_PERIOD_MS) return session;

    const cap = maxStamina(session.player.inventory);
    if (session.player.stamina >= cap) {
        return { ...session, last_recovery_at: now };
    }
    return {
        ...session,
        player: { ...session.player, stamina: session.player.stamina + 1 },
        last_recovery_at: now,
    };
}

function tickSpawnRoll(session: Session, now: number): Outcome {
    if (session.encounter) return { session, lines: [] };
    if (now - session.last_spawn_roll_at < SPAWN_ROLL_PERIOD_MS) {
        return { session, lines: [] };
    }
    const rolled: Session = { ...session, last_spawn_roll_at: now };
    if (!shouldSpawn(rolled)) return { session: rolled, lines: [] };

    return {
        session: { ...rolled, encounter: newEncounter(rolled.player.depth) },
        lines: [
            { text: "something moves in the dark.", style: "system" },
            { text: "press F to fight, E to escape.", style: "private" },
        ],
    };
}

function tickEncounter(session: Session, now: number): Outcome {
    const enc = session.encounter;
    if (!enc) return { session, lines: [] };

    // In-combat: no timeout — the bouncing bar runs forever.
    if (enc.in_combat) return { session, lines: [] };

    // Pre-combat: 15s window, then death. The visible timer in the scroll
    // is the only signal — no escalation prose, it just runs out.
    const elapsed = now - enc.started_at;
    if (elapsed >= INACTION_LIMIT_MS) {
        return resolveInactionRound(session);
    }
    return { session, lines: [] };
}
