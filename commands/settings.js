/**
 * commands/settings.js
 *
 * !settings <key> [valor] - consulta ou altera configuracoes persistentes do bot
 */
import { getSetting, setSetting } from "../lib/storage.js";
import { RUNTIME_SETTING_KEYS, parseSettingValue } from "../lib/settings.js";

const ALLOWED_KEYS = new Set(RUNTIME_SETTING_KEYS);

export default {
  name: "settings",
  aliases: ["config", "set"],
  description: "Consulta ou altera configuracoes persistentes do bot.",
  usage: "!settings <chave> [valor]",
  cooldown: 3000,
  minRole: "manager",

  async execute(ctx) {
    const { args, reply, bot } = ctx;
    const key = args[0];
    if (!key) {
      await reply("Uso: !settings <chave> [valor]");
      return;
    }

    if (key === "list") {
      await reply(`Chaves disponiveis: ${RUNTIME_SETTING_KEYS.join(", ")}`);
      return;
    }

    if (!ALLOWED_KEYS.has(key)) {
      await reply(
        `Chave invalida. Use !settings list para ver as chaves disponiveis.`,
      );
      return;
    }
    if (args.length === 1) {
      // Consultar
      const val = await getSetting(key, bot.cfg[key]);
      await reply(
        val !== undefined
          ? `Configuracao ${key}: ${JSON.stringify(val)}`
          : `Chave ${key} nao encontrada.`,
      );
      return;
    }
    // Alterar
    const rawValue = args.slice(1).join(" ");
    const value = parseSettingValue(rawValue);
    await setSetting(key, value);
    bot.updateConfig(key, value);
    await reply(
      `Configuracao ${key} atualizada para: ${JSON.stringify(value)}`,
    );
  },
};
