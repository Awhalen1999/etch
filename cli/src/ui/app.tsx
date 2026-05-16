// Screen router. The top-level state machine:
//
//   loading   →  reading account.json from disk
//   register  →  first launch; prompt for a name, claim it
//   game      →  the main game loop
//
// One screen at a time. Each owns its own input and layout.

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

import { loadAccount, type Account } from "../store/account";
import { Game } from "./game";
import { useTerminalHeight } from "./hooks";
import { Register } from "./register";
import { theme } from "./theme";

type Screen =
    | { kind: "loading" }
    | { kind: "register" }
    | { kind: "game"; account: Account };

export function App() {
    const [screen, setScreen] = useState<Screen>({ kind: "loading" });

    useEffect(() => {
        loadAccount().then((account) => {
            if (account) {
                setScreen({ kind: "game", account });
            } else {
                setScreen({ kind: "register" });
            }
        });
    }, []);

    if (screen.kind === "loading") return <Loading />;
    if (screen.kind === "register") {
        return <Register onReady={(account) => setScreen({ kind: "game", account })} />;
    }
    return <Game account={screen.account} />;
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
