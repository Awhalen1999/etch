// Fetch wrapper for api.etch.rip.
//
// Every call returns a Result so callers can render errors without
// try/catch noise. Network failures and non-OK responses both surface
// as { ok: false, error }.
//
// Override the base URL with the ETCH_API_URL env var (used by `pnpm dev`
// to point at a local wrangler instance).

const BASE = process.env.ETCH_API_URL ?? "https://etch-api.awhalendev.workers.dev"

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function request<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    })
  } catch {
    return { ok: false, error: "the wall is silent." }
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: errorMessage(body, res.status) }
  }
  return { ok: true, data: body as T }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error
  }
  return `request failed (${status})`
}
