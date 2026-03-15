import {
  closeRoulette,
  ROULETTE_DURATION_MS,
  rouletteState,
} from "../../helpers/roulette.js";
import { getWaitlist } from "../../helpers/waitlist.js";

const roulette = {
  name: "roulette",
  description: "Abre uma roleta russa na fila.",
  usage: "!roulette",
  cooldown: 5000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, api, reply } = ctx;
    if (rouletteState.open) {
      await reply("Roleta russa ja esta aberta. Use !join para entrar.");
      return;
    }

    rouletteState.open = true;
    rouletteState.participants.clear();
    rouletteState.timeoutId = setTimeout(() => {
      closeRoulette(bot, api).catch(() => {});
    }, ROULETTE_DURATION_MS);

    await reply("Roleta russa aberta! Use !join para arriscar (60s).");
  },
};

const join = {
  name: "join",
  description: "Entra na roleta russa aberta.",
  usage: "!join",
  cooldown: 3000,

  async execute(ctx) {
    const { sender, reply, api, bot } = ctx;
    if (!rouletteState.open) {
      await reply("Roleta russa fechada.");
      return;
    }

    const key = sender.userId != null ? String(sender.userId) : "";
    const name = sender.displayName ?? sender.username ?? "alguem";
    if (!key) {
      await reply("Nao foi possivel identificar o usuario.");
      return;
    }

    try {
      const waitlist = await getWaitlist(api, bot.cfg.room);
      const inList = waitlist.some(
        (u) => String(u.id ?? u.userId ?? u.user_id ?? "") === key,
      );
      if (!inList) {
        await reply("Voce precisa estar na fila para participar.");
        return;
      }
    } catch (err) {
      await reply(`Nao consegui ler a fila: ${err.message}`);
      return;
    }

    if (rouletteState.participants.has(key)) {
      await reply("Voce ja esta na roleta russa.");
      return;
    }

    rouletteState.participants.set(key, name);
    await reply(`${name} entrou na roleta russa.`);
  },
};

const leave = {
  name: "leave",
  description: "Sai da roleta russa aberta.",
  usage: "!leave",
  cooldown: 3000,

  async execute(ctx) {
    const { sender, reply } = ctx;
    if (!rouletteState.open) {
      await reply("Roleta russa fechada.");
      return;
    }

    const key = sender.userId != null ? String(sender.userId) : "";
    const name = sender.displayName ?? sender.username ?? "alguem";
    if (!key) {
      await reply("Nao foi possivel identificar o usuario.");
      return;
    }
    if (!rouletteState.participants.has(key)) {
      await reply("Voce nao esta na roleta russa.");
      return;
    }

    rouletteState.participants.delete(key);
    await reply(`${name} saiu da roleta russa.`);
  },
};

export default [roulette, join, leave];
