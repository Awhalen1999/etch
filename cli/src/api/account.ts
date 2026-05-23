import { request, type Result } from "./client.ts"
import type { Account } from "../store/account.ts"

export function claimName(name: string): Promise<Result<Account>> {
  return request<Account>("/api/account", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}
