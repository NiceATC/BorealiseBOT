/**
 * commands/blacklist.js
 *
 * !blacklist add [current|source:id]
 * !blacklist remove <current|source:id>
 * !blacklist list [limite]
 * !blacklist info
 */
import {
  addTrackBlacklist,
  removeTrackBlacklist,
  listTrackBlacklist,
  getTrackBlacklist,
} from "../lib/storage.js";

function splitTrackId(trackId) {
  const parts = String(trackId).split(":");
  if (parts.length < 2) return { source: null, sourceId: null };
  const source = parts[0];
  const sourceId = parts.slice(1).join(":");
  return { source, sourceId };
}

export default {
  name: "blacklist",
  aliases: ["bl"],
  description: "Gerencia blacklist de musicas.",
  usage: "!blacklist add|remove|list|info",
  cooldown: 3000,
  minRole: "bouncer",

  async execute(ctx) {
    const { args, reply, bot } = ctx;
    const action = (args[0] ?? "").toLowerCase();

    if (!action) {
      await reply("Uso: !blacklist add|remove|list|info");
      return;
    }

    if (action === "info") {
      const id = bot.getCurrentTrackId();
      const title = bot._currentTrack?.title ?? null;
      const artist = bot._currentTrack?.artist ?? null;
      if (!id) {
        await reply("Nenhuma musica tocando para mostrar info.");
        return;
      }
      const label = artist ? `${artist} - ${title}` : (title ?? "musica");
      await reply(`Musica atual: ${label} | id: ${id}`);
      return;
    }

    if (action === "add") {
      let trackId = args[1] ?? "current";
      if (trackId === "current") {
        trackId = bot.getCurrentTrackId();
      }
      if (!trackId) {
        await reply("Nenhuma musica tocando para adicionar.");
        return;
      }

      const existing = await getTrackBlacklist(trackId);
      if (existing) {
        await reply("Essa musica ja esta na blacklist.");
        return;
      }

      const { source, sourceId } = splitTrackId(trackId);
      const title = bot._currentTrack?.title ?? null;
      const artist = bot._currentTrack?.artist ?? null;

      await addTrackBlacklist({
        trackId,
        source,
        sourceId,
        title,
        artist,
        addedAt: Date.now(),
      });

      await reply("Musica adicionada a blacklist.");
      return;
    }

    if (action === "remove") {
      let trackId = args[1] ?? "";
      if (trackId === "current") {
        trackId = bot.getCurrentTrackId() ?? "";
      }
      if (!trackId) {
        await reply("Uso: !blacklist remove <current|source:id>");
        return;
      }
      await removeTrackBlacklist(trackId);
      await reply("Musica removida da blacklist.");
      return;
    }

    if (action === "list") {
      const limit = Math.max(1, Math.min(50, Number(args[1]) || 10));
      const list = await listTrackBlacklist(limit);
      if (!list.length) {
        await reply("Blacklist vazia.");
        return;
      }
      const items = list.map((t) => t.track_id ?? t.trackId);
      await reply(`Blacklist (max ${limit}): ${items.join(", ")}`);
      return;
    }

    await reply("Acao invalida. Use add, remove, list ou info.");
  },
};
