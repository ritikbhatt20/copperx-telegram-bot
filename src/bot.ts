import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

const bot = new Telegraf(process.env.BOT_TOKEN || "");

// Basic Commands
bot.start((ctx) => {
  ctx.reply(
    "Welcome to the Copperx Payout Bot! Use /help to see available commands."
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "Here are the available commands:\n" +
      "/start - Welcome message\n" +
      "/help - Show this help message\n" +
      "/login - Log in with your Copperx account\n" +
      "/balance - Check your wallet balances\n" +
      "/send - Send USDC to an email or wallet\n" +
      "/withdraw - Withdraw USDC to a wallet or bank\n" +
      "/history - View your recent transactions\n" +
      "For support, visit: https://t.me/copperxcommunity/2183"
  );
});

bot.command("login", (ctx) => {
  ctx.reply(
    "Please enter your Copperx email to log in (e.g., /login user@example.com):"
  );
});

// Example with Inline Keyboard for /balance
bot.command("balance", (ctx) => {
  ctx.reply("Select a network to view your balance:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Solana", callback_data: "balance_solana" },
          { text: "Ethereum", callback_data: "balance_ethereum" },
        ],
        [{ text: "Cancel", callback_data: "cancel" }],
      ],
    },
  });
});

// Placeholder Commands
bot.command("send", (ctx) => {
  ctx.reply(
    "Send USDC with: /send <email or wallet> <amount>\nExample: /send user@example.com 10"
  );
});

bot.command("withdraw", (ctx) => {
  ctx.reply(
    "Withdraw USDC with: /withdraw <wallet or bank> <amount>\nExample: /withdraw 0x123... 50"
  );
});

bot.command("history", (ctx) => {
  ctx.reply("Fetching your last 10 transactions... (WIP)");
});

// Handle Inline Keyboard Actions
bot.action("balance_solana", (ctx) => {
  ctx.answerCbQuery(); // Acknowledge the callback
  ctx.reply("Your Solana balance will be displayed here (WIP).");
});

bot.action("balance_ethereum", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Your Ethereum balance will be displayed here (WIP).");
});

bot.action("cancel", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Action cancelled.");
});

// Handle Text Input (e.g., for login email)
bot.on(message("text"), (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/login")) {
    const email = text.split(" ")[1];
    if (email) {
      ctx.reply(`Sending OTP to ${email}... (WIP)`);
    } else {
      ctx.reply("Please provide an email: /login <email>");
    }
  }
});

export default bot;
