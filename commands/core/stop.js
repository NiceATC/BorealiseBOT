/**
 * commands/core/stop.js
 */

export default {
  name: "stop",
  aliases: ["pause", "parar", "pausar"],
  description: "Pausa o bot sem desconectar.",
  usage: "!stop",
  cooldown: 5000,
  minRole: "manager",

  async execute(ctx) {
    const { bot, reply } = ctx;
    const changed = bot.pause();
    if (changed) {
      await reply("Bot pausado. Use !start para voltar.");
      return;
    }
    await reply("Bot ja esta pausado.");
  },
};
