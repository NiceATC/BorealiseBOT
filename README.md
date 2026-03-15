# Borealise Chatbot

Standalone chatbot for the Borealise platform with modular commands/events,
SQLite persistence, and full API/pipeline wrappers. Responds to chat commands,
auto-woots tracks, greets new users, and replies when @mentioned.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
cp .env.example .env
# Fill in BOT_EMAIL and BOT_PASSWORD in .env

# 3. Configure room + features
# Edit config.json (room, feature flags, messages, etc.)

# 4. Run
npm start

# Auto-restart on file changes (Node ≥ 18)
npm run dev
```

---

## Project structure

```
BorealiseBOT/
  index.js               ← entry point
  helpers/               ← shared helpers (fs, http, waitlist, etc.)
    banner.js            ← ASCII logo
    errors.js            ← retry error detection
    random.js            ← random helpers
    roulette.js          ← roulette state + close helper
    tenor.js             ← Tenor GIF helper
  locales/
    pt-BR.json            ← Portuguese strings
    en-US.json            ← English strings
  lib/
    api/                 ← complete API call wrappers (all resources)
    bot.js               ← BorealiseBot core (pipeline, REST, dispatch logic)
    config.js            ← .env loader / config schema
    permissions.js       ← role hierarchy & helpers
    settings.js          ← runtime settings helpers
    storage.js           ← SQLite persistence
    version.js           ← bot version
    pipeline/            ← complete pipeline wrappers (events + actions)
  commands/
    index.js             ← CommandRegistry (auto-load, cooldowns, role checks)
    core/
      help.js            — !help [command]
      ping.js            — !ping
      start.js           — !start
      stop.js            — !stop
      reload.js          — !reload
      reloadcmd.js       — !reloadcmd
    info/
      nowplaying.js      — !np / !nowplaying
      stats.js           — !stats
      queue.js           — !queue
    music/
      woot.js            — !woot
      blacklist.js       — !blacklist
      togglebl.js        — !togglebl
      motd.js            — !motd / !togglemotd
    mod/
      skip.js            — !skip
      lock.js            — !lock / !unlock
      remove.js          — !remove
      move.js            — !move
      swap.js            — !swap
      timeguard.js       — !timeguard / !maxlength
      kick.js            — !kick
      mute.js            — !mute / !unmute
      ban.js             — !ban / !unban
    queue/
      dc.js              — !dc
      savequeue.js       — !savequeue
    system/
      autowoot.js        — !autowoot
      settings.js        — !settings
      welcome.js         — !welcome
    fun/
      ba.js              — !ba
      eightball.js       — !8ball / !ask
      cookie.js          — !cookie
      ghostbuster.js     — !ghostbuster
      gif.js             — !gif / !giphy
      roulette.js        — !roulette / !join / !leave
      thor.js            — !thor
  events/
    index.js             ← EventRegistry (auto-load, cooldowns, enable/disable)
    core/
      greet.js           — welcome message on user join
    moderation/
      mediaCheck.js       — skip age-restricted/blocked tracks
      timeGuard.js       — skip long tracks
    queue/
      waitlistSnapshot.js — snapshot for !dc
```

---

## Commands (summary)

Use `!help` in chat to see the full list with aliases and usage.

- Core: `!help`, `!ping`, `!start`, `!stop`, `!reload`, `!reloadcmd`
- Info: `!np`/`!nowplaying`, `!stats`, `!queue`
- Music: `!woot`, `!blacklist` (add/remove/list/info), `!togglebl`, `!motd`, `!togglemotd`
- Moderation: `!skip`, `!lock`, `!unlock`, `!remove`, `!move`, `!swap`, `!timeguard`, `!maxlength`, `!kick`, `!mute`, `!unmute`, `!ban`, `!unban`
- Queue: `!dc`, `!savequeue`
- System: `!autowoot`, `!settings`, `!welcome`
- Fun: `!ba`, `!8ball`/`!ask`, `!cookie`, `!ghostbuster`, `!gif`/`!giphy`, `!roulette`/`!join`/`!leave`, `!thor`

> **Role order (lowest → highest):** user · resident_dj · bouncer · manager · cohost · host  
> Both the bot **and** the sender must hold the required role for moderation commands to work.

---

## Adding a command

Create `commands/<category>/mycommand.js` — the `CommandRegistry` auto-loads it on startup (recursively):

```js
export default {
  name: "greet",
  aliases: ["oi", "hello"],
  descriptionKey: "commands.greet.description",
  usageKey: "commands.greet.usage",
  cooldown: 5_000, // ms between uses per user (default: 3 000)
  // minRole: "bouncer", // optional: minimum role required

  async execute(ctx) {
    // ctx.bot        — BorealiseBot instance
    // ctx.api        — @borealise/api REST client
    // ctx.apiCalls   — lib/api wrapper helpers
    // ctx.args       — string[] (words after command name)
    // ctx.rawArgs    — string after command name, unsplit
    // ctx.message    — full chat message
    // ctx.sender     — { userId, username, displayName }
    // ctx.senderRole / ctx.senderRoleLevel
    // ctx.botRole    / ctx.botRoleLevel
    // ctx.room       — room slug
    // ctx.reply(txt) — send a chat message

    await ctx.reply(
      ctx.t("commands.greet.reply", {
        name: ctx.sender.username ?? "amigo",
      }),
    );
  },
};
```

`description` / `usage` are still supported as fallbacks, but `descriptionKey` / `usageKey`
are recommended for i18n.

---

## Adding an event handler

Create `events/<category>/myevent.js` — the `EventRegistry` auto-loads it on startup (recursively):

```js
import { Events } from "@borealise/pipeline";

export default {
  name: "my-event",
  descriptionKey: "events.myEvent.description",
  enabled: true, // default enabled state

  event: Events.ROOM_USER_JOIN,
  // events: [Events.ROOM_USER_JOIN, Events.ROOM_USER_LEAVE],  // or multiple

  // Optional cooldown (ms). Can be a function for config-driven values:
  cooldown: 60_000,
  // cooldown: (ctx) => ctx.bot.cfg.someConfigField,
  cooldownScope: "user", // "user" (per-user) or "global" (room-wide)

  async handle(ctx, data) {
    // ctx.bot        — BorealiseBot instance
    // ctx.api        — @borealise/api REST client
    // ctx.room       — room slug
    // ctx.reply(txt) — send a chat message
    // data           — raw pipeline event payload

    await ctx.reply(
      ctx.t("events.myEvent.welcome", {
        name: data.displayName ?? "stranger",
      }),
    );
  },
};
```

Toggle at runtime without restarting:

```js
bot.events.enable("my-event");
bot.events.disable("my-event");
```

---

## Configuration

### Secrets (`.env`)

| Variable       | Required | Description          |
| -------------- | -------- | -------------------- |
| `BOT_EMAIL`    | yes      | Bot account e-mail   |
| `BOT_PASSWORD` | yes      | Bot account password |

### Settings (`config.json`)

| Key                    | Default                              | Description                                    |
| ---------------------- | ------------------------------------ | ---------------------------------------------- |
| `room`                 | _(required)_                         | Room slug to join                              |
| `locale`               | `pt-BR`                              | Default locale (`pt-BR` or `en-US`)            |
| `apiUrl`               | `https://prod.borealise.com/api`     | REST API base URL                              |
| `wsUrl`                | `wss://prod.borealise.com/ws`        | WebSocket pipeline URL                         |
| `cmdPrefix`            | `!`                                  | Command prefix character                       |
| `autoWoot`             | `true`                               | Auto-woot every new track                      |
| `botMessage`           | `"Oi! Sou um bot…"`                  | Reply when @mentioned; leave empty to disable  |
| `botMentionCooldownMs` | `30000`                              | Min ms between mention replies                 |
| `greetEnabled`         | `true`                               | Send welcome message on user join              |
| `greetMessage`         | `"🎵 Bem-vindo(a) à sala, @{name}!"` | Welcome template (`{name}` / `{username}`)     |
| `greetCooldownMs`      | `3600000`                            | Per-user cooldown for greets (default: 1 hour) |
| `motdEnabled`          | `false`                              | Enable MOTD                                    |
| `motdInterval`         | `5`                                  | Songs between MOTD messages                    |
| `motd`                 | `"Mensagem do dia"`                  | MOTD content                                   |
| `intervalMessages`     | `[]`                                 | Interval messages list                         |
| `messageInterval`      | `5`                                  | Songs between interval messages                |
| `dcWindowMin`          | `10`                                 | Minutes allowed to restore DC position          |
| `blacklistEnabled`     | `true`                               | Enable track blacklist                         |
| `timeGuardEnabled`     | `false`                              | Enable time guard                              |
| `maxSongLengthMin`     | `10`                                 | Max song length in minutes                     |
| `mediaCheckDebug`      | `false`                              | Log details from mediaCheck                    |

Settings changed via `!settings` are persisted and override `config.json` on startup.

---

## Localization (i18n)

- Set the default locale in `config.json` using `locale` (`pt-BR` or `en-US`).
- You can switch at runtime with `!settings locale en-US` or `!settings locale pt-BR`.
- Add/adjust keys in `locales/pt-BR.json` and `locales/en-US.json`.

For localized config messages (like `botMessage`, `greetMessage`, `motd`, `intervalMessages`),
you can provide an object with locale keys:

```json
{
  "botMessage": {
    "pt-BR": "Oi! Sou um bot.",
    "en-US": "Hi! I'm a bot."
  }
}
```

---

## Persistence

The bot stores data in a local SQLite file named `borealisebot.sqlite`:

- Runtime settings saved by `!settings`
- Track blacklist entries
- Waitlist snapshots for `!dc` restore

---

## Tech stack

- [`@borealise/pipeline`](https://www.npmjs.com/package/@borealise/pipeline) — official realtime WebSocket client
- [`@borealise/api`](https://www.npmjs.com/package/@borealise/api) — official REST client
- [`ws`](https://www.npmjs.com/package/ws) — WebSocket implementation for Node.js
- [`dotenv`](https://www.npmjs.com/package/dotenv) — `.env` loader
