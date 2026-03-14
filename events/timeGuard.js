/**
 * events/timeGuard.js
 *
 * Skips tracks longer than maxSongLengthMin when enabled.
 */

import { Events } from "@borealise/pipeline";
import { getRoleLevel } from "../lib/permissions.js";

export default {
  name: "timeGuard",
  description: "Pula musicas mais longas que o limite configurado.",
  event: Events.ROOM_DJ_ADVANCE,

  async handle(ctx, data) {
    const { bot, api, reply } = ctx;
    if (!bot.cfg.timeGuardEnabled) return;

    const maxMin = Number(bot.cfg.maxSongLengthMin) || 0;
    if (maxMin <= 0) return;

    const media =
      data?.media ?? data?.currentMedia ?? data?.current_media ?? {};
    const duration = Number(media.duration ?? media.length ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) return;

    if (duration <= maxMin * 60) return;

    if (bot.getBotRoleLevel() < getRoleLevel("bouncer")) return;

    const title = media.title ?? bot._currentTrack?.title ?? "musica";
    const artist =
      media.artist ?? media.artistName ?? bot._currentTrack?.artist ?? "";
    const label = artist ? `${artist} - ${title}` : title;
    const mins = Math.ceil(duration / 60);

    try {
      await reply(`Musica muito longa (${mins} min). Pulando: ${label}.`);
      await api.room.skipTrack(bot.cfg.room);
    } catch {
      // best-effort
    }
  },
};
