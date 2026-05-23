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
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    })
    const body = await res.json().catch(() => null) as { error?: string } | T | null
    if (!res.ok) {
      const error = (body && typeof body === "object" && "error" in body && body.error) || `request failed (${res.status})`
      return { ok: false, error }
    }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, error: "the wall is silent." }
  }
}
