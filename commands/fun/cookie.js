import { pickRandom } from "../../helpers/random.js";

const COOKIE_SELF_LINES = [
  "@{sender} ganhou um cookie crocante.",
  "Cookie entregue para @{sender}. Cuidado, esta quente.",
  "@{sender} recebeu um cookie gigante.",
  "Um cookie caiu do ceu para @{sender}.",
  "@{sender} achou um cookie no bolso.",
  "@{sender} abriu a caixa e achou um cookie dourado.",
  "@{sender} foi premiado com um cookie extra macio.",
];

const COOKIE_GIFT_LINES = [
  "@{sender} deu um cookie para @{target}. Acabou de sair do forno.",
  "@{sender} jogou um cookie para @{target}. Pegou no ar.",
  "@{sender} subornou @{target} com um cookie.",
  "@{sender} entregou um cookie extra crocante para @{target}.",
  "@{sender} enviou um cookie misterioso para @{target}.",
  "@{sender} passou um cookie secreto para @{target}.",
  "@{sender} serviu um cookie gigante para @{target}.",
];

function formatCookieLine(line, senderName, targetName) {
  return line
    .replaceAll("{sender}", senderName)
    .replaceAll("{target}", targetName ?? "");
}

export default {
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
      const line = pickRandom(COOKIE_SELF_LINES);
      const msg = formatCookieLine(line, senderName, null);
      await ctx.reply(msg);
      return;
    }

    const user = bot.findRoomUser(targetInput);
    if (!user) {
      await ctx.reply(`Nao encontrei "${targetInput}" na sala.`);
      return;
    }

    const name = user.username ?? user.displayName ?? targetInput;
    const line = pickRandom(COOKIE_GIFT_LINES);
    const msg = formatCookieLine(line, senderName, name);
    await ctx.reply(msg);
  },
};
