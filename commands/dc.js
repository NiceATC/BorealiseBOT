/**
 * commands/dc.js
 *
 * !dc [usuario] - restaura a posicao do usuario na fila se o DC foi recente
 */

import { getWaitlistSnapshot } from "../lib/storage.js";
import { ROLE_LEVELS } from "../lib/permissions.js";

const DC_WINDOW_MS = 10 * 60 * 1000;

export default {
  name: "dc",
  aliases: ["dclookup"],
  description: "Restaura a posicao do usuario na fila se o DC foi recente.",
  usage: "!dc [usuario]",
  cooldown: 5000,

  async execute(ctx) {
    const { api, bot, args, sender, senderRoleLevel, reply } = ctx;
    const targetInput = (args[0] ?? sender.username ?? sender.displayName ?? "")
      .replace(/^@/, "")
      .trim();

    if (!targetInput) {
      await reply("Uso: !dc [usuario]");
      return;
    }

    const user = bot.findRoomUser(targetInput);
    if (!user) {
      await reply(`Usuario "${targetInput}" nao encontrado na sala.`);
      return;
    }

    const isSelf = String(user.userId) === String(sender.userId ?? "");
    if (!isSelf && senderRoleLevel < ROLE_LEVELS.bouncer) {
      await reply("Sem permissao para usar !dc em outro usuario.");
      return;
    }

    const snap = await getWaitlistSnapshot(user.userId);
    if (!snap) {
      await reply("Sem registro de fila para este usuario.");
      return;
    }

    const updatedAt = Number(snap.updated_at ?? snap.updatedAt ?? 0);
    if (!updatedAt || Date.now() - updatedAt > DC_WINDOW_MS) {
      await reply("Tempo limite excedido para restaurar a posicao.");
      return;
    }

    let position = Number(snap.position ?? 0);
    if (!Number.isFinite(position) || position < 1) {
      await reply("Posicao invalida no registro de fila.");
      return;
    }

    try {
      const wlRes = await api.room.getWaitlist(bot.cfg.room);
      const wl = wlRes?.data?.data?.waitlist ?? wlRes?.data?.waitlist ?? [];
      const inList = Array.isArray(wl)
        ? wl.some((u) => String(u.id ?? u.userId) === String(user.userId))
        : false;

      if (!inList) {
        await reply(
          "Voce precisa entrar na fila antes de restaurar a posicao com !dc.",
        );
        return;
      }

      if (Array.isArray(wl)) {
        const maxPos = wl.length;
        if (position > maxPos) position = maxPos;
      }

      await api.room.moveInWaitlist(
        bot.cfg.room,
        Number(user.userId),
        position,
      );
      await reply(
        `Usuario ${user.displayName ?? user.username} movido para a posicao ${position}.`,
      );
    } catch (err) {
      await reply(
        `Erro ao restaurar posicao: ${err.message}. Se precisar, entre na fila e use !dc novamente.`,
      );
    }
  },
};
