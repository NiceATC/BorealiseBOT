/**
 * commands/welcome.js
 *
 * !welcome - alterna a saudacao de entrada
 */

import { setSetting } from "../../lib/storage.js";

export default {
  name: "welcome",
  aliases: ["greet", "boasvindas"],
  descriptionKey: "commands.welcome.description",
  usageKey: "commands.welcome.usage",
  cooldown: 5000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, reply, t } = ctx;
    const enabled = !bot.cfg.greetEnabled;
    bot.updateConfig("greetEnabled", enabled);
    await setSetting("greetEnabled", enabled);
    await reply(
      t(enabled ? "commands.welcome.enabled" : "commands.welcome.disabled"),
    );
  },
};
