// CombatScene replaces the scroll + bottom regions during in-combat.
//
// Layout (vertical stack, fills available height):
//   ENEMY   — name + HP bar
//   MOMENT  — current telegraph (bright) + last result (dimmed)
//   TIMING  — bouncing bar with sweet spot + key hints
//
// The player's HUD stays at the very top (rendered by Game).

import React from "react";
import { Box, Text } from "ink";

import { barPosition, SWEET_END, SWEET_START } from "../game/encounter";
import type { EncounterState, Line } from "../game/types";
import { colorFor } from "./line-color";
import { theme } from "./theme";

const BAR_WIDTH = 28;
const HP_BAR_WIDTH = 20;

interface Props {
    encounter: EncounterState;
}

export function CombatScene({ encounter }: Props) {
    return (
        <Box flexDirection="column" flexGrow={1}>
            <Enemy encounter={encounter} />
            <Moment encounter={encounter} />
            <Timing encounter={encounter} />
        </Box>
    );
}

// ---- Enemy region ----

function Enemy({ encounter }: { encounter: EncounterState }) {
    const fraction = encounter.enemy_hp / encounter.enemy_max_hp;
    const filled = Math.ceil(fraction * HP_BAR_WIDTH);
    const empty = HP_BAR_WIDTH - filled;
    const hpBar = "▓".repeat(filled) + "░".repeat(empty);

    return (
        <Box
            flexDirection="column"
            paddingX={2}
            paddingY={1}
            borderStyle="single"
            borderTop={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.rule}
        >
            <Text color={theme.dim}>something in the dark</Text>
            <Box marginTop={1}>
                <Text color={theme.danger}>{hpBar}</Text>
                <Text color={theme.dim}>  HP </Text>
                <Text color={theme.accent}>
                    {encounter.enemy_hp}/{encounter.enemy_max_hp}
                </Text>
            </Box>
        </Box>
    );
}

// ---- Moment region (current telegraph + last result) ----

function Moment({ encounter }: { encounter: EncounterState }) {
    return (
        <Box
            flexDirection="column"
            flexGrow={1}
            paddingX={2}
            paddingY={1}
        >
            <Text color={theme.fg}>{encounter.current_telegraph}</Text>
            {encounter.last_result && (
                <Box marginTop={1}>
                    <Text color={dimmedColor(encounter.last_result)}>
                        {encounter.last_result.text}
                    </Text>
                </Box>
            )}
        </Box>
    );
}

// "Dim" a result line so it reads as history. Keep its semantic color but
// fall back to dim if it'd otherwise be too bright.
function dimmedColor(line: Line): string {
    if (line.style === "danger") return theme.danger;
    if (line.style === "success") return theme.chat;
    return theme.dim;
}

// ---- Timing region ----

// Sub-cell partial-fill characters for smooth motion.
// Index 0 = empty, 1-7 = 1/8 through 7/8 fill, beyond uses full block.
const PARTIAL_CHARS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

function Timing({ encounter }: { encounter: EncounterState }) {
    const elapsed = Date.now() - encounter.started_at;
    const position = barPosition(elapsed);

    const sweetStart = Math.floor(SWEET_START * BAR_WIDTH);
    const sweetEnd = Math.floor(SWEET_END * BAR_WIDTH);

    const segments = buildBouncingBar(position, sweetStart, sweetEnd);

    return (
        <Box
            flexDirection="column"
            paddingX={2}
            paddingY={1}
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.rule}
        >
            <Box>
                {segments.map((seg, i) => (
                    <Text key={i} color={seg.color}>{seg.text}</Text>
                ))}
            </Box>
            <Box marginTop={1}>
                <KeyHint letter="S" rest="trike" />
                <Text color={theme.dim}>    </Text>
                <KeyHint letter="B" rest="race" />
                <Text color={theme.dim}>    </Text>
                <KeyHint letter="E" rest="scape" />
            </Box>
        </Box>
    );
}

interface Seg {
    text: string;
    color: string;
}

// Fill bar: grows smoothly with sub-cell precision (8 sub-cells per character).
// The sweet spot zone is always visible in the empty bar via theme.accent;
// when fill reaches it, the cells brighten to theme.fg.
function buildBouncingBar(position: number, sweetStart: number, sweetEnd: number): Seg[] {
    const subUnits = BAR_WIDTH * 8;
    const subPos = position * subUnits;
    const fullCells = Math.floor(subPos / 8);
    const partialIdx = Math.floor(subPos) % 8;

    const segs: Seg[] = [];
    for (let i = 0; i < BAR_WIDTH; i++) {
        const inSweet = i >= sweetStart && i < sweetEnd;
        const isFull = i < fullCells;
        const isLeading = i === fullCells && partialIdx > 0;

        let text: string;
        let color: string;

        if (isFull) {
            text = "█";
            color = inSweet ? theme.fg : theme.accent;
        } else if (isLeading) {
            text = PARTIAL_CHARS[partialIdx]!;
            color = inSweet ? theme.fg : theme.accent;
        } else {
            text = "░";
            color = inSweet ? theme.accent : theme.dim;
        }

        const last = segs[segs.length - 1];
        if (last && last.color === color) {
            last.text += text;
        } else {
            segs.push({ text, color });
        }
    }
    return segs;
}

function KeyHint({ letter, rest }: { letter: string; rest: string }) {
    return (
        <Box>
            <Text color={theme.accent}>[{letter}]</Text>
            <Text color={theme.dim}>{rest}</Text>
        </Box>
    );
}
