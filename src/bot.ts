import { Telegraf } from "telegraf";

const bot = new Telegraf(process.env.BOT_TOKEN || '');

bot.start((ctx) => ctx.reply('Welcome to the Copperx Payout Bot!'));

export default bot;