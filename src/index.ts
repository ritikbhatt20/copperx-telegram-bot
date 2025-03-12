import bot from "./bot";
import "dotenv/config";

bot.launch().then(() => {
  console.log("Bot is running...");
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
