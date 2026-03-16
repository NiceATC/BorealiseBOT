/**
 * lib/config.js
 *
 * Configuration is split into two files at the chatbot root:
 *
 *   .env          — secrets only: BOT_EMAIL, BOT_PASSWORD
 *   config.json   — everything else: room slug, feature flags, messages, etc.
 *
 * On first run, if config.json is missing it is automatically copied from
 * config.example.json so the bot can start with sensible defaults.
 *
 * Call loadConfig() once at startup (called by BorealiseBot constructor).
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { normalizeLocale, t as translate } from "./i18n.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ── .env — secrets ────────────────────────────────────────────────────────────

const envPath = path.join(ROOT, ".env");

if (!fs.existsSync(envPath)) {
  console.error(
    translate("config.envMissing", {
      path: envPath,
    }),
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
dotenv.config({ path: envPath });

// ── config.json — non-critical settings ──────────────────────────────────────

const configPath = path.join(ROOT, "config.json");
const examplePath = path.join(ROOT, "config.example.json");

if (!fs.existsSync(configPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, configPath);
    console.warn(translate("config.configCopied"));
  } else {
    console.error(
      translate("config.configMissing", {
        path: configPath,
      }),
    );
    process.exit(1);
  }
}

let _json;
try {
  _json = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error(
    translate("config.parseFailed", {
      error: err.message,
    }),
  );
  process.exit(1);
}

const configLocale = normalizeLocale(_json?.locale);

export function loadConfig() {
  // ── env helpers ─────────────────────────────────────────────────────────
  const requiredEnv = (key) => {
    const v = process.env[key];
    if (!v) {
      console.error(
        translate(
          "config.missingEnvVar",
          {
            key,
          },
          configLocale,
        ),
      );
      process.exit(1);
    }
    return v;
  };

  // ── json helpers ────────────────────────────────────────────────────────
  const j = (key, fallback) => _json[key] ?? fallback;
  const jBool = (key, fallback) => Boolean(j(key, fallback));
  const jInt = (key, fallback) => {
    const v = Number(j(key, fallback));
    return Number.isFinite(v) ? v : fallback;
  };
  const jStr = (key, fallback) => String(j(key, fallback) ?? "");
  const jArr = (key, fallback) => {
    const v = j(key, fallback);
    return Array.isArray(v) ? v : fallback;
  };

  // ── required json fields ─────────────────────────────────────────────────
  const room = jStr("room", "");
  if (!room || room === "room-slug") {
    console.error(translate("config.invalidRoom", null, configLocale));
    process.exit(1);
  }

  return {
    // ── Secrets (from .env) ─────────────────────────────────────────────────
    email: requiredEnv("BOT_EMAIL"),
    password: requiredEnv("BOT_PASSWORD"),

    // ── Network (from config.json) ──────────────────────────────────────────
    room,
    locale: jStr("locale", "pt-BR"),
    apiUrl: jStr("apiUrl", "https://prod.borealise.com/api"),
    wsUrl: jStr("wsUrl", "wss://prod.borealise.com/ws"),

    // ── Command system ───────────────────────────────────────────────────────
    cmdPrefix: jStr("cmdPrefix", "!"),

    // ── Auto-woot ────────────────────────────────────────────────────────────
    autoWoot: jBool("autoWoot", true),

    // ── Bot-mention reply ─────────────────────────────────────────────────────
    botMessage: j(
      "botMessage",
      "Oi! Sou um bot e não consigo conversar. 🤖 Use !help para ver o que posso fazer!",
    ),
    botMentionCooldownMs: jInt("botMentionCooldownMs", 30_000),

    // ── Greet event ───────────────────────────────────────────────────────────
    greetEnabled: jBool("greetEnabled", true),
    greetMessage: j("greetMessage", "🎵 Bem-vindo(a) à sala, @{name}!"),
    greetBackMessage: j(
      "greetBackMessage",
      "🎵 Bem-vindo(a) de volta, @{name}!",
    ),
    greetCooldownMs: jInt("greetCooldownMs", 3_600_000),

    // ── MOTD / interval messages ─────────────────────────────────────────
    motdEnabled: jBool("motdEnabled", false),
    motdInterval: jInt("motdInterval", 5),
    motd: j("motd", "Mensagem do dia"),
    intervalMessages: jArr("intervalMessages", []),
    messageInterval: jInt("messageInterval", 5),

    // ── DC restore ─────────────────────────────────────────────────────
    dcWindowMin: jInt("dcWindowMin", 10),

    // ── Track blacklist ─────────────────────────────────────────────────
    blacklistEnabled: jBool("blacklistEnabled", true),

    // ── Time guard ─────────────────────────────────────────────────────
    timeGuardEnabled: jBool("timeGuardEnabled", false),
    maxSongLengthMin: jInt("maxSongLengthMin", 10),

    // ── Auto-skip (stalled track) ──────────────────────────────────────
    autoSkipEnabled: jBool("autoSkipEnabled", false),

    // ── AFK removal ────────────────────────────────────────────────────
    afkRemovalEnabled: jBool("afkRemovalEnabled", false),
    afkLimitMin: jInt("afkLimitMin", 60),

    // ── Duel mute ───────────────────────────────────────────────────────
    duelMuteMin: jInt("duelMuteMin", 5),

    // ── Media check debug ─────────────────────────────────────────────
    mediaCheckDebug: jBool("mediaCheckDebug", false),
  };
}
