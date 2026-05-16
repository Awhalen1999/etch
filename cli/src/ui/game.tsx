// Main game screen.
//
// State lives in a reducer driven by three action types:
//   - input:  the player typed a text command (only outside encounters)
//   - combat: the player pressed a single key during an encounter
//   - tick:   one heartbeat (~30fps) for the bouncing bar + timers
//
// Layout swaps based on encounter state:
//   - no encounter   → HUD + scroll + input
//   - pre-combat     → HUD + scroll (timer appended as last line) + input
//   - in-combat      → HUD + CombatScene (full-height combat layout)

import React, { useEffect, useReducer } from "react";
import { Box, Text, useApp, useInput } from "ink";

import { runCommand } from "../game/commands";
import {
    applyEscape,
    applyFight,
    applyTimedAction,
    INACTION_LIMIT_MS,
} from "../game/encounter";
import { maxStamina } from "../game/items";
import { tick } from "../game/tick";
import type { EncounterState, Line, PlayerState, Session } from "../game/types";
import { bandFor } from "../game/world";
import type { Account } from "../store/account";
import { saveSave } from "../store/save";
import { CombatScene } from "./combat-scene";
import { useTerminalHeight, useTextInput } from "./hooks";
import { colorFor } from "./line-color";
import { theme } from "./theme";

const HUD_ROWS = 2;          // 1 content + 1 divider
const BOTTOM_ROWS = 2;       // 1 content + 1 divider (input bar)
const CHROME_ROWS = HUD_ROWS + BOTTOM_ROWS;
const TIMER_BAR_WIDTH = 24;

const TICK_INTERVAL_MS = 33;  // ~30fps for smooth combat bar
const MAX_LINES = 200;

type CombatKey = "fight" | "strike" | "brace" | "escape";

interface Props {
    account: Account;
    initialPlayer: PlayerState;
}

interface State {
    session: Session;
    lines: Line[];
}

type Action =
    | { type: "input"; text: string }
    | { type: "combat"; key: CombatKey }
    | { type: "tick" };

function reducer(state: State, action: Action): State {
    const { session, lines } = state;

    let outcome;
    let echo: Line[] = [];

    if (action.type === "input") {
        echo = [{ text: `> ${action.text}`, style: "input" }];
        outcome = runCommand(session, action.text);
    } else if (action.type === "tick") {
        outcome = tick(session);
    } else {
        outcome = runCombat(session, action.key);
    }

    const next = [...lines, ...echo, ...outcome.lines];
    const trimmed = next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    return { session: outcome.session, lines: trimmed };
}

function runCombat(session: Session, key: CombatKey) {
    if (key === "fight")  return applyFight(session);
    if (key === "strike") return applyTimedAction(session, "strike");
    if (key === "brace")  return applyTimedAction(session, "brace");
    return applyEscape(session);
}

function initialState(account: Account, player: PlayerState): State {
    const now = Date.now();
    return {
        session: {
            player,
            encounter: null,
            last_moved_at: 0,
            last_recovery_at: now,
            last_spawn_roll_at: now,
            pending_item: null,
        },
        lines: [
            { text: `welcome, ${account.name}.`, style: "system" },
            { text: "the only way is down.", style: "system" },
            { text: "", style: "system" },
            { text: "type /help for commands. /quit to leave.", style: "private" },
        ],
    };
}

export function Game({ account, initialPlayer }: Props) {
    const { exit } = useApp();
    const height = useTerminalHeight();

    const [state, dispatch] = useReducer(reducer, null, () =>
        initialState(account, initialPlayer),
    );

    const encounter = state.session.encounter;
    const inEncounter = encounter !== null;
    const inCombat = encounter?.in_combat ?? false;

    // Pump tick actions every ~33ms (30fps) for smooth combat bar redraws.
    useEffect(() => {
        const id = setInterval(() => dispatch({ type: "tick" }), TICK_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    // Persist player state on every change.
    useEffect(() => {
        void saveSave(state.session.player);
    }, [state.session.player]);

    // Combat keys: single keystrokes during an encounter.
    useInput((char) => {
        if (!inEncounter) return;
        const c = char.toLowerCase();

        if (c === "e") {
            dispatch({ type: "combat", key: "escape" });
            return;
        }
        if (!inCombat) {
            if (c === "f") dispatch({ type: "combat", key: "fight" });
            return;
        }
        // In-combat: S or B is decision + execution in one press.
        if (c === "s") dispatch({ type: "combat", key: "strike" });
        else if (c === "b") dispatch({ type: "combat", key: "brace" });
    });

    // Text input. Disabled during encounters so combat keys aren't buffered.
    const [input, setInput] = useTextInput({
        onExit: exit,
        disabled: inEncounter,
        onSubmit: (text) => {
            const cmd = text.trim();
            if (!cmd) return;
            setInput("");
            if (cmd === "/quit") {
                exit();
                return;
            }
            dispatch({ type: "input", text: cmd });
        },
    });

    const player = state.session.player;
    const hud = (
        <Hud
            name={account.name}
            depth={player.depth}
            stamina={player.stamina}
            maxStamina={maxStamina(player.inventory)}
            deepest={player.deepest_depth}
        />
    );

    // In-combat: HUD on top, CombatScene fills the rest.
    if (inCombat && encounter) {
        return (
            <Box flexDirection="column" height={height}>
                {hud}
                <CombatScene encounter={encounter} />
            </Box>
        );
    }

    // Outside combat: HUD + scroll + input bar. The input bar stays visually
    // unchanged across normal play and pre-combat; during pre-combat it's
    // disabled so F/E aren't buffered as text. The pre-combat timer renders
    // as the last line inside the scroll (right under the encounter prose).
    const preCombat = encounter && !encounter.in_combat ? encounter : null;
    const reserved = preCombat ? 1 : 0;
    const visibleLines = state.lines.slice(-Math.max(1, height - CHROME_ROWS - reserved));
    return (
        <Box flexDirection="column" height={height}>
            {hud}
            <Scroll lines={visibleLines} preCombat={preCombat} />
            <Bottom input={input} band={bandFor(player.depth)} />
        </Box>
    );
}

// ---- Regions ----

interface HudProps {
    name: string;
    depth: number;
    stamina: number;
    maxStamina: number;
    deepest: number;
}

function Hud({ name, depth, stamina, maxStamina, deepest }: HudProps) {
    return (
        <Box
            paddingX={2}
            borderStyle="single"
            borderTop={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.rule}
        >
            <Text color={theme.accent}>{name}</Text>
            <Text color={theme.rule}> · </Text>
            <Text color={theme.dim}>depth </Text>
            <Text color={theme.accent}>{depth}</Text>
            <Text color={theme.rule}> · </Text>
            <Text color={theme.dim}>stamina </Text>
            <Text color={theme.accent}>{stamina}/{maxStamina}</Text>
            <Text color={theme.rule}> · </Text>
            <Text color={theme.dim}>deepest </Text>
            <Text color={theme.accent}>{deepest}</Text>
        </Box>
    );
}

function Scroll({
    lines,
    preCombat,
}: {
    lines: Line[];
    preCombat: EncounterState | null;
}) {
    return (
        <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1}>
            {lines.map((line, i) => (
                <Text key={i} color={colorFor(line.style)}>
                    {line.text}
                </Text>
            ))}
            {preCombat && <TimerLine encounter={preCombat} />}
        </Box>
    );
}

// Pre-combat timer. Rendered as the final line inside Scroll so it sits
// directly under the encounter prose ("press F to fight, E to escape.").
function TimerLine({ encounter }: { encounter: EncounterState }) {
    const elapsed = Date.now() - encounter.started_at;
    const remaining = Math.max(0, INACTION_LIMIT_MS - elapsed);
    const fraction = remaining / INACTION_LIMIT_MS;

    const filled = Math.floor(fraction * TIMER_BAR_WIDTH);
    const empty = TIMER_BAR_WIDTH - filled;
    const bar = "▓".repeat(filled) + "░".repeat(empty);
    const seconds = (remaining / 1000).toFixed(1);

    const color =
        fraction > 0.6 ? theme.accent :
        fraction > 0.3 ? theme.fg :
                         theme.danger;

    return (
        <Box>
            <Text color={color}>{bar}</Text>
            <Text color={theme.dim}>  {seconds}s</Text>
        </Box>
    );
}

function Bottom({ input, band }: { input: string; band: string }) {
    return (
        <Box
            paddingX={2}
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.rule}
            justifyContent="space-between"
        >
            <Box>
                <Text color={theme.accent}>{"› "}</Text>
                <Text color={theme.fg}>{input}</Text>
                <Text color={theme.accent}>█</Text>
            </Box>
            <Text color={theme.accent}>{band}</Text>
        </Box>
    );
}
