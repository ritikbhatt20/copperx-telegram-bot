import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { handleTextMessage } from "./handlers/messageHandlers";
import { handleCallbackQuery } from "./handlers/callbackHandlers";
import {
  handleStart,
  handleHelp,
  handleLogout,
  handleProfile,
  handleKycStatus,
  handleBalance,
  handleStartSend,
  handleStartWithdraw,
  handleTransactionHistory,
  handleSetDefaultWallet,
} from "./handlers/commandHandlers";

export const bot = new Telegraf(process.env.BOT_TOKEN || "");

bot.use(session());

bot.start(handleStart);
bot.command("help", handleHelp);
bot.command("logout", handleLogout);
bot.command("profile", handleProfile);
bot.command("kyc", handleKycStatus);
bot.command("balance", handleBalance);
bot.command("setdefault", handleSetDefaultWallet);
bot.command("send", handleStartSend);
bot.command("withdraw", handleStartWithdraw);
bot.command("history", handleTransactionHistory);

bot.on(message("text"), handleTextMessage);

bot.on("callback_query", handleCallbackQuery);

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx
    .reply(
      "Sorry, something went wrong. Please try again or use /help to see available commands."
    )
    .catch((e) => console.error("Error sending error message:", e));
});
