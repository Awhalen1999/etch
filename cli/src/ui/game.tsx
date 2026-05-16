// Main game screen. Three regions stacked vertically:
// HUD (top), scroll area (middle), input bar (bottom).

import React, { useState } from "react";
import { Box, Text, useApp } from "ink";

import type { Account } from "../store/account";
import { useTerminalHeight, useTextInput } from "./hooks";
import { theme } from "./theme";

// Vertical space reserved for the HUD and input bars.
// Each is one row of content + one row of divider.
const HUD_ROWS = 2;
const BOTTOM_ROWS = 2;
const CHROME_ROWS = HUD_ROWS + BOTTOM_ROWS;

interface Props {
    account: Account;
}

export function Game({ account }: Props) {
    const { exit } = useApp();
    const height = useTerminalHeight();

    const [lines, setLines] = useState<string[]>([
        `welcome, ${account.name}.`,
        "the only way is down.",
        "",
        "(type anything and press enter to echo. ctrl-c to quit.)",
    ]);

    const [input, setInput] = useTextInput({
        onExit: exit,
        onSubmit: (text) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            setLines((prev) => [...prev, `> ${trimmed}`]);
            setInput("");
        },
    });

    const visibleLines = lines.slice(-Math.max(1, height - CHROME_ROWS));

    return (
        <Box flexDirection="column" height={height}>
            <Hud
                name={account.name}
                depth="—"
                stamina="—"
                deepest="—"
            />
            <Scroll lines={visibleLines} />
            <Bottom input={input} band="the surface" />
        </Box>
    );
}

// ---- Regions ----

interface HudProps {
    name: string;
    depth: string;
    stamina: string;
    deepest: string;
}

function Hud({ name, depth, stamina, deepest }: HudProps) {
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
            <Text color={theme.accent}>{stamina}</Text>
            <Text color={theme.rule}> · </Text>
            <Text color={theme.dim}>deepest </Text>
            <Text color={theme.accent}>{deepest}</Text>
        </Box>
    );
}

function Scroll({ lines }: { lines: string[] }) {
    return (
        <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1}>
            {lines.map((line, i) => (
                <Text key={i} color={theme.fg}>
                    {line}
                </Text>
            ))}
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
