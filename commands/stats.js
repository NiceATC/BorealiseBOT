/**
 * commands/stats.js
 *
 * !stats — show bot session statistics
 */

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default {
  name: "stats",
  aliases: ["status", "info", "bot"],
  description: "Mostra estatísticas da sessão atual do bot.",
  usage: "!stats",
  cooldown: 8_000,

  async execute(ctx) {
    const { bot, reply } = ctx;
    const s = bot.getSessionState();

    if (!s.startedAt) {
      await reply("Bot ainda não está totalmente conectado.");
      return;
    }

    const uptime = formatUptime(s.uptimeSec);
    const parts = [`⏱ Uptime: ${uptime}`, `👍 Woots dados: ${s.wootCount}`];

    if (s.waitlistPosition) {
      parts.push(`🎧 Fila: #${s.waitlistPosition}/${s.waitlistTotal ?? "?"}`);
    }

    await reply(parts.join("  •  "));
  },
};
