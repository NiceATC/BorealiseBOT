/**
 * lib/bot.js
 *
 * Core BorealiseBot class.
 *
 * Responsibilities:
 *  - Login via @borealise/api REST client
 *  - Connect to the realtime pipeline via @borealise/pipeline
 *  - Auto-woot new tracks (optional)
 *  - Dispatch chat commands to CommandRegistry
 *  - Dispatch pipeline events to EventRegistry (greetings, custom hooks, etc.)
 *  - Reply when @mentioned with the configured bot message
 *
 * The bot does NOT join the DJ waitlist — it is a chatbot only.
 *
 * Adding a command: drop a .js file in commands/
 * Adding an event handler: drop a .js file in events/
 * No changes needed here in either case.
 */

import WebSocket from "ws";
import { createPipeline, Events } from "@borealise/pipeline";
import { CommandRegistry } from "../commands/index.js";
import { EventRegistry } from "../events/index.js";
import { loadConfig } from "./config.js";
import { getRoleLevel } from "./permissions.js";
import { getTrackBlacklist } from "./storage.js";

// ── Dynamic import helper for @borealise/api (CJS package) ───────────────────

async function loadApiPackage() {
  const mod = await import("@borealise/api");
  const pkg = mod.default ?? mod;
  return { createApiClient: pkg.createApiClient, ApiError: pkg.ApiError };
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Delay after booth:advance before casting the auto-woot vote */
const WOOT_DELAY_MS = 800;

// ── Bot ───────────────────────────────────────────────────────────────────────

export class BorealiseBot {
  /**
   * @param {ReturnType<import('./config.js').loadConfig>} [cfg]
   */
  constructor(cfg = loadConfig()) {
    this.cfg = cfg;

    /** @type {import('@borealise/api').ApiClient|null} */
    this._api = null;
    this._token = null;

    // ── Bot identity (filled after login) ────────────────────────────────────
    this._userId = null;
    this._username = null;
    this._displayName = null;

    // ── Session stats ────────────────────────────────────────────────────────
    this._startedAt = null;
    this._wootCount = 0;
    this._reactions = { woots: 0, mehs: 0, grabs: 0 };
    this._currentReactions = { woots: 0, mehs: 0, grabs: 0 };

    // ── Current track / DJ ───────────────────────────────────────────────────
    this._currentTrack = null;
    this._djName = null;
    this._currentTrackStartedAt = null;
    this._songCount = 0;

    // ── Waitlist (passive tracking — bot does NOT auto-join) ─────────────────
    this._waitlistPosition = null;
    this._waitlistTotal = null;
    this._nextDjName = null;

    // ── Room info & user cache ───────────────────────────────────────────────
    this._roomName = null;
    /** @type {Record<string,string>} uid → displayName (fast lookup for waitlist names) */
    this._roomUsersMap = {};
    /**
     * Full per-user data, updated via pipeline events.
     * @type {Map<string, {userId:string, username:string, displayName:string, role:string}>}
     */
    this._roomUsers = new Map();
    /** The bot's own role in the current room */
    this._botRole = null;

    // ── Mention reply cooldown ───────────────────────────────────────────────
    this._mentionLastReply = 0;

    // ── Pipeline client ──────────────────────────────────────────────────────
    this._pipeline = null;

    // ── Registries ───────────────────────────────────────────────────────────
    this.commands = new CommandRegistry();
    this.events = new EventRegistry();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start() {
    // Load all commands from commands/ and events from events/
    await this.commands.loadDir(new URL("../commands/", import.meta.url));
    await this.events.loadDir(new URL("../events/", import.meta.url));

    // Apply config-based event toggles
    if (!this.cfg.greetEnabled) this.events.disable("greet");

    await this._login();
    this._startPipeline();
  }

  async stop() {
    if (this._pipeline) {
      try {
        await this._api?.room?.leave(this.cfg.room).catch(() => {});
      } catch {
        // best-effort
      }
      this._pipeline.disconnect();
      this._pipeline = null;
    }
    this._log("info", "Bot stopped.");
  }

  // ── Login (REST) ───────────────────────────────────────────────────────────

  async _login() {
    const { createApiClient, ApiError } = await loadApiPackage();

    this._api = createApiClient({
      baseURL: this.cfg.apiUrl,
      timeout: 20_000,
      logging: false,
    });

    // Patch parseError to handle plain-string response bodies (library bug workaround)
    const _api = this._api.api;
    if (_api?.parseError) {
      const _orig = _api.parseError.bind(_api);
      _api.parseError = function (error) {
        if (error?.response) {
          const data = error.response.data;
          if (data == null || typeof data !== "object") {
            const msg =
              typeof data === "string"
                ? data
                : (error.message ?? "Request failed");
            return new ApiError(msg, error.response.status, error.code);
          }
        }
        return _orig(error);
      };
    }

    this._log("info", `Logging in as ${this.cfg.email}…`);

    let loginData;
    try {
      const res = await this._api.auth.login({
        login: this.cfg.email,
        password: this.cfg.password,
      });
      loginData = res.data;
    } catch (err) {
      const status = err.status ?? err.response?.status;
      throw new Error(`Login failed (${status ?? "network"}): ${err.message}`);
    }

    const token = loginData?.data?.accessToken ?? loginData?.accessToken;
    if (!token) throw new Error("Login did not return accessToken");

    this._token = token;
    this._api.api.setAuthToken(token);

    // Extract identity from login response
    const loginUser = loginData?.data?.user ?? loginData?.user ?? null;
    if (loginUser) {
      this._userId = loginUser.id ?? loginUser.userId ?? null;
      this._username = loginUser.username ?? null;
      this._displayName =
        loginUser.displayName ?? loginUser.display_name ?? null;
      this._log("info", `Logged in as @${this._username} (id=${this._userId})`);
    }

    // Fallback: call auth.me()
    if (!this._userId) {
      try {
        const meRes = await this._api.auth.me();
        const meData = meRes?.data?.data ?? meRes?.data ?? {};
        const me = meData.user ?? meData;
        this._userId = me.id ?? me.userId ?? null;
        this._username = me.username ?? null;
        this._displayName = me.displayName ?? me.display_name ?? null;
        this._log("info", `Identity (me fallback): @${this._username}`);
      } catch (err) {
        this._log("warn", `auth.me() failed: ${err.message}`);
      }
    }
  }

  // ── Pipeline (WebSocket) ───────────────────────────────────────────────────

  _startPipeline() {
    const token = this._token;

    this._pipeline = createPipeline({
      url: this.cfg.wsUrl,
      tokenProvider: () => token,
      webSocketFactory: (url) => new WebSocket(url),
      loggerName: "chatbot",
    });

    // ── Connection lifecycle ────────────────────────────────────────────────

    this._pipeline.onConnection("onReady", (ready) => {
      this._startedAt = Date.now();
      this._wootCount = 0;
      this._reactions = { woots: 0, mehs: 0, grabs: 0 };
      this._currentReactions = { woots: 0, mehs: 0, grabs: 0 };
      this._currentTrackStartedAt = null;
      this._songCount = 0;

      this._log(
        "info",
        `Pipeline ready (session=${ready?.session_id}). Joining #${this.cfg.room}…`,
      );

      // Subscribe to core events + any additional events required by event handlers
      const coreEvents = [
        Events.ROOM_CHAT_MESSAGE,
        Events.ROOM_DJ_ADVANCE,
        Events.ROOM_WAITLIST_LEAVE,
        Events.ROOM_WAITLIST_UPDATE,
        Events.ROOM_VOTE,
        Events.ROOM_GRAB,
        Events.ROOM_USER_JOIN,
        Events.ROOM_USER_LEAVE,
        Events.ROOM_USER_KICK,
        Events.ROOM_USER_BAN,
        Events.ROOM_USER_ROLE_UPDATE,
      ];
      const allEvents = [
        ...new Set([...coreEvents, ...this.events.getRequiredEvents()]),
      ];
      this._pipeline.subscribe(allEvents);

      this._joinRoom().catch((err) =>
        this._log("warn", `Join failed: ${err.message}`),
      );
    });

    this._pipeline.onConnection("onDisconnect", (code, reason) => {
      this._log(
        "info",
        `Disconnected (${code}${reason ? " – " + reason : ""})`,
      );
    });

    this._pipeline.onConnection("onReconnect", () => {
      this._log("info", "Reconnected to pipeline.");
    });

    this._pipeline.onConnection("onError", (err) => {
      this._log("warn", `Pipeline error: ${JSON.stringify(err)}`);
    });

    // ── Event bindings ──────────────────────────────────────────────────────

    this._pipeline.on(Events.ROOM_DJ_ADVANCE, (data) =>
      this._onDjAdvance(data),
    );
    this._pipeline.on(Events.ROOM_WAITLIST_LEAVE, (data) =>
      this._onWaitlistLeave(data),
    );
    this._pipeline.on(Events.ROOM_WAITLIST_UPDATE, (data) =>
      this._onWaitlistUpdate(data),
    );
    this._pipeline.on(Events.ROOM_VOTE, (data) => this._onVote(data));
    this._pipeline.on(Events.ROOM_GRAB, (data) => this._onGrab(data));
    this._pipeline.on(Events.ROOM_CHAT_MESSAGE, (data) =>
      this._onChatMessage(data),
    );
    this._pipeline.on(Events.ROOM_USER_JOIN, (data) =>
      this._onRoomUserJoin(data),
    );
    this._pipeline.on(Events.ROOM_USER_LEAVE, (data) =>
      this._onRoomUserLeave(data),
    );
    this._pipeline.on(Events.ROOM_USER_KICK, (data) =>
      this._onRoomUserLeave(data),
    );
    this._pipeline.on(Events.ROOM_USER_BAN, (data) =>
      this._onRoomUserLeave(data),
    );
    this._pipeline.on(Events.ROOM_USER_ROLE_UPDATE, (data) =>
      this._onRoomUserRoleUpdate(data),
    );

    this._pipeline.connect();
  }

  // ── Room join ──────────────────────────────────────────────────────────────

  async _joinRoom() {
    const joinRes = await this._api.room.join(this.cfg.room);
    const inner = joinRes?.data?.data ?? joinRes?.data ?? {};
    const roomObj = inner.room ?? inner;
    this._roomName = roomObj.name ?? roomObj.title ?? roomObj.roomName ?? null;

    // Populate user cache from the join response
    const users = inner.users ?? [];
    for (const u of users) {
      const uid = u.userId ?? u.user_id ?? u.id;
      if (uid != null) {
        const uidStr = String(uid);
        const displayName =
          u.displayName ?? u.display_name ?? u.username ?? null;
        this._roomUsersMap[uidStr] = displayName;
        this._roomUsers.set(uidStr, {
          userId: uidStr,
          username: u.username ?? null,
          displayName,
          role: u.role ?? "user",
        });
        if (uidStr === String(this._userId)) {
          this._botRole = u.role ?? "user";
          this._log("info", `Bot room role: ${this._botRole}`);
        }
      }
    }

    this._log(
      "info",
      `Joined room${this._roomName ? ` "${this._roomName}"` : ""}`,
    );
    this._refreshWaitlist().catch(() => {});
  }

  // ── Pipeline event handlers ────────────────────────────────────────────────

  _onDjAdvance(data) {
    const media =
      data?.media ?? data?.currentMedia ?? data?.current_media ?? {};
    const dj = data?.dj ?? data?.currentDj ?? data?.current_dj ?? {};

    this._djName = dj.displayName ?? dj.display_name ?? dj.username ?? null;
    this._currentTrack = {
      title: media.title ?? null,
      artist: media.artist ?? media.artistName ?? media.artist_name ?? null,
      duration: media.duration ?? media.length ?? null,
      source: media.source ?? media.platform ?? null,
      sourceId:
        media.sourceId ??
        media.source_id ??
        media.cid ??
        media.videoId ??
        media.video_id ??
        null,
      youtubeId:
        media.sourceId ??
        media.source_id ??
        media.youtubeId ??
        media.youtube_id ??
        media.cid ??
        media.videoId ??
        media.video_id ??
        null,
    };
    this._currentTrackStartedAt = Date.now();

    this._log(
      "info",
      `DJ_ADVANCE: "${this._currentTrack.title}" by ${this._currentTrack.artist} — DJ: ${this._djName}`,
    );

    // Flush per-track reaction counters into session totals
    this._reactions.woots += this._currentReactions.woots;
    this._reactions.mehs += this._currentReactions.mehs;
    this._reactions.grabs += this._currentReactions.grabs;
    this._currentReactions = { woots: 0, mehs: 0, grabs: 0 };

    this._refreshWaitlist().catch(() => {});

    if (this.cfg.autoWoot) {
      setTimeout(() => this._castVote(), WOOT_DELAY_MS);
    }

    setTimeout(() => this._checkTrackBlacklist(), 1200);

    this._songCount++;
    this._maybeSendIntervalMessage().catch(() => {});

    this.events
      .dispatch(Events.ROOM_DJ_ADVANCE, this._buildEventCtx(), data)
      .catch(() => {});
  }

  _onWaitlistLeave(data) {
    const leftId = data?.userId ?? data?.user_id;
    const isMe =
      (this._userId && String(leftId) === String(this._userId)) ||
      (this._username &&
        (data?.username ?? "").toLowerCase() === this._username.toLowerCase());

    if (isMe) this._waitlistPosition = null;

    this.events
      .dispatch(Events.ROOM_WAITLIST_LEAVE, this._buildEventCtx(), data)
      .catch(() => {});
  }

  _onWaitlistUpdate(data) {
    const wl = data?.waitlist ?? data?.queue ?? [];
    if (Array.isArray(wl)) {
      this._waitlistTotal = wl.length;
      const myIdx = wl.findIndex((u) => this._matchEntry(u));
      this._waitlistPosition = myIdx >= 0 ? myIdx + 1 : null;
      this._nextDjName = wl.length > 0 ? this._resolveName(wl[0]) : null;
    }

    this.events
      .dispatch(Events.ROOM_WAITLIST_UPDATE, this._buildEventCtx(), data)
      .catch(() => {});
  }

  _onVote(data) {
    if (data?.woots != null) this._currentReactions.woots = data.woots;
    if (data?.mehs != null) this._currentReactions.mehs = data.mehs;
  }

  _onGrab(data) {
    if (data?.grabs != null) this._currentReactions.grabs = data.grabs;
    else this._currentReactions.grabs++;
  }

  _onRoomUserJoin(data) {
    const uid = String(data?.userId ?? data?.user_id ?? data?.id ?? "");
    if (!uid) return;

    const displayName =
      data?.displayName ?? data?.display_name ?? data?.username ?? null;
    this._roomUsersMap[uid] = displayName;
    this._roomUsers.set(uid, {
      userId: uid,
      username: data?.username ?? null,
      displayName,
      role: data?.role ?? "user",
    });

    // Dispatch to event handlers (e.g. greet)
    this.events
      .dispatch(Events.ROOM_USER_JOIN, this._buildEventCtx(), data)
      .catch(() => {});
  }

  _onRoomUserLeave(data) {
    const uid = String(data?.userId ?? data?.user_id ?? data?.id ?? "");
    if (uid) this._roomUsers.delete(uid);

    this.events
      .dispatch(Events.ROOM_USER_LEAVE, this._buildEventCtx(), data)
      .catch(() => {});
  }

  _onRoomUserRoleUpdate(data) {
    const uid = String(data?.userId ?? data?.user_id ?? data?.id ?? "");
    const newRole = data?.role ?? "user";
    if (!uid) return;

    const existing = this._roomUsers.get(uid);
    if (existing) existing.role = newRole;

    if (uid === String(this._userId)) {
      this._botRole = newRole;
      this._log("info", `Bot role updated to: ${this._botRole}`);
    }
  }

  _onChatMessage(data) {
    // Skip own messages
    if (
      (this._userId &&
        String(data?.userId ?? data?.user_id) === String(this._userId)) ||
      (this._username &&
        (data?.username ?? "").toLowerCase() === this._username.toLowerCase())
    ) {
      return;
    }

    const content = data?.message ?? data?.content ?? "";
    const sender = {
      userId: data?.userId ?? data?.user_id ?? null,
      username: data?.username ?? null,
      displayName:
        data?.displayName ?? data?.display_name ?? data?.username ?? null,
    };

    // ── Command dispatch ──────────────────────────────────────────────────
    const prefix = this.cfg.cmdPrefix;
    if (content.startsWith(prefix)) {
      const withoutPrefix = content.slice(prefix.length).trimStart();
      const spaceIdx = withoutPrefix.indexOf(" ");
      const name =
        spaceIdx === -1
          ? withoutPrefix.toLowerCase()
          : withoutPrefix.slice(0, spaceIdx).toLowerCase();
      const rawArgs =
        spaceIdx === -1 ? "" : withoutPrefix.slice(spaceIdx + 1).trim();
      const args = rawArgs ? rawArgs.split(/\s+/) : [];

      if (name) {
        const ctx = this._buildCtx({ sender, args, rawArgs, message: content });
        this.commands
          .dispatch(ctx, name)
          .catch((err) =>
            this._log("warn", `Command error (${name}): ${err.message}`),
          );
      }
      return;
    }

    // ── Bot-mention reply ─────────────────────────────────────────────────
    if (this.cfg.botMessage) {
      this._checkMention(content, sender);
    }

    // ── Dispatch to event handlers ────────────────────────────────────────
    this.events
      .dispatch(Events.ROOM_CHAT_MESSAGE, this._buildEventCtx(), {
        ...data,
        sender,
      })
      .catch(() => {});
  }

  // ── REST actions ───────────────────────────────────────────────────────────

  async _castVote() {
    try {
      await this._api.room.vote(this.cfg.room, "woot");
      this._wootCount++;
      this._log("info", `Wooted "${this._currentTrack?.title ?? "track"}"`);
    } catch (err) {
      this._log("warn", `Vote failed: ${err.message}`);
    }
  }

  async _refreshWaitlist() {
    try {
      const res = await this._api.room.getBooth(this.cfg.room);
      const booth = res?.data?.data ?? res?.data ?? {};

      const boothUsers = booth.users ?? [];
      for (const u of boothUsers) {
        const uid = u.userId ?? u.user_id ?? u.id;
        if (uid != null) {
          const uidStr = String(uid);
          const displayName =
            u.displayName ?? u.display_name ?? u.username ?? null;
          this._roomUsersMap[uidStr] = displayName;
          if (!this._roomUsers.has(uidStr)) {
            this._roomUsers.set(uidStr, {
              userId: uidStr,
              username: u.username ?? null,
              displayName,
              role: u.role ?? "user",
            });
          }
        }
      }

      const wl = booth.waitlist ?? booth.queue ?? [];
      if (Array.isArray(wl)) {
        this._waitlistTotal = wl.length;
        const myIdx = wl.findIndex((u) => this._matchEntry(u));
        this._waitlistPosition = myIdx >= 0 ? myIdx + 1 : null;
        this._nextDjName = wl.length > 0 ? this._resolveName(wl[0]) : null;
      }
    } catch {
      // non-critical
    }
  }

  // ── Bot-mention reply ──────────────────────────────────────────────────────

  _checkMention(content, sender) {
    const lower = content.toLowerCase();
    const username = (this._username ?? "").toLowerCase();
    const displayName = (this._displayName ?? "").toLowerCase();

    const mentioned =
      (username && lower.includes(`@${username}`)) ||
      (displayName && lower.includes(`@${displayName}`));

    if (!mentioned) return;

    const now = Date.now();
    if (now - this._mentionLastReply < this.cfg.botMentionCooldownMs) return;
    this._mentionLastReply = now;

    const senderTag = sender.username ?? sender.displayName ?? "";
    const reply = senderTag
      ? `@${senderTag} ${this.cfg.botMessage}`
      : this.cfg.botMessage;

    this.sendChat(reply).catch((err) =>
      this._log("warn", `Mention reply failed: ${err.message}`),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Send a chat message in the current room. */
  async sendChat(content) {
    await this._api.chat.sendMessage(this.cfg.room, { content });
  }

  /** Returns a stable track id like "youtube:abc123" if possible. */
  getCurrentTrackId() {
    const source = this._currentTrack?.source;
    const sourceId = this._currentTrack?.sourceId;
    if (source && sourceId) return `${source}:${sourceId}`;
    const yid = this._currentTrack?.youtubeId;
    if (yid) return `youtube:${yid}`;
    return null;
  }

  /** Update a runtime config key and apply side effects if needed. */
  updateConfig(key, value) {
    this.cfg[key] = value;

    if (key === "greetEnabled") {
      if (value) this.events.enable("greet");
      else this.events.disable("greet");
    }
  }

  /** Seconds elapsed since the current track started. */
  getCurrentTrackElapsedSec() {
    if (!this._currentTrackStartedAt) return 0;
    return Math.max(
      0,
      Math.floor((Date.now() - this._currentTrackStartedAt) / 1000),
    );
  }

  async _maybeSendIntervalMessage() {
    if (!this._songCount) return;

    if (this.cfg.motdEnabled) {
      const interval = Number(this.cfg.motdInterval) || 0;
      if (interval <= 0 || this._songCount % interval !== 0) return;
      const msg = String(this.cfg.motd ?? "").trim();
      if (msg) await this.sendChat(msg);
      return;
    }

    const interval = Number(this.cfg.messageInterval) || 0;
    const list = Array.isArray(this.cfg.intervalMessages)
      ? this.cfg.intervalMessages
      : [];
    if (interval <= 0 || list.length === 0) return;
    if (this._songCount % interval !== 0) return;
    const idx = this._songCount % list.length;
    const msg = String(list[idx] ?? "").trim();
    if (msg) await this.sendChat(msg);
  }

  async _checkTrackBlacklist() {
    if (this.cfg.blacklistEnabled === false) return;
    const trackId = this.getCurrentTrackId();
    if (!trackId) return;
    let entry;
    try {
      entry = await getTrackBlacklist(trackId);
    } catch {
      return;
    }
    if (!entry) return;

    const title = entry.title ?? this._currentTrack?.title ?? "musica";
    const artist = entry.artist ?? this._currentTrack?.artist ?? "";
    const label = artist ? `${artist} - ${title}` : title;

    if (this.getBotRoleLevel() < getRoleLevel("bouncer")) {
      this._log("warn", "Blacklist match but bot lacks permission to skip.");
      return;
    }

    try {
      await this.sendChat(`Musica na blacklist: ${label}. Pulando.`);
      await this._api.room.skipTrack(this.cfg.room);
    } catch (err) {
      this._log("warn", `Blacklist skip failed: ${err.message}`);
    }
  }

  /**
   * Find a room user by username or displayName (case-insensitive, @ stripped).
   * @param {string} target
   * @returns {{userId:string, username:string, displayName:string, role:string}|null}
   */
  findRoomUser(target) {
    if (!target) return null;
    const lower = target.toLowerCase().replace(/^@/, "");
    for (const u of this._roomUsers.values()) {
      if (
        (u.username ?? "").toLowerCase() === lower ||
        (u.displayName ?? "").toLowerCase() === lower
      ) {
        return u;
      }
    }
    return null;
  }

  /** Numeric privilege level of the bot's own room role. */
  getBotRoleLevel() {
    return getRoleLevel(this._botRole);
  }

  /**
   * Numeric privilege level of a room user by their userId.
   * @param {string|number} userId
   */
  getUserRoleLevel(userId) {
    if (userId == null) return 0;
    const u = this._roomUsers.get(String(userId));
    return getRoleLevel(u?.role);
  }

  _matchEntry(u) {
    if (u == null) return false;
    if (typeof u === "number" || typeof u === "string") {
      return String(u) === String(this._userId);
    }
    const id = u.userId ?? u.user_id ?? u.id;
    if (id != null && String(id) === String(this._userId)) return true;
    return (
      this._username != null &&
      (u.username ?? "").toLowerCase() === this._username.toLowerCase()
    );
  }

  _resolveName(u) {
    if (u == null) return null;
    if (typeof u === "number" || typeof u === "string") {
      return this._roomUsersMap[String(u)] ?? null;
    }
    return u.displayName ?? u.display_name ?? u.username ?? null;
  }

  /**
   * Build the command execution context.
   * Passed as `ctx` to every command's execute() function.
   */
  _buildCtx({ sender, args, rawArgs, message }) {
    const senderRoleLevel = this.getUserRoleLevel(sender.userId);
    const senderRole =
      this._roomUsers.get(String(sender.userId ?? ""))?.role ?? "user";
    return {
      bot: this,
      api: this._api,
      args,
      rawArgs,
      message,
      sender,
      /** Role string of the message sender in this room */
      senderRole,
      /** Numeric privilege level of the sender (see lib/permissions.js) */
      senderRoleLevel,
      /** Role string of the bot itself in this room */
      botRole: this._botRole ?? "user",
      /** Numeric privilege level of the bot */
      botRoleLevel: this.getBotRoleLevel(),
      room: this.cfg.room,
      reply: (text) => this.sendChat(text),
    };
  }

  /**
   * Build the event dispatch context.
   * Passed as `ctx` to every event handler's handle() function.
   */
  _buildEventCtx() {
    return {
      bot: this,
      api: this._api,
      room: this.cfg.room,
      reply: (text) => this.sendChat(text),
    };
  }

  _log(level, msg) {
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    const prefix = `[${ts}] [${level.toUpperCase().padEnd(4)}]`;
    if (level === "error") console.error(prefix, msg);
    else if (level === "warn") console.warn(prefix, msg);
    else console.log(prefix, msg);
  }

  // ── State snapshot (used by !stats, !queue, etc.) ─────────────────────────

  getSessionState() {
    const now = Date.now();
    const uptimeSec = this._startedAt
      ? Math.floor((now - this._startedAt) / 1000)
      : 0;
    return {
      username: this._username,
      displayName: this._displayName,
      roomSlug: this.cfg.room,
      roomName: this._roomName,
      currentTrack: this._currentTrack,
      djName: this._djName,
      inWaitlist: this._waitlistPosition != null,
      waitlistPosition: this._waitlistPosition,
      waitlistTotal: this._waitlistTotal,
      nextDjName: this._nextDjName,
      wootCount: this._wootCount,
      /** Reactions for the current track only (reset on each DJ advance) */
      currentTrackReactions: { ...this._currentReactions },
      uptimeSec,
      startedAt: this._startedAt,
    };
  }
}
