import { pgOne } from "./pg.server";
import { logger } from "./logger.server";

let lastAbsenceSync = 0;

export async function syncExpiredMemberAbsences(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastAbsenceSync < 60_000) return 0;
  lastAbsenceSync = now;

  try {
    const row = await pgOne<{ expired: number }>(
      "select public.expire_member_absences()::int as expired",
    );
    return row?.expired ?? 0;
  } catch (error) {
    logger.warn("expire_member_absences_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
