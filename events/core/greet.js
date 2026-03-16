/**
 * events/greet.js
 *
 * Sends a configurable welcome message when a user joins the room.
 *
 * Configuration (via .env):
 *   GREET_ENABLED=true          — toggle on/off at startup
 *   GREET_MESSAGE=🎵 ...        — message template (supports {name} and {username})
 *   GREET_COOLDOWN_MS=3600000   — per-user cooldown in ms (default: 1 hour)
 *
 * The handler can also be toggled at runtime:
 *   bot.events.enable("greet")
 *   bot.events.disable("greet")
 *
 * Cooldown is managed by EventRegistry using cooldownScope: "user", so each
 * user has their own cooldown window — the bot won't greet the same person
 * again until the cooldown expires.
 */

import { Events } from "@borealise/pipeline";
import { getGreetState, upsertGreetState } from "../../lib/storage.js";

export default {
  name: "greet",
  descriptionKey: "events.greet.description",
  enabled: true,

  event: Events.ROOM_USER_JOIN,

  /**
   * Cooldown value read dynamically from bot config so GREET_COOLDOWN_MS is
   * respected without restarting the process.
   * EventRegistry calls this with (ctx, data) before each dispatch.
   */
  cooldown: (ctx) => ctx.bot.cfg.greetCooldownMs,
  cooldownScope: "user",

  async handle(ctx, data) {
    const { bot, reply } = ctx;

    // Skip the bot itself
    const userId = String(data?.userId ?? data?.user_id ?? data?.id ?? "");
    if (!userId || userId === String(bot._userId)) return;

    const display =
      data?.displayName ?? data?.display_name ?? data?.username ?? null;
    const username = data?.username ?? display ?? null;

    if (!display) return;

    let greetedAt = 0;
    let greetedCount = 0;
    try {
      const state = await getGreetState(userId);
      greetedAt = Number(state?.greeted_at ?? state?.greetedAt ?? 0);
      greetedCount = Number(state?.greeted_count ?? state?.greetedCount ?? 0);
    } catch {
      greetedAt = 0;
      greetedCount = 0;
    }

    const cooldownMs = Number(bot.cfg.greetCooldownMs) || 0;
    if (greetedAt && cooldownMs > 0 && Date.now() - greetedAt < cooldownMs) {
      return;
    }

    const isReturning = greetedCount > 0;
    let base = isReturning ? bot.cfg.greetBackMessage : bot.cfg.greetMessage;
    let template = String(bot.localizeValue(base) ?? "")
      .replace(/{name}/g, display)
      .replace(/{username}/g, username ?? display)
      .trim();

    if (!template && isReturning) {
      base = bot.cfg.greetMessage;
      template = String(bot.localizeValue(base) ?? "")
        .replace(/{name}/g, display)
        .replace(/{username}/g, username ?? display)
        .trim();
    }

    if (!template) return;

    await reply(template);
    await upsertGreetState({
      userId,
      greetedAt: Date.now(),
      greetedCount: greetedCount + 1,
    });
  },
};
