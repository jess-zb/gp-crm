import { randomBytes } from "crypto";

export function generateAttorneyBatchToken(): string {
  return randomBytes(32).toString("hex");
}
