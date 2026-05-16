// Account = the player's identity (name + server-issued token).
// Persisted to ~/.etch/account.json. Created once on first launch.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const ACCOUNT_DIR = path.join(os.homedir(), ".etch");
const ACCOUNT_PATH = path.join(ACCOUNT_DIR, "account.json");

export interface Account {
    name: string;
    token: string;
}

export async function loadAccount(): Promise<Account | null> {
    try {
        const raw = await fs.readFile(ACCOUNT_PATH, "utf-8");
        const data = JSON.parse(raw) as Partial<Account>;
        if (typeof data.name !== "string" || typeof data.token !== "string") return null;
        return { name: data.name, token: data.token };
    } catch {
        return null;
    }
}

export async function saveAccount(account: Account): Promise<void> {
    await fs.mkdir(ACCOUNT_DIR, { recursive: true });
    await fs.writeFile(ACCOUNT_PATH, JSON.stringify(account, null, 2), "utf-8");
}
