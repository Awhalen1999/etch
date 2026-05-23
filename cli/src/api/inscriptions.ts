// Inscriptions endpoints. /read reads from the local cache; this is
// the source that fills and refreshes that cache (GET) and the writer
// for /mark (POST).

import { request, type Result } from "./client.ts"
import type { Inscription } from "../game/types.ts"

export function getInscriptions(): Promise<Result<Inscription[]>> {
  return request<Inscription[]>("/api/inscriptions")
}

export function postInscription(
  name: string,
  token: string,
  depth: number,
  text: string,
): Promise<Result<Inscription[]>> {
  return request<Inscription[]>("/api/inscriptions", {
    method: "POST",
    body: JSON.stringify({ name, token, depth, text }),
  })
}
