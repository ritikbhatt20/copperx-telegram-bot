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
} from "./handlers/commandHandlers";

// Initialize bot
export const bot = new Telegraf(process.env.BOT_TOKEN || "");

// Enable session middleware
bot.use(session());

// Basic commands
bot.start(handleStart);
bot.command("help", handleHelp);
bot.command("logout", handleLogout);
bot.command("profile", handleProfile);
bot.command("kyc", handleKycStatus);
bot.command("balance", handleBalance);
bot.command("send", handleStartSend);
bot.command("withdraw", handleStartWithdraw);
bot.command("history", handleTransactionHistory);

// Handle text messages (for conversation flows)
bot.on(message("text"), handleTextMessage);

// Handle callback queries (for inline buttons)
bot.on("callback_query", handleCallbackQuery);

// Handle errors
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);

  // Send error message to user
  ctx
    .reply(
      "Sorry, something went wrong. Please try again or use /help to see available commands."
    )
    .catch((e) => console.error("Error sending error message:", e));
});
