/**
 * commands/core/start.js
 */

export default {
  name: "start",
  aliases: ["resume", "unpause", "continuar", "iniciar"],
  description: "Retoma o bot pausado.",
  usage: "!start",
  cooldown: 5000,
  minRole: "manager",

  async execute(ctx) {
    const { bot, reply } = ctx;
    const changed = bot.resume();
    if (changed) {
      await reply("Bot retomado.");
      return;
    }
    await reply("Bot ja esta ativo.");
  },
};
