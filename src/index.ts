import "dotenv/config";
import { bot } from "./bot";

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not defined in the .env file");
}

bot.launch().then(() => {
  console.log("Bot is running...");
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
