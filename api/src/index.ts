// etch — inscription API.
// Real route handlers land in phase 3. This stub just proves the Worker runs.

export interface Env {
    DB: D1Database;
}

export default {
    async fetch(_request: Request, _env: Env): Promise<Response> {
        return new Response("etch api\n", {
            headers: { "content-type": "text/plain" },
        });
    },
};
