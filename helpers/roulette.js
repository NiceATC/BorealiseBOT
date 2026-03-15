import { pickRandom } from "./random.js";
import { getWaitlist } from "./waitlist.js";
import { getRoleLevel } from "../lib/permissions.js";

export const ROULETTE_DURATION_MS = 60_000;
export const rouletteState = {
  open: false,
  participants: new Map(),
  timeoutId: null,
};

const ROULETTE_MOVE_CHANCE = 75;

const ROULETTE_SHOT_LINES = [
  "Roleta russa: {name} puxou o gatilho... BANG! Fora da fila.",
  "O tambor girou... BANG! {name} perdeu e saiu da fila.",
  "Silencio... BANG! {name} tomou o tiro e saiu da fila.",
  "Click... BANG! {name} foi eliminado da fila.",
  "O revolver falou mais alto: {name} perdeu a vaga.",
];

const ROULETTE_MOVE_LINES = [
  "Roleta russa: {name} escapou, mas caiu na posicao {pos}.",
  "Click... {name} sobreviveu e foi para a posicao {pos}.",
  "A bala passou. {name} foi jogado para a posicao {pos}.",
  "Sem sangue dessa vez. {name} mudou para a posicao {pos}.",
  "O revolver falhou. {name} caiu na posicao {pos}.",
];

export async function closeRoulette(bot, api) {
  if (!rouletteState.open) return;
  rouletteState.open = false;
  if (rouletteState.timeoutId) clearTimeout(rouletteState.timeoutId);
  rouletteState.timeoutId = null;

  const entries = [...rouletteState.participants.entries()];
  rouletteState.participants.clear();

  if (!bot) return;
  if (entries.length === 0) {
    await bot.sendChat("Roleta russa encerrada: sem participantes.");
    return;
  }

  if (!api) {
    await bot.sendChat("Roleta russa encerrada: API indisponivel.");
    return;
  }

  let waitlist = [];
  try {
    waitlist = await getWaitlist(api, bot.cfg.room);
  } catch (err) {
    await bot.sendChat(
      `Roleta russa encerrada: erro ao ler a fila (${err.message}).`,
    );
    return;
  }

  if (!waitlist.length) {
    await bot.sendChat("Roleta russa encerrada: fila vazia.");
    return;
  }

  const waitlistIds = new Set(
    waitlist
      .map((u) => String(u.id ?? u.userId ?? u.user_id ?? ""))
      .filter(Boolean),
  );
  const eligible = entries.filter(([id]) => waitlistIds.has(String(id)));

  if (!eligible.length) {
    await bot.sendChat("Roleta russa encerrada: nenhum participante na fila.");
    return;
  }

  const [loserId, loserNameRaw] = pickRandom(eligible) ?? [];
  if (!loserId) {
    await bot.sendChat("Roleta russa encerrada: sem alvo valido.");
    return;
  }

  const loserName = loserNameRaw ?? "alguem";
  const loserTag = loserName.startsWith("@") ? loserName : `@${loserName}`;

  if (bot.getBotRoleLevel() < getRoleLevel("bouncer")) {
    await bot.sendChat(
      `Roleta russa encerrada. ${loserTag} seria removido, mas nao tenho permissao.`,
    );
    return;
  }

  const roll = Math.floor(Math.random() * 100);
  const moveInstead = roll < ROULETTE_MOVE_CHANCE;

  if (moveInstead) {
    if (!api?.room?.moveInWaitlist) {
      await bot.sendChat("Roleta russa encerrada: API indisponivel.");
      return;
    }

    const pos = Math.floor(Math.random() * waitlist.length) + 1;
    const apiPos = pos - 1;
    const line = pickRandom(ROULETTE_MOVE_LINES);
    const msg = line
      .replaceAll("{name}", loserTag)
      .replaceAll("{pos}", String(pos));
    await bot.sendChat(msg);

    setTimeout(() => {
      void (async () => {
        try {
          await api.room.moveInWaitlist(bot.cfg.room, Number(loserId), apiPos);
        } catch (err) {
          await bot.sendChat(
            `Falha ao mover ${loserTag}: ${err.message ?? "erro desconhecido"}.`,
          );
        }
      })();
    }, 1000);
    return;
  }

  if (!api?.room?.removeFromWaitlist) {
    await bot.sendChat("Roleta russa encerrada: API indisponivel.");
    return;
  }

  const line = pickRandom(ROULETTE_SHOT_LINES);
  const msg = line.replaceAll("{name}", loserTag);
  await bot.sendChat(msg);

  setTimeout(() => {
    void (async () => {
      try {
        await api.room.removeFromWaitlist(bot.cfg.room, Number(loserId));
      } catch (err) {
        await bot.sendChat(
          `Falha ao remover ${loserTag}: ${err.message ?? "erro desconhecido"}.`,
        );
      }
    })();
  }, 1000);
}
