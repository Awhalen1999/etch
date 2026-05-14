// etch — inscription API.
//
// Three routes plus a sanity-check root:
//   GET  /                      → "etch api"
//   POST /api/account           → claim a name, get a token
//   POST /api/inscriptions      → carve an inscription (token required)
//   GET  /api/inscriptions      → list all inscriptions (supports If-None-Match)
//
// Backed by Cloudflare D1 (two tables: accounts, inscriptions).

// ---- Types ----

export interface Env {
    DB: D1Database;
}

interface Inscription {
    id: number;
    name: string;
    depth: number;
    text: string;
    written_at: string;
}

// ---- Constants ----

const NAME_MIN = 3;
const NAME_MAX = 32;
const NAME_REGEX = /^[a-z0-9_]+$/;

const RESERVED_NAMES = [
    "system", "admin", "etch", "horris", "server", "owner",
    "mod", "moderator", "root", "keeper", "null", "none",
    "nobody", "anonymous", "bot",
];

const TEXT_MAX = 240;

const DEPTH_MIN = 1;
const DEPTH_MAX = 200;

const CACHE_SECONDS = 30;

// ---- Entry point ----

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            return await route(request, env);
        } catch (err) {
            console.error("internal error:", err);
            return json({ error: "internal error" }, 500);
        }
    },
};

async function route(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    if (method === "OPTIONS") return preflight();

    if (method === "GET" && path === "/") return root();

    if (method === "POST" && path === "/api/account") return createAccount(request, env);
    if (method === "POST" && path === "/api/inscriptions") return createInscription(request, env);
    if (method === "GET" && path === "/api/inscriptions") return listInscriptions(request, env);

    return json({ error: "not found" }, 404);
}

// ---- Routes ----

function root(): Response {
    return new Response("etch api\n", {
        headers: { "content-type": "text/plain", ...corsHeaders() },
    });
}

async function createAccount(request: Request, env: Env): Promise<Response> {
    const body = await readJson<{ name?: string }>(request);
    if (!body) return json({ error: "invalid json" }, 400);

    const name = body.name?.trim().toLowerCase();
    const error = validateName(name);
    if (error) return json({ error }, 400);

    const existing = await env.DB
        .prepare("SELECT name FROM accounts WHERE name = ?")
        .bind(name)
        .first();
    if (existing) return json({ error: "name taken" }, 409);

    const token = crypto.randomUUID();
    await env.DB
        .prepare("INSERT INTO accounts (name, token) VALUES (?, ?)")
        .bind(name, token)
        .run();

    return json({ name, token });
}

async function createInscription(request: Request, env: Env): Promise<Response> {
    const body = await readJson<{
        name?: string;
        token?: string;
        depth?: number;
        text?: string;
    }>(request);
    if (!body) return json({ error: "invalid json" }, 400);

    if (!body.name || !body.token) return json({ error: "missing credentials" }, 401);
    if (typeof body.depth !== "number") return json({ error: "depth required" }, 400);
    if (typeof body.text !== "string") return json({ error: "text required" }, 400);

    const depthError = validateDepth(body.depth);
    if (depthError) return json({ error: depthError }, 400);

    const text = body.text.trim();
    const textError = validateText(text);
    if (textError) return json({ error: textError }, 400);

    const ok = await verifyToken(env, body.name, body.token);
    if (!ok) return json({ error: "unauthorized" }, 401);

    await env.DB
        .prepare("INSERT INTO inscriptions (name, depth, text) VALUES (?, ?, ?)")
        .bind(body.name, body.depth, text)
        .run();

    const inscriptions = await fetchAllInscriptions(env);
    return json(inscriptions, 200, { etag: computeEtag(inscriptions) });
}

async function listInscriptions(request: Request, env: Env): Promise<Response> {
    // Cheap query first: just count + max id, for the ETag check.
    const meta = await env.DB
        .prepare("SELECT COUNT(*) as count, MAX(id) as max_id FROM inscriptions")
        .first<{ count: number; max_id: number | null }>();
    const etag = `"${meta?.count ?? 0}-${meta?.max_id ?? 0}"`;

    if (request.headers.get("If-None-Match") === etag) {
        return new Response(null, {
            status: 304,
            headers: {
                etag,
                "cache-control": `public, max-age=${CACHE_SECONDS}`,
                ...corsHeaders(),
            },
        });
    }

    const inscriptions = await fetchAllInscriptions(env);
    return json(inscriptions, 200, {
        etag,
        "cache-control": `public, max-age=${CACHE_SECONDS}`,
    });
}

// ---- Validation ----

function validateName(name: string | undefined): string | null {
    if (!name) return "name required";
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
        return `name must be ${NAME_MIN}-${NAME_MAX} characters`;
    }
    if (!NAME_REGEX.test(name)) {
        return "name can only contain lowercase letters, digits, and underscore";
    }
    if (RESERVED_NAMES.includes(name)) return "that name is reserved";
    return null;
}

function validateDepth(depth: number): string | null {
    if (!Number.isInteger(depth)) return "depth must be an integer";
    if (depth < DEPTH_MIN || depth > DEPTH_MAX) {
        return `depth must be ${DEPTH_MIN}-${DEPTH_MAX}`;
    }
    return null;
}

function validateText(text: string): string | null {
    if (text.length === 0) return "text is empty";
    if (text.length > TEXT_MAX) return `text must be ${TEXT_MAX} characters or fewer`;
    return null;
}

// ---- Database helpers ----

async function verifyToken(env: Env, name: string, token: string): Promise<boolean> {
    const row = await env.DB
        .prepare("SELECT token FROM accounts WHERE name = ?")
        .bind(name)
        .first<{ token: string }>();
    return !!row && row.token === token;
}

async function fetchAllInscriptions(env: Env): Promise<Inscription[]> {
    const result = await env.DB
        .prepare("SELECT id, name, depth, text, written_at FROM inscriptions ORDER BY written_at DESC")
        .all<Inscription>();
    return result.results ?? [];
}

function computeEtag(inscriptions: Inscription[]): string {
    const count = inscriptions.length;
    const maxId = count === 0 ? 0 : inscriptions[0].id;
    return `"${count}-${maxId}"`;
}

// ---- Request helpers ----

async function readJson<T>(request: Request): Promise<T | null> {
    try {
        return (await request.json()) as T;
    } catch {
        return null;
    }
}

// ---- Response helpers ----

function json(
    data: unknown,
    status = 200,
    extraHeaders: Record<string, string> = {},
): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json",
            ...corsHeaders(),
            ...extraHeaders,
        },
    });
}

function preflight(): Response {
    return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(): Record<string, string> {
    return {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, if-none-match",
    };
}
