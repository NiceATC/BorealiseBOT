/**
 * commands/nowplaying.js
 *
 * !np / !nowplaying — show the currently playing track + live reactions
 */

export default {
  name: "np",
  aliases: ["nowplaying", "tocando", "musica"],
  description: "Mostra a música que está tocando agora.",
  usage: "!np",
  cooldown: 5_000,

  async execute(ctx) {
    const { bot, reply } = ctx;
    const state = bot.getSessionState();

    if (!state.currentTrack?.title) {
      await reply("Nenhuma música tocando no momento.");
      return;
    }

    const { title, artist } = state.currentTrack;
    const dj = state.djName ?? "?";
    const r = state.currentTrackReactions;
    const parts = [`🎵 ${title}${artist ? ` — ${artist}` : ""}`, `DJ: ${dj}`];

    parts.push(`👍 ${r.woots}  👎 ${r.mehs}  🤘 ${r.grabs}`);

    await reply(parts.join("  •  "));
  },
};
