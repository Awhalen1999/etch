// First-launch screen. Prompts the player for a name, claims it via the API,
// saves the returned token, then hands the account up to the App.

import React, { useState } from "react";
import { Box, Text, useApp } from "ink";

import { createAccount } from "../api/client";
import { saveAccount, type Account } from "../store/account";
import { useTerminalHeight, useTextInput } from "./hooks";
import { theme } from "./theme";

interface Props {
    onReady: (account: Account) => void;
}

export function Register({ onReady }: Props) {
    const { exit } = useApp();
    const height = useTerminalHeight();

    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [input] = useTextInput({
        onExit: exit,
        disabled: submitting,
        onChange: () => setError(null),
        onSubmit: async (text) => {
            const name = text.trim().toLowerCase();
            if (!name) return;

            setSubmitting(true);
            setError(null);

            const result = await createAccount(name);
            if (!result.ok) {
                setError(result.error);
                setSubmitting(false);
                return;
            }

            await saveAccount(result.value);
            onReady(result.value);
        },
    });

    return (
        <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height={height}
        >
            <Text color={theme.dim}>the surface is dying.</Text>
            <Box marginTop={1}>
                <Text color={theme.fg}>pick a name. you keep it for as long as you live.</Text>
            </Box>

            <Box marginTop={2}>
                <Text color={theme.accent}>{"› "}</Text>
                <Text color={theme.fg}>{input}</Text>
                <Text color={theme.accent}>{submitting ? "  …claiming" : "█"}</Text>
            </Box>

            {error && (
                <Box marginTop={1}>
                    <Text color={theme.danger}>{error}</Text>
                </Box>
            )}
        </Box>
    );
}
