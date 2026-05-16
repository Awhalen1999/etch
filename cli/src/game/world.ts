// Pure functions about depth: which band, encounter chance, enemy HP.
// All depth ranges come from docs/design.md.

export const STAMINA_BASE_MAX = 100;
export const MAX_DEPTH = 200;

export function bandFor(depth: number): string {
    if (depth <= 0) return "the surface";
    if (depth <= 30) return "the dust";
    if (depth <= 80) return "the stone";
    if (depth <= 120) return "the writing";
    if (depth <= 160) return "the damp";
    if (depth <= 199) return "the quiet";
    return "the queen";
}

export function encounterChance(depth: number): number {
    // TEMP DEV: 25% spawn at depth 5 so combat is reachable without descending past 40.
    // Remove before ship.
    if (depth === 5) return 0.25;

    if (depth <= 40) return 0;
    if (depth <= 80) return 0.05;
    if (depth <= 120) return 0.10;
    if (depth <= 160) return 0.15;
    if (depth <= 199) return 0.20;
    return 0;
}

export function enemyHp(depth: number): number {
    if (depth <= 80) return 100;
    if (depth <= 120) return 175;
    if (depth <= 160) return 225;
    if (depth <= 199) return 275;
    return 1000;  // the queen
}
