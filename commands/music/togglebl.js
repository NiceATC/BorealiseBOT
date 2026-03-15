/**
 * commands/togglebl.js
 *
 * !togglebl - ativa/desativa a blacklist de musicas
 */

import { setSetting } from "../../lib/storage.js";

export default {
  name: "togglebl",
  aliases: ["bltoggle", "blacklisttoggle"],
  descriptionKey: "commands.togglebl.description",
  usageKey: "commands.togglebl.usage",
  cooldown: 5000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, reply, t } = ctx;
    const enabled = !bot.cfg.blacklistEnabled;
    bot.updateConfig("blacklistEnabled", enabled);
    await setSetting("blacklistEnabled", enabled);
    await reply(
      t(enabled ? "commands.togglebl.enabled" : "commands.togglebl.disabled"),
    );
  },
};
