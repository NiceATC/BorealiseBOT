/**
 * commands/mod/delmsg.js
 *
 * Deletes all cached chat messages from a specific user.
 * Only works on messages the bot has seen since it joined.
 *
 * Usage: !delmsg @user
 */

const delmsg = {
  name: "delmsg",
  aliases: ["deletemsg", "clearmsg"],
  descriptionKey: "commands.delmsg.description",
  usageKey: "commands.delmsg.usage",
  cooldown: 5_000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, args, reply, t } = ctx;
    const target = (args[0] ?? "").replace(/^@/, "").trim();
    if (!target) {
      await reply(t("commands.delmsg.usageMessage"));
      return;
    }

    const user = bot.findRoomUser(target);
    if (!user) {
      await reply(t("commands.delmsg.userNotFound", { user: target }));
      return;
    }

    if (bot.isBotUser(user.userId)) {
      await reply(t("commands.mod.cannotTargetBot"));
      return;
    }

    const count = bot.deleteMessagesFromUser(user.userId);
    await reply(
      t("commands.delmsg.done", {
        user: user.displayName ?? user.username,
        count,
      }),
    );
  },
};

export default delmsg;
