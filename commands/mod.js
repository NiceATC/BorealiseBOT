/**
 * commands/mod.js — Moderation commands
 *
 * Commands: !skip, !lock, !unlock, !remove, !move, !kick, !mute, !unmute, !ban, !unban
 *
 * All commands require BOTH:
 *   1. The bot to hold the required role in the room (otherwise the REST call
 *      would fail anyway — the registry silently skips it to avoid spam).
 *   2. The user who typed the command to hold the required role.
 *
 * Role guards are enforced by CommandRegistry before execute() is ever called
 * (see commands/index.js), so individual handlers can trust that both checks
 * have already passed.
 *
 * Duration format for !mute / !ban:
 *   5      → 5 minutes
 *   h2     → 2 hours  (= 120 minutes)
 *   d7     → 7 days   (= 10 080 minutes)
 *
 * REST API method signatures (from @borealise/api):
 *   api.room.skipTrack(slug)
 *   api.room.kick(slug, userId)
 *   api.room.mute(slug, userId, { duration?, reason? })  — duration in minutes
 *   api.room.unmute(slug, userId)
 *   api.room.ban(slug, userId, { duration?, reason? })   — duration in minutes
 *   api.room.unban(slug, userId)
 *   api.room.getBans(slug)
 *   api.room.lockWaitlist(slug)
 *   api.room.unlockWaitlist(slug)
 *   api.room.removeFromWaitlist(slug, userId)
 *   api.room.moveInWaitlist(slug, userId, position)
 */

import { setSetting } from "../lib/storage.js";

// ── Duration helpers ──────────────────────────────────────────────────────────

/**
 * Parse a single duration token into minutes + a human-readable label.
 * Returns null if the token is not a recognised duration.
 *
 * Examples: "5" → {minutes:5, label:"5min"} | "h2" → {120,"2h"} | "d1" → {1440,"1d"}
 *
 * @param {string} tok
 * @returns {{minutes:number, label:string}|null}
 */
function parseDuration(tok) {
  const m = tok.match(/^(h|d)?(\d+)$/i);
  if (!m) return null;
  const unit = (m[1] || "").toLowerCase();
  const val = parseInt(m[2], 10);
  if (unit === "h") return { minutes: val * 60, label: `${val}h` };
  if (unit === "d") return { minutes: val * 1440, label: `${val}d` };
  return { minutes: val, label: `${val}min` };
}

/**
 * Walk a token array and extract an optional duration + trailing reason.
 * The first token that looks like a duration wins; everything else is the reason.
 *
 * @param {string[]} tokens
 * @returns {{duration:number|null, label:string|null, reason:string|null}}
 */
function extractDurationAndReason(tokens) {
  let duration = null;
  let label = null;
  const reasonParts = [];

  for (const tok of tokens) {
    if (duration === null) {
      const d = parseDuration(tok);
      if (d) {
        duration = d.minutes;
        label = d.label;
        continue;
      }
    }
    reasonParts.push(tok);
  }

  return { duration, label, reason: reasonParts.join(" ") || null };
}

// ── Commands ──────────────────────────────────────────────────────────────────

const skip = {
  name: "skip",
  aliases: ["pular"],
  description: "Pula a música atual. Requer cargo bouncer ou superior.",
  usage: "!skip",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, reply } = ctx;
    try {
      await api.room.skipTrack(bot.cfg.room);
      await reply("⏭ Música pulada.");
    } catch (err) {
      await reply(`Erro ao pular: ${err.message}`);
    }
  },
};

const lock = {
  name: "lock",
  aliases: ["lockwl", "lockqueue", "travar"],
  description: "Trava a fila de DJs. Requer cargo bouncer ou superior.",
  usage: "!lock",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, reply } = ctx;
    try {
      await api.room.lockWaitlist(bot.cfg.room);
      await reply("Fila travada.");
    } catch (err) {
      await reply(`Erro ao travar a fila: ${err.message}`);
    }
  },
};

const unlock = {
  name: "unlock",
  aliases: ["unlockwl", "unlockqueue", "destravar"],
  description: "Destrava a fila de DJs. Requer cargo bouncer ou superior.",
  usage: "!unlock",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, reply } = ctx;
    try {
      await api.room.unlockWaitlist(bot.cfg.room);
      await reply("Fila destravada.");
    } catch (err) {
      await reply(`Erro ao destravar a fila: ${err.message}`);
    }
  },
};

const remove = {
  name: "remove",
  aliases: ["remover", "rm"],
  description:
    "Remove um usuario da fila de DJs. Requer cargo bouncer ou superior.",
  usage: "!remove <usuario>",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    if (!target) {
      await reply("Uso: !remove <usuario>");
      return;
    }

    const user = bot.findRoomUser(target);
    if (!user) {
      await reply(`Usuario "${target}" nao encontrado na sala.`);
      return;
    }

    try {
      const wlRes = await api.room.getWaitlist(bot.cfg.room);
      const wl = wlRes?.data?.data?.waitlist ?? wlRes?.data?.waitlist ?? [];
      const inList = Array.isArray(wl)
        ? wl.some((u) => String(u.id ?? u.userId) === String(user.userId))
        : false;

      if (!inList) {
        await reply(`Usuario "${target}" nao esta na fila.`);
        return;
      }

      await api.room.removeFromWaitlist(bot.cfg.room, Number(user.userId));
      await reply(`${user.displayName ?? user.username} foi removido da fila.`);
    } catch (err) {
      await reply(`Erro ao remover da fila: ${err.message}`);
    }
  },
};

const move = {
  name: "move",
  aliases: ["mover", "mv"],
  description:
    "Move um usuario para uma posicao especifica na fila de DJs. Requer cargo bouncer ou superior.",
  usage: "!move <usuario> <posicao>",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    const pos = parseInt(args[1], 10);
    if (!target || isNaN(pos) || pos < 1) {
      await reply("Uso: !move <usuario> <posicao> (1 = primeiro)");
      return;
    }

    const user = bot.findRoomUser(target);
    if (!user) {
      await reply(`Usuario "${target}" nao encontrado na sala.`);
      return;
    }

    try {
      const apiPos = pos - 1;
      await api.room.moveInWaitlist(bot.cfg.room, Number(user.userId), apiPos);
      await reply(
        `${user.displayName ?? user.username} foi movido para a posicao ${pos} na fila.`,
      );
    } catch (err) {
      await reply(`Erro ao mover: ${err.message}`);
    }
  },
};

const swap = {
  name: "swap",
  aliases: ["trocar"],
  description:
    "Troca a posicao de dois usuarios na fila. Requer cargo bouncer ou superior.",
  usage: "!swap <usuario1> <usuario2>",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const targetA = (args[0] ?? "").replace(/^@/, "").trim();
    const targetB = (args[1] ?? "").replace(/^@/, "").trim();

    if (!targetA || !targetB) {
      await reply("Uso: !swap <usuario1> <usuario2>");
      return;
    }

    const userA = bot.findRoomUser(targetA);
    const userB = bot.findRoomUser(targetB);
    if (!userA || !userB) {
      await reply("Usuario nao encontrado na sala.");
      return;
    }

    try {
      const wlRes = await api.room.getWaitlist(bot.cfg.room);
      const wl = wlRes?.data?.data?.waitlist ?? wlRes?.data?.waitlist ?? [];
      const idxA = Array.isArray(wl)
        ? wl.findIndex((u) => String(u.id ?? u.userId) === String(userA.userId))
        : -1;
      const idxB = Array.isArray(wl)
        ? wl.findIndex((u) => String(u.id ?? u.userId) === String(userB.userId))
        : -1;

      if (idxA < 0 || idxB < 0) {
        await reply("Ambos os usuarios precisam estar na fila.");
        return;
      }

      if (idxA === idxB) {
        await reply("Os usuarios ja estao na mesma posicao.");
        return;
      }

      if (idxA < idxB) {
        await api.room.moveInWaitlist(bot.cfg.room, Number(userB.userId), idxA);
        await api.room.moveInWaitlist(bot.cfg.room, Number(userA.userId), idxB);
      } else {
        await api.room.moveInWaitlist(bot.cfg.room, Number(userA.userId), idxB);
        await api.room.moveInWaitlist(bot.cfg.room, Number(userB.userId), idxA);
      }

      await reply(
        `Swap realizado: ${userA.displayName ?? userA.username} <-> ${userB.displayName ?? userB.username}.`,
      );
    } catch (err) {
      await reply(`Erro ao trocar posicoes: ${err.message}`);
    }
  },
};

const timeguard = {
  name: "timeguard",
  aliases: ["tg"],
  description: "Ativa ou desativa o limite de tempo de musica.",
  usage: "!timeguard",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, reply } = ctx;
    const enabled = !bot.cfg.timeGuardEnabled;
    bot.updateConfig("timeGuardEnabled", enabled);
    await setSetting("timeGuardEnabled", enabled);
    await reply(`Timeguard ${enabled ? "ativado" : "desativado"}.`);
  },
};

const maxlength = {
  name: "maxlength",
  aliases: ["maxlen", "maxsong"],
  description: "Define a duracao maxima de musica (em minutos).",
  usage: "!maxlength <min>",
  cooldown: 5_000,
  minRole: "manager",

  async execute(ctx) {
    const { bot, args, reply } = ctx;
    const minutes = Number(args[0]);
    if (!Number.isFinite(minutes) || minutes < 1) {
      await reply("Uso: !maxlength <min>");
      return;
    }
    const value = Math.floor(minutes);
    bot.updateConfig("maxSongLengthMin", value);
    await setSetting("maxSongLengthMin", value);
    await reply(`Duracao maxima atualizada para ${value} min.`);
  },
};

const kick = {
  name: "kick",
  aliases: ["expulsar"],
  description: "Remove um usuário da sala. Requer cargo bouncer ou superior.",
  usage: "!kick <usuario>",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    if (!target) {
      await reply("Uso: !kick <usuario>");
      return;
    }

    const user = bot.findRoomUser(target);
    if (!user) {
      await reply(`Usuário "${target}" não encontrado na sala.`);
      return;
    }

    if (bot.getUserRoleLevel(user.userId) >= bot.getBotRoleLevel()) {
      await reply(
        `Não posso expulsar ${user.displayName ?? user.username} — o cargo dele é igual ou superior ao meu.`,
      );
      return;
    }

    try {
      await api.room.kick(bot.cfg.room, user.userId);
      await reply(`👢 ${user.displayName ?? user.username} foi expulso.`);
    } catch (err) {
      await reply(`Erro ao expulsar: ${err.message}`);
    }
  },
};

const mute = {
  name: "mute",
  aliases: ["silenciar", "calar"],
  description: "Silencia um usuário no chat. Requer cargo bouncer ou superior.",
  usage: "!mute <usuario> [duração] [motivo]  · ex: !mute user h2 spam",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    if (!target) {
      await reply("Uso: !mute <usuario> [duração] [motivo]");
      return;
    }

    const user = bot.findRoomUser(target);
    if (!user) {
      await reply(`Usuário "${target}" não encontrado na sala.`);
      return;
    }

    if (bot.getUserRoleLevel(user.userId) >= bot.getBotRoleLevel()) {
      await reply(
        `Não posso silenciar ${user.displayName ?? user.username} — o cargo dele é igual ou superior ao meu.`,
      );
      return;
    }

    const { duration, label, reason } = extractDurationAndReason(args.slice(1));

    const data = {};
    if (duration != null) data.duration = duration;
    if (reason) data.reason = reason;

    try {
      await api.room.mute(bot.cfg.room, user.userId, data);
      const parts = [`🔇 ${user.displayName ?? user.username} foi silenciado`];
      if (label) parts.push(`por ${label}`);
      if (reason) parts.push(`— ${reason}`);
      await reply(parts.join(" ") + ".");
    } catch (err) {
      await reply(`Erro ao silenciar: ${err.message}`);
    }
  },
};

const unmute = {
  name: "unmute",
  aliases: ["dessilenciar"],
  description:
    "Remove o silêncio de um usuário. Requer cargo bouncer ou superior.",
  usage: "!unmute <usuario>",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    if (!target) {
      await reply("Uso: !unmute <usuario>");
      return;
    }

    const user = bot.findRoomUser(target);
    if (!user) {
      await reply(`Usuário "${target}" não encontrado na sala.`);
      return;
    }

    try {
      await api.room.unmute(bot.cfg.room, user.userId);
      await reply(`🔊 ${user.displayName ?? user.username} foi dessilenciado.`);
    } catch (err) {
      await reply(`Erro ao dessilenciar: ${err.message}`);
    }
  },
};

const ban = {
  name: "ban",
  aliases: ["banir"],
  description: "Bane um usuário da sala. Requer cargo manager ou superior.",
  usage: "!ban <usuario> [duração] [motivo]  · ex: !ban user d7 flood",
  cooldown: 5_000,
  minRole: "manager",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    if (!target) {
      await reply("Uso: !ban <usuario> [duração] [motivo]");
      return;
    }

    const user = bot.findRoomUser(target);
    if (!user) {
      await reply(`Usuário "${target}" não encontrado na sala.`);
      return;
    }

    if (bot.getUserRoleLevel(user.userId) >= bot.getBotRoleLevel()) {
      await reply(
        `Não posso banir ${user.displayName ?? user.username} — o cargo dele é igual ou superior ao meu.`,
      );
      return;
    }

    const { duration, label, reason } = extractDurationAndReason(args.slice(1));

    const data = {};
    if (duration != null) data.duration = duration;
    if (reason) data.reason = reason;

    try {
      await api.room.ban(bot.cfg.room, user.userId, data);
      const parts = [`🔨 ${user.displayName ?? user.username} foi banido`];
      if (label) parts.push(`por ${label}`);
      if (reason) parts.push(`— ${reason}`);
      await reply(parts.join(" ") + ".");
    } catch (err) {
      await reply(`Erro ao banir: ${err.message}`);
    }
  },
};

const unban = {
  name: "unban",
  aliases: ["desbanir"],
  description: "Remove o ban de um usuário. Requer cargo manager ou superior.",
  usage: "!unban <usuario>",
  cooldown: 5_000,
  minRole: "manager",

  async execute(ctx) {
    const { api, bot, args, reply } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    if (!target) {
      await reply("Uso: !unban <usuario>");
      return;
    }

    // The banned user won't be in the room; try local cache first, then fetch bans.
    let userId = bot.findRoomUser(target)?.userId ?? null;

    if (!userId) {
      try {
        const bansRes = await api.room.getBans(bot.cfg.room);
        const bans = bansRes?.data?.data ?? bansRes?.data ?? [];
        const lower = target.toLowerCase();
        const found = (Array.isArray(bans) ? bans : []).find(
          (b) =>
            (b.username ?? "").toLowerCase() === lower ||
            (b.displayName ?? b.display_name ?? "").toLowerCase() === lower,
        );
        if (found) {
          userId = String(found.userId ?? found.user_id ?? found.id ?? "");
        }
      } catch {
        // getBans failed — try anyway below; server will return an error if invalid
      }
    }

    if (!userId) {
      await reply(`Usuário "${target}" não encontrado na lista de banidos.`);
      return;
    }

    try {
      await api.room.unban(bot.cfg.room, userId);
      await reply(`✅ Ban de "${target}" removido.`);
    } catch (err) {
      await reply(`Erro ao desbanir: ${err.message}`);
    }
  },
};

// Array export — CommandRegistry.loadDir() handles both single and array exports.
export default [
  skip,
  lock,
  unlock,
  remove,
  move,
  swap,
  timeguard,
  maxlength,
  kick,
  mute,
  unmute,
  ban,
  unban,
];
