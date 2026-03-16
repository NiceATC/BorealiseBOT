// lib/storage.js
// Simple SQLite wrapper for persistent storage (settings, blacklists, etc)

import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "borealisebot.sqlite");

let db = null;

export async function initStorage() {
  if (db) return;
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
  // Example: settings table
  await db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  // Example: blacklist table
  await db.exec(`CREATE TABLE IF NOT EXISTS blacklist (
    type TEXT,
    value TEXT,
    PRIMARY KEY (type, value)
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS track_blacklist (
    track_id TEXT PRIMARY KEY,
    source TEXT,
    source_id TEXT,
    title TEXT,
    artist TEXT,
    added_at INTEGER
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS waitlist_snapshot (
    user_id TEXT PRIMARY KEY,
    position INTEGER,
    username TEXT,
    display_name TEXT,
    updated_at INTEGER
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS greet_state (
    user_id TEXT PRIMARY KEY,
    greeted_at INTEGER,
    greeted_count INTEGER
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS afk_state (
    user_id TEXT PRIMARY KEY,
    last_chat_at INTEGER,
    last_join_at INTEGER,
    updated_at INTEGER
  )`);
}

export async function setSetting(key, value) {
  await db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    key,
    JSON.stringify(value),
  );
}

export async function getSetting(key, fallback = null) {
  const row = await db.get("SELECT value FROM settings WHERE key = ?", key);
  return row ? JSON.parse(row.value) : fallback;
}

export async function getAllSettings() {
  const rows = await db.all("SELECT key, value FROM settings");
  const out = {};
  for (const row of rows) {
    out[row.key] = JSON.parse(row.value);
  }
  return out;
}

export async function addBlacklist(type, value) {
  await db.run(
    "INSERT OR IGNORE INTO blacklist (type, value) VALUES (?, ?)",
    type,
    value,
  );
}

export async function removeBlacklist(type, value) {
  await db.run(
    "DELETE FROM blacklist WHERE type = ? AND value = ?",
    type,
    value,
  );
}

export async function getBlacklist(type) {
  const rows = await db.all("SELECT value FROM blacklist WHERE type = ?", type);
  return rows.map((r) => r.value);
}

// ── Track blacklist (music) ───────────────────────────────────────────────

export async function addTrackBlacklist(entry) {
  await db.run(
    "INSERT OR REPLACE INTO track_blacklist (track_id, source, source_id, title, artist, added_at) VALUES (?, ?, ?, ?, ?, ?)",
    entry.trackId,
    entry.source,
    entry.sourceId,
    entry.title,
    entry.artist,
    entry.addedAt ?? Date.now(),
  );
}

export async function removeTrackBlacklist(trackId) {
  await db.run("DELETE FROM track_blacklist WHERE track_id = ?", trackId);
}

export async function getTrackBlacklist(trackId) {
  return db.get("SELECT * FROM track_blacklist WHERE track_id = ?", trackId);
}

export async function listTrackBlacklist(limit = 20) {
  const rows = await db.all(
    "SELECT * FROM track_blacklist ORDER BY added_at DESC LIMIT ?",
    limit,
  );
  return rows;
}

// ── Waitlist snapshot (DC restore) ─────────────────────────────────────────

export async function upsertWaitlistSnapshot(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const now = Date.now();
  await db.exec("BEGIN");
  try {
    for (const entry of entries) {
      await db.run(
        "INSERT OR REPLACE INTO waitlist_snapshot (user_id, position, username, display_name, updated_at) VALUES (?, ?, ?, ?, ?)",
        String(entry.userId),
        Number(entry.position),
        entry.username ?? null,
        entry.displayName ?? null,
        entry.updatedAt ?? now,
      );
    }
    await db.exec("COMMIT");
  } catch (err) {
    await db.exec("ROLLBACK");
    throw err;
  }
}

export async function getWaitlistSnapshot(userId) {
  return db.get(
    "SELECT * FROM waitlist_snapshot WHERE user_id = ?",
    String(userId),
  );
}

// ── Greet state (welcome persistence) ─────────────────────────────────────

export async function getGreetState(userId) {
  return db.get("SELECT * FROM greet_state WHERE user_id = ?", String(userId));
}

export async function upsertGreetState({ userId, greetedAt, greetedCount }) {
  if (userId == null) return;
  await db.run(
    "INSERT OR REPLACE INTO greet_state (user_id, greeted_at, greeted_count) VALUES (?, ?, ?)",
    String(userId),
    Number(greetedAt) || Date.now(),
    Number.isFinite(greetedCount) ? greetedCount : 1,
  );
}

// ── AFK state (activity persistence) ─────────────────────────────────────

export async function listAfkState() {
  return db.all("SELECT * FROM afk_state");
}

export async function getAfkState(userId) {
  if (userId == null) return null;
  return db.get("SELECT * FROM afk_state WHERE user_id = ?", String(userId));
}

export async function upsertAfkState({ userId, lastChatAt, lastJoinAt }) {
  if (userId == null) return;
  const uid = String(userId);
  const existing = await db.get(
    "SELECT last_chat_at, last_join_at FROM afk_state WHERE user_id = ?",
    uid,
  );

  const toStamp = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  };

  const chatAt = toStamp(lastChatAt ?? existing?.last_chat_at ?? null);
  const joinAt = toStamp(lastJoinAt ?? existing?.last_join_at ?? null);
  const updatedAt = Date.now();

  await db.run(
    "INSERT OR REPLACE INTO afk_state (user_id, last_chat_at, last_join_at, updated_at) VALUES (?, ?, ?, ?)",
    uid,
    chatAt,
    joinAt,
    updatedAt,
  );
}

export async function upsertAfkStateBatch(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;

  const toStamp = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  };

  const now = Date.now();
  await db.exec("BEGIN");
  try {
    for (const entry of entries) {
      const uid = String(entry.userId ?? "");
      if (!uid) continue;
      const chatAt = toStamp(entry.lastChatAt ?? null);
      const joinAt = toStamp(entry.lastJoinAt ?? null);
      await db.run(
        "INSERT OR REPLACE INTO afk_state (user_id, last_chat_at, last_join_at, updated_at) VALUES (?, ?, ?, ?)",
        uid,
        chatAt,
        joinAt,
        entry.updatedAt ?? now,
      );
    }
    await db.exec("COMMIT");
  } catch (err) {
    await db.exec("ROLLBACK");
    throw err;
  }
}
