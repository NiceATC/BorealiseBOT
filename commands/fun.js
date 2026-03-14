const EIGHT_BALL = [
  "Sim.",
  "Nao.",
  "Talvez.",
  "Sem chance.",
  "Pergunte de novo.",
  "Provavel.",
  "Improvavel.",
  "Com certeza.",
];

const THOR_LINES = [
  "Thor diz ola.",
  "O martelo esta pronto.",
  "Trovoes a caminho.",
];

const TENOR_BASE = "https://g.tenor.com/v1";
const TENOR_KEY =
  process.env.TENOR_API_KEY || process.env.GIF_API_KEY || "LIVDSRZULELA";
const TENOR_LIMIT = 20;

const ROULETTE_DURATION_MS = 60_000;
const rouletteState = {
  open: false,
  participants: new Map(),
  timeoutId: null,
};

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractTenorGifUrl(item) {
  if (!item || typeof item !== "object") return null;
  const formats = item.media_formats || item.mediaFormats || null;
  if (formats?.gif?.url) return formats.gif.url;
  if (formats?.mediumgif?.url) return formats.mediumgif.url;
  if (formats?.tinygif?.url) return formats.tinygif.url;

  const media = Array.isArray(item.media) ? item.media[0] : null;
  if (media?.gif?.url) return media.gif.url;
  if (media?.mediumgif?.url) return media.mediumgif.url;
  if (media?.tinygif?.url) return media.tinygif.url;
  return null;
}

async function fetchTenorGif(query) {
  const encodedKey = encodeURIComponent(TENOR_KEY);
  const encodedQuery = encodeURIComponent(query || "");
  const endpoint = query
    ? `${TENOR_BASE}/search?q=${encodedQuery}&key=${encodedKey}&limit=${TENOR_LIMIT}&media_filter=gif`
    : `${TENOR_BASE}/trending?key=${encodedKey}&limit=${TENOR_LIMIT}&media_filter=gif`;

  const data = await fetchJson(endpoint);
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) return null;
  const pick = pickRandom(results);
  return extractTenorGifUrl(pick);
}

async function getWaitlist(api, room) {
  if (!api?.room?.getWaitlist) return [];
  const res = await api.room.getWaitlist(room);
  const waitlist = res?.data?.data?.waitlist ?? res?.data?.waitlist ?? [];
  return Array.isArray(waitlist) ? waitlist : [];
}

async function closeRoulette(bot, api) {
  if (!rouletteState.open) return;
  rouletteState.open = false;
  if (rouletteState.timeoutId) clearTimeout(rouletteState.timeoutId);
  rouletteState.timeoutId = null;

  const entries = [...rouletteState.participants.entries()];
  rouletteState.participants.clear();

  if (!bot) return;
  if (entries.length === 0) {
    await bot.sendChat("Roulette encerrada: sem participantes.");
    return;
  }

  if (!api) {
    await bot.sendChat("Roulette encerrada: API indisponivel.");
    return;
  }

  let waitlist = [];
  try {
    waitlist = await getWaitlist(api, bot.cfg.room);
  } catch (err) {
    await bot.sendChat(
      `Roulette encerrada: erro ao ler a fila (${err.message}).`,
    );
    return;
  }

  if (!waitlist.length) {
    await bot.sendChat("Roulette encerrada: fila vazia.");
    return;
  }

  const waitlistIds = new Set(
    waitlist
      .map((u) => String(u.id ?? u.userId ?? u.user_id ?? ""))
      .filter(Boolean),
  );
  const eligible = entries.filter(([id]) => waitlistIds.has(String(id)));

  if (!eligible.length) {
    await bot.sendChat("Roulette encerrada: nenhum participante na fila.");
    return;
  }

  const [winnerId, winnerName] = pickRandom(eligible);
  const pos = Math.floor(Math.random() * waitlist.length) + 1;
  const apiPos = pos - 1;

  await bot.sendChat(
    `Roulette encerrada. Vencedor: ${winnerName}. Movendo para a posicao ${pos}.`,
  );

  setTimeout(() => {
    void (async () => {
      try {
        await api.room.moveInWaitlist(bot.cfg.room, Number(winnerId), apiPos);
      } catch (err) {
        await bot.sendChat(
          `Falha ao mover ${winnerName}: ${err.message ?? "erro desconhecido"}.`,
        );
      }
    })();
  }, 1000);
}

const ba = {
  name: "ba",
  description: "Mensagem simples de BA.",
  usage: "!ba",
  cooldown: 5000,

  async execute(ctx) {
    await ctx.reply("BA: nao configurado.");
  },
};

const eightBall = {
  name: "8ball",
  aliases: ["ask"],
  description: "Responde uma pergunta com uma resposta aleatoria.",
  usage: "!8ball <pergunta>",
  cooldown: 5000,

  async execute(ctx) {
    const question = String(ctx.rawArgs ?? "").trim();
    if (!question) {
      await ctx.reply("Uso: !8ball <pergunta>");
      return;
    }
    const answer = pickRandom(EIGHT_BALL);
    await ctx.reply(`Pergunta: ${question} | Resposta: ${answer}`);
  },
};

const cookie = {
  name: "cookie",
  description: "Da um cookie para alguem.",
  usage: "!cookie [usuario]",
  cooldown: 5000,

  async execute(ctx) {
    const { bot, sender } = ctx;
    const targetInput = String(ctx.rawArgs ?? "")
      .replace(/^@/, "")
      .trim();
    const senderName = sender.username ?? sender.displayName ?? "alguem";

    if (!targetInput) {
      await ctx.reply(`@${senderName} aqui esta seu cookie.`);
      return;
    }

    const user = bot.findRoomUser(targetInput);
    if (!user) {
      await ctx.reply(`Nao encontrei "${targetInput}" na sala.`);
      return;
    }

    const name = user.username ?? user.displayName ?? targetInput;
    await ctx.reply(`@${senderName} deu um cookie para @${name}.`);
  },
};

const ghostbuster = {
  name: "ghostbuster",
  description: "Verifica se um usuario esta na sala.",
  usage: "!ghostbuster [usuario]",
  cooldown: 5000,

  async execute(ctx) {
    const { bot, sender } = ctx;
    const targetInput = String(ctx.rawArgs ?? "")
      .replace(/^@/, "")
      .trim();
    const name =
      targetInput || sender.username || sender.displayName || "alguem";
    const user = bot.findRoomUser(name);
    if (user) {
      await ctx.reply(`${name} esta na sala.`);
      return;
    }
    await ctx.reply(`${name} nao esta na sala.`);
  },
};

const gif = {
  name: "gif",
  aliases: ["giphy"],
  description: "Envia um GIF aleatorio (com termo opcional).",
  usage: "!gif [termo]",
  cooldown: 5000,

  async execute(ctx) {
    const query = String(ctx.rawArgs ?? "").trim();
    try {
      const url = await fetchTenorGif(query);
      if (!url) {
        await ctx.reply("Nenhum GIF encontrado.");
        return;
      }
      await ctx.reply(`GIF: ${url}`);
    } catch (err) {
      await ctx.reply(`Erro ao buscar GIF: ${err.message}`);
    }
  },
};

const roulette = {
  name: "roulette",
  description: "Abre uma roulette simples no chat.",
  usage: "!roulette",
  cooldown: 5000,
  minRole: "bouncer",

  async execute(ctx) {
    const { bot, api, reply } = ctx;
    if (rouletteState.open) {
      await reply("Roulette ja esta aberta. Use !join para entrar.");
      return;
    }

    rouletteState.open = true;
    rouletteState.participants.clear();
    rouletteState.timeoutId = setTimeout(() => {
      closeRoulette(bot, api).catch(() => {});
    }, ROULETTE_DURATION_MS);

    await reply("Roulette aberta! Use !join para participar (60s).");
  },
};

const join = {
  name: "join",
  description: "Entra na roulette aberta.",
  usage: "!join",
  cooldown: 3000,

  async execute(ctx) {
    const { sender, reply, api, bot } = ctx;
    if (!rouletteState.open) {
      await reply("Roulette fechada.");
      return;
    }

    const key = sender.userId != null ? String(sender.userId) : "";
    const name = sender.displayName ?? sender.username ?? "alguem";
    if (!key) {
      await reply("Nao foi possivel identificar o usuario.");
      return;
    }

    try {
      const waitlist = await getWaitlist(api, bot.cfg.room);
      const inList = waitlist.some(
        (u) => String(u.id ?? u.userId ?? u.user_id ?? "") === key,
      );
      if (!inList) {
        await reply("Voce precisa estar na fila para participar.");
        return;
      }
    } catch (err) {
      await reply(`Nao consegui ler a fila: ${err.message}`);
      return;
    }

    if (rouletteState.participants.has(key)) {
      await reply("Voce ja esta na roulette.");
      return;
    }

    rouletteState.participants.set(key, name);
    await reply(`${name} entrou na roulette.`);
  },
};

const leave = {
  name: "leave",
  description: "Sai da roulette aberta.",
  usage: "!leave",
  cooldown: 3000,

  async execute(ctx) {
    const { sender, reply } = ctx;
    if (!rouletteState.open) {
      await reply("Roulette fechada.");
      return;
    }

    const key = sender.userId != null ? String(sender.userId) : "";
    const name = sender.displayName ?? sender.username ?? "alguem";
    if (!key) {
      await reply("Nao foi possivel identificar o usuario.");
      return;
    }
    if (!rouletteState.participants.has(key)) {
      await reply("Voce nao esta na roulette.");
      return;
    }

    rouletteState.participants.delete(key);
    await reply(`${name} saiu da roulette.`);
  },
};

const thor = {
  name: "thor",
  description: "Resposta divertida do Thor.",
  usage: "!thor",
  cooldown: 10_000,

  async execute(ctx) {
    await ctx.reply(pickRandom(THOR_LINES));
  },
};

export default [
  ba,
  eightBall,
  cookie,
  ghostbuster,
  gif,
  roulette,
  join,
  leave,
  thor,
];
