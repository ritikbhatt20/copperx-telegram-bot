import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import winston from "winston";
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
  handleTransactionHistory,
  handleSetDefaultWallet,
  handleStartAddPayee,
  handleStartSendEmail,
  handleStartWithdraw,
  handleDeposit,
  handleSendBatch,
  handlePoints,
} from "./handlers/commandHandlers";
import { disconnectPusherClient } from "./services/pusherClient";
import { RedisSessionManager } from "./services/sessionManager";

// Load environment variables at the top
require("dotenv").config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({ format: winston.format.simple() })
  );
}

logger.info("All environment variables:", process.env);
logger.info("BOT_TOKEN value:", process.env.BOT_TOKEN);

if (!process.env.BOT_TOKEN) {
  logger.error("BOT_TOKEN is not defined in environment variables");
  throw new Error("BOT_TOKEN is not defined in environment variables");
}

// Instantiate RedisSessionManager after dotenv
export const sessionManager = new RedisSessionManager();

export const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session());

bot.start(handleStart);
bot.command("help", handleHelp);
bot.command("logout", async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) disconnectPusherClient(chatId);
  return handleLogout(ctx);
});
bot.command("profile", handleProfile);
bot.command("kyc", handleKycStatus);
bot.command("balance", handleBalance);
bot.command("setdefault", handleSetDefaultWallet);
bot.command("send", handleStartSend);
bot.command("history", handleTransactionHistory);
bot.command("addpayee", handleStartAddPayee);
bot.command("sendemail", handleStartSendEmail);
bot.command("withdraw", handleStartWithdraw);
bot.command("deposit", handleDeposit);
bot.command("sendbatch", handleSendBatch);
bot.command("points", handlePoints);

bot.on(message("text"), handleTextMessage);
bot.on("callback_query", handleCallbackQuery);

bot.catch((err, ctx) => {
  logger.error(`Error for ${ctx.updateType}:`, err);
  ctx
    .reply("⚠️ Something went wrong. Please try again later.")
    .catch((e) => logger.error("Error sending error message:", e));
});

bot
  .launch()
  .then(() => logger.info("Bot started successfully"))
  .catch((err) => logger.error("Failed to start bot:", err));

process.once("SIGINT", async () => {
  await sessionManager.disconnect();
  bot.stop("SIGINT");
});
process.once("SIGTERM", async () => {
  await sessionManager.disconnect();
  bot.stop("SIGTERM");
});
