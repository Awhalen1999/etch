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
