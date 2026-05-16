// Shared hooks for screens. Two of them, both small.
//
//   useTerminalHeight — current terminal row count, re-renders on resize.
//   useTextInput      — input string + keyboard wiring (ctrl-c, enter, backspace).
//                       screens supply onSubmit/onExit; the hook owns the rest.

import { useEffect, useState } from "react";
import { useInput, useStdout } from "ink";

export function useTerminalHeight(): number {
    const { stdout } = useStdout();
    const [height, setHeight] = useState(stdout.rows);

    useEffect(() => {
        const onResize = () => setHeight(stdout.rows);
        stdout.on("resize", onResize);
        return () => {
            stdout.off("resize", onResize);
        };
    }, [stdout]);

    return height;
}

interface TextInputOptions {
    onSubmit: (text: string) => void;
    onExit: () => void;
    disabled?: boolean;
    onChange?: () => void;
}

export function useTextInput(opts: TextInputOptions) {
    const [input, setInput] = useState("");

    useInput((char, key) => {
        if (key.ctrl && char === "c") {
            opts.onExit();
            return;
        }
        if (opts.disabled) return;

        if (key.return) {
            opts.onSubmit(input);
            return;
        }
        if (key.backspace || key.delete) {
            setInput((prev) => prev.slice(0, -1));
            opts.onChange?.();
            return;
        }
        if (char && !key.meta && !key.ctrl) {
            setInput((prev) => prev + char);
            opts.onChange?.();
        }
    });

    return [input, setInput] as const;
}
