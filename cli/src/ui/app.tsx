// Screen router. The top-level state machine:
//
//   loading   →  reading account.json + save.json from disk
//   register  →  first launch; prompt for a name, claim it
//   game      →  the main game loop
//
// One screen at a time. Each owns its own input and layout.

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

import type { PlayerState } from "../game/types";
import { loadAccount, type Account } from "../store/account";
import { defaultPlayer, loadSave } from "../store/save";
import { Game } from "./game";
import { useTerminalHeight } from "./hooks";
import { Register } from "./register";
import { theme } from "./theme";

type Screen =
    | { kind: "loading" }
    | { kind: "register" }
    | { kind: "game"; account: Account; initialPlayer: PlayerState };

export function App() {
    const [screen, setScreen] = useState<Screen>({ kind: "loading" });

    useEffect(() => {
        (async () => {
            const account = await loadAccount();
            if (!account) {
                setScreen({ kind: "register" });
                return;
            }
            const player = (await loadSave()) ?? defaultPlayer();
            setScreen({ kind: "game", account, initialPlayer: player });
        })();
    }, []);

    if (screen.kind === "loading") return <Loading />;
    if (screen.kind === "register") {
        return (
            <Register
                onReady={async (account) => {
                    const player = (await loadSave()) ?? defaultPlayer();
                    setScreen({ kind: "game", account, initialPlayer: player });
                }}
            />
        );
    }
    return <Game account={screen.account} initialPlayer={screen.initialPlayer} />;
}

function Loading() {
    const height = useTerminalHeight();
    return (
        <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height={height}
        >
            <Text color={theme.dim}>etch.</Text>
        </Box>
    );
}
