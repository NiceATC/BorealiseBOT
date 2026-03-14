/**
 * events/waitlistSnapshot.js
 *
 * Saves the current waitlist snapshot for DC restore.
 */

import { Events } from "@borealise/pipeline";
import { upsertWaitlistSnapshot } from "../lib/storage.js";

export default {
  name: "waitlistSnapshot",
  description: "Salva a fila atual para o comando !dc.",
  event: Events.ROOM_WAITLIST_UPDATE,
  cooldown: 2000,

  async handle(ctx) {
    try {
      const res = await ctx.api.room.getWaitlist(ctx.room);
      const waitlist = res?.data?.data?.waitlist ?? res?.data?.waitlist ?? [];
      if (!Array.isArray(waitlist) || waitlist.length === 0) return;

      const entries = waitlist.map((u, idx) => ({
        userId: u.id ?? u.userId ?? u.user_id,
        username: u.username ?? null,
        displayName: u.displayName ?? u.display_name ?? null,
        position: idx + 1,
      }));

      await upsertWaitlistSnapshot(entries);
    } catch {
      // best-effort
    }
  },
};
