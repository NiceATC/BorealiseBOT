/**
 * commands/mod/nuke.js
 *
 * Deletes all chat messages in the room.
 * First fetches the full history via the API (paginated), then also
 * deletes any cached messages the bot tracked locally.
 */

const BATCH_SIZE = 50;

const nuke = {
  name: "nuke",
  aliases: ["clearchat"],
  descriptionKey: "commands.nuke.description",
  usageKey: "commands.nuke.usage",
  cooldown: 10_000,
  minRole: "manager",

  async execute(ctx) {
    const { bot, api, reply, t } = ctx;

    let count = 0;

    // ── Fetch & delete via API history ───────────────────────────────────────
    if (api?.chat?.getMessages && api?.chat?.deleteMessage) {
      let before = undefined;
      let hasMore = true;

      while (hasMore) {
        let res;
        try {
          res = await api.chat.getMessages(bot.cfg.room, before, BATCH_SIZE);
        } catch {
          break;
        }

        const inner = res?.data?.data ?? res?.data ?? {};
        const messages = Array.isArray(inner)
          ? inner
          : (inner.messages ?? inner.data ?? []);

        if (!messages.length) break;

        for (const msg of messages) {
          const id = msg?.id ?? msg?.messageId ?? msg?.message_id;
          if (!id) continue;
          try {
            await api.chat.deleteMessage(bot.cfg.room, id);
            count++;
          } catch {
            // best-effort — keep going
          }
        }

        if (messages.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          const last = messages[messages.length - 1];
          before = last?.id ?? last?.messageId ?? last?.message_id;
          if (!before) hasMore = false;
        }
      }
    }

    // ── Also purge locally cached message IDs ────────────────────────────────
    const cached = bot.deleteAllCachedMessages();
    // Avoid double-counting IDs already deleted above
    if (!api?.chat?.getMessages) count += cached;

    await reply(t("commands.nuke.done", { count }));
  },
};

export default nuke;
