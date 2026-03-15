/**
 * commands/autowoot.js
 *
 * !autowoot - alterna o auto-woot do bot
 */

import { setSetting } from "../../lib/storage.js";

export default {
  name: "autowoot",
  aliases: ["aw"],
  descriptionKey: "commands.autowoot.description",
  usageKey: "commands.autowoot.usage",
  cooldown: 5000,
  minRole: "manager",

  async execute(ctx) {
    const { bot, reply, t } = ctx;
    const next = !bot.cfg.autoWoot;
    bot.updateConfig("autoWoot", next);
    await setSetting("autoWoot", next);
    await reply(
      t(next ? "commands.autowoot.enabled" : "commands.autowoot.disabled"),
    );
  },
};
