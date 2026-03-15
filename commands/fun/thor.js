import { pickRandom } from "../../helpers/random.js";
import { getWaitlist } from "../../helpers/waitlist.js";
import { getRoleLevel } from "../../lib/permissions.js";

const GOOD_CHANCE = 3;
const NEUTRAL_CHANCE = 27;

const THOR_GOOD_LINES = [
  "Thor sorriu para {name}. Voce sobe para o topo da fila.",
  "O martelo aprovou {name}. Indo para a posicao 1.",
  "Raro! Thor favoreceu {name}. Posicao 1 agora.",
];

const THOR_NEUTRAL_LINES = [
  "Thor esta calmo. Nada muda.",
  "O martelo dorme. Fila intacta.",
  "Thor observou em silencio. Nada aconteceu.",
];

const THOR_BAD_LINES = [
  "Thor ficou bravo. {name} saiu da fila.",
  "Relampagos! {name} perdeu a vaga na fila.",
  "O martelo falou. {name} foi removido da fila.",
];

function formatThorLine(line, name) {
  return line.replaceAll("{name}", name);
}

export default {
  name: "thor",
  description: "Teste sua sorte com o martelo do Thor.",
  usage: "!thor",
  cooldown: 10_000,

  async execute(ctx) {
    const { bot, api, sender, reply } = ctx;
    const userId = sender.userId != null ? String(sender.userId) : "";
    const name = sender.username ?? sender.displayName ?? "alguem";
    const tag = `@${name}`;

    if (!userId) {
      await reply("Nao foi possivel identificar o usuario.");
      return;
    }

    if (!api?.room?.getWaitlist) {
      await reply("API indisponivel.");
      return;
    }

    if (bot.getBotRoleLevel() < getRoleLevel("bouncer")) {
      await reply("Nao tenho permissao para mover/remover da fila.");
      return;
    }

    let waitlist = [];
    try {
      waitlist = await getWaitlist(api, bot.cfg.room);
    } catch (err) {
      await reply(`Nao consegui ler a fila: ${err.message}`);
      return;
    }

    const inList = waitlist.some(
      (u) => String(u.id ?? u.userId ?? u.user_id ?? "") === userId,
    );
    if (!inList) {
      await reply("Voce precisa estar na fila para usar !thor.");
      return;
    }

    const roll = Math.floor(Math.random() * 100);
    if (roll < GOOD_CHANCE) {
      try {
        await api.room.moveInWaitlist(bot.cfg.room, Number(userId), 0);
        const msg = formatThorLine(pickRandom(THOR_GOOD_LINES), tag);
        await reply(msg);
      } catch (err) {
        await reply(`Falha ao mover ${tag}: ${err.message}`);
      }
      return;
    }

    if (roll < GOOD_CHANCE + NEUTRAL_CHANCE) {
      const msg = formatThorLine(pickRandom(THOR_NEUTRAL_LINES), tag);
      await reply(msg);
      return;
    }

    try {
      await api.room.removeFromWaitlist(bot.cfg.room, Number(userId));
      const msg = formatThorLine(pickRandom(THOR_BAD_LINES), tag);
      await reply(msg);
    } catch (err) {
      await reply(`Falha ao remover ${tag}: ${err.message}`);
    }
  },
};
