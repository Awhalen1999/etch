// Thin fetch wrapper around the etch API.
// One function per endpoint, each returning a Result.

import type { Account } from "../store/account";

const API_BASE = process.env.ETCH_API_URL ?? "http://localhost:8787";

export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; error: string };

export async function createAccount(name: string): Promise<Result<Account>> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/api/account`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name }),
        });
    } catch {
        return { ok: false, error: "could not reach the server" };
    }

    const data = (await res.json().catch(() => ({}))) as {
        name?: string;
        token?: string;
        error?: string;
    };

    if (!res.ok) {
        return { ok: false, error: data.error ?? `error ${res.status}` };
    }
    if (!data.name || !data.token) {
        return { ok: false, error: "bad response from server" };
    }
    return { ok: true, value: { name: data.name, token: data.token } };
}
