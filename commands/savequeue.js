/**
 * commands/savequeue.js
 *
 * !savequeue - salva a fila atual (usuarios e posicoes)
 */

import { upsertWaitlistSnapshot } from "../lib/storage.js";

export default {
  name: "savequeue",
  aliases: ["savewl", "savefila", "cachefila"],
  description: "Salva a fila atual para uso no comando !dc.",
  usage: "!savequeue",
  cooldown: 5000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, reply } = ctx;
    try {
      const res = await api.room.getWaitlist(bot.cfg.room);
      const waitlist = res?.data?.data?.waitlist ?? res?.data?.waitlist ?? [];
      if (!Array.isArray(waitlist) || waitlist.length === 0) {
        await reply("Fila vazia.");
        return;
      }
      const entries = waitlist.map((u, idx) => ({
        userId: u.id ?? u.userId ?? u.user_id,
        username: u.username ?? null,
        displayName: u.displayName ?? u.display_name ?? null,
        position: idx + 1,
      }));
      await upsertWaitlistSnapshot(entries);
      await reply(`Fila salva: ${entries.length} usuarios.`);
    } catch (err) {
      await reply(`Erro ao salvar fila: ${err.message}`);
    }
  },
};
