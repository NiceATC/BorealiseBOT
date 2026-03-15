/**
 * events/mediaCheck.js
 *
 * Checks YouTube availability/age restriction on DJ advance.
 * If blocked, skips the track and notifies the chat.
 */

import { Events } from "@borealise/pipeline";
import ytdl from "ytdl-core";
import { getRoleLevel } from "../../lib/permissions.js";

const YOUTUBE_SOURCES = new Set(["youtube", "yt", "ytmusic", "youtubemusic"]);

function getMediaId(media) {
  return (
    media?.sourceId ??
    media?.source_id ??
    media?.youtubeId ??
    media?.youtube_id ??
    media?.cid ??
    media?.videoId ??
    media?.video_id ??
    null
  );
}

function isYoutubeSource(media) {
  const source = String(media?.source ?? media?.platform ?? "").toLowerCase();
  if (!source) return true;
  if (YOUTUBE_SOURCES.has(source)) return true;
  return source.includes("youtube");
}

function getLabel(media, bot) {
  const title = media?.title ?? bot?._currentTrack?.title ?? "musica";
  const artist =
    media?.artist ??
    media?.artistName ??
    media?.artist_name ??
    bot?._currentTrack?.artist ??
    "";
  return artist ? `${artist} - ${title}` : title;
}

function getPlayability(info) {
  const status =
    info?.player_response?.playabilityStatus?.status ??
    info?.playabilityStatus?.status ??
    "";
  const reason =
    info?.player_response?.playabilityStatus?.reason ??
    info?.playabilityStatus?.reason ??
    "";
  const ageRestricted = Boolean(
    info?.videoDetails?.age_restricted ?? info?.videoDetails?.ageRestricted,
  );
  return { status: String(status), reason: String(reason), ageRestricted };
}

export default {
  name: "mediaCheck",
  description: "Verifica indisponibilidade e restricao de idade no YouTube.",
  event: Events.ROOM_DJ_ADVANCE,

  async handle(ctx, data) {
    const { bot, api, reply } = ctx;
    if (bot.getBotRoleLevel() < getRoleLevel("bouncer")) return;

    const media =
      data?.media ?? data?.currentMedia ?? data?.current_media ?? {};
    if (!isYoutubeSource(media)) return;

    const videoId = getMediaId(media);
    if (!videoId) return;

    if (typeof ytdl.validateID === "function" && !ytdl.validateID(videoId)) {
      return;
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    let info;
    try {
      info = await ytdl.getBasicInfo(url);
    } catch {
      const label = getLabel(media, bot);
      try {
        await reply(`Musica indisponivel. Pulando: ${label}.`);
        await api.room.skipTrack(bot.cfg.room);
      } catch {
        // best-effort
      }
      return;
    }

    const { status, reason, ageRestricted } = getPlayability(info);
    const restricted = ageRestricted || (reason && /age|idade/i.test(reason));

    if (status === "OK" && !restricted) return;

    const label = getLabel(media, bot);
    const reasonText = restricted ? "restricao de idade" : "indisponivel";
    const detail = reason ? ` (${reason})` : "";

    try {
      await reply(`Musica ${reasonText}${detail}. Pulando: ${label}.`);
      await api.room.skipTrack(bot.cfg.room);
    } catch {
      // best-effort
    }
  },
};
