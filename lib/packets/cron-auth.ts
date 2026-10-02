import { verifyVercelCronRequest } from "@/lib/cron/verify-vercel-cron-request";

export function isPacketCronAuthorized(req: Request): boolean {
  return verifyVercelCronRequest(req);
}
