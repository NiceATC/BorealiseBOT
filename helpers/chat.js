const DEFAULT_MAX_LEN = 350;

function normalizeText(text) {
  if (text == null) return "";
  return String(text).replace(/\s+/g, " ").trim();
}

export function splitChatMessage(text, maxLen = DEFAULT_MAX_LEN) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const limit = Math.max(50, Number(maxLen) || DEFAULT_MAX_LEN);
  if (normalized.length <= limit) return [normalized];

  const chunks = [];
  let remaining = normalized;

  while (remaining.length > limit) {
    const slice = remaining.slice(0, limit + 1);
    let cut = slice.lastIndexOf(" ");
    if (cut < Math.floor(limit * 0.6)) cut = limit;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendChatChunks(sendFn, text, maxLen = DEFAULT_MAX_LEN) {
  const chunks = splitChatMessage(text, maxLen);
  for (const chunk of chunks) {
    if (chunk) await sendFn(chunk);
  }
  return chunks.length;
}
