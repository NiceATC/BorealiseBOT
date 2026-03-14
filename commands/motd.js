/**
 * commands/motd.js
 *
 * !motd [mensagem|on|off|interval <n>]
 * !togglemotd
 */

import { setSetting } from "../lib/storage.js";

const motd = {
  name: "motd",
  aliases: ["mensagem"],
  description: "Configura a mensagem do dia (MOTD) e o intervalo.",
  usage: "!motd [mensagem|on|off|interval <n>]",
  cooldown: 5000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, args, reply } = ctx;

    if (args.length === 0) {
      const enabled = Boolean(bot.cfg.motdEnabled);
      const interval = bot.cfg.motdInterval ?? 0;
      const msg = bot.cfg.motd ?? "";
      await reply(
        `MOTD ${enabled ? "ativado" : "desativado"} | intervalo: ${interval} | mensagem: ${msg}`,
      );
      return;
    }

    const sub = args[0].toLowerCase();
    if (sub === "on" || sub === "off") {
      const enabled = sub === "on";
      bot.updateConfig("motdEnabled", enabled);
      await setSetting("motdEnabled", enabled);
      await reply(`MOTD ${enabled ? "ativado" : "desativado"}.`);
      return;
    }

    if (sub === "interval") {
      const n = Number(args[1]);
      if (!Number.isFinite(n) || n <= 0) {
        await reply("Uso: !motd interval <numero>");
        return;
      }
      bot.updateConfig("motdInterval", Math.floor(n));
      await setSetting("motdInterval", Math.floor(n));
      await reply(`Intervalo do MOTD atualizado para ${Math.floor(n)}.`);
      return;
    }

    const message = args.join(" ").trim();
    if (!message) {
      await reply("Uso: !motd <mensagem>");
      return;
    }

    bot.updateConfig("motd", message);
    bot.updateConfig("motdEnabled", true);
    await setSetting("motd", message);
    await setSetting("motdEnabled", true);
    await reply("MOTD atualizado e ativado.");
  },
};

const togglemotd = {
  name: "togglemotd",
  aliases: ["motdtoggle"],
  description: "Ativa ou desativa a mensagem do dia (MOTD).",
  usage: "!togglemotd",
  cooldown: 5000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, reply } = ctx;
    const enabled = !bot.cfg.motdEnabled;
    bot.updateConfig("motdEnabled", enabled);
    await setSetting("motdEnabled", enabled);
    await reply(`MOTD ${enabled ? "ativado" : "desativado"}.`);
  },
};

export default [motd, togglemotd];
