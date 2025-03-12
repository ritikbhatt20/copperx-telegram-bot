import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { requestOtp, authenticateOtp, getProfile } from "./api";
import { CONFIG, UserSession } from "./config";

// In-memory session store (keyed by Telegram chat ID)
const sessions: { [chatId: string]: UserSession } = {};

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
      "/logout - Log out of your Copperx account\n" +
      "/profile - View your account profile\n" +
      "/balance - Check your wallet balances\n" +
      "/send - Send USDC to an email or wallet\n" +
      "/withdraw - Withdraw USDC to a wallet or bank\n" +
      "/history - View your recent transactions\n" +
      `For support, visit: ${CONFIG.SUPPORT_LINK}`
  );
});

// Login Flow
bot.command("login", async (ctx) => {
  const text = ctx.message.text.trim();
  const email = text.split(" ")[1]; // Get email after /login

  if (!email || !email.includes("@")) {
    ctx.reply(
      "Please provide a valid email: /login <email>\nExample: /login user@example.com"
    );
    return;
  }

  const chatId = ctx.chat.id.toString();
  try {
    const { sid } = await requestOtp(email);
    sessions[chatId] = { email, sid };
    ctx.reply(
      `OTP sent to ${email}. Please provide the OTP (e.g., /otp 123456):`
    );
  } catch (error: unknown) {
    const err = error as Error;
    ctx.reply(`Error: ${err.message}`);
  }
});

// OTP Verification
bot.command("otp", async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();
  const otp = text.split(" ")[1];

  if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
    ctx.reply("Please provide a valid 6-digit OTP: /otp <code>");
    return;
  }

  const session = sessions[chatId];
  if (!session || !session.email || !session.sid) {
    ctx.reply("Please start the login process with /login first.");
    return;
  }

  try {
    const { accessToken, expireAt, user } = await authenticateOtp(
      session.email,
      otp,
      session.sid
    );
    sessions[chatId] = { email: session.email, accessToken, expireAt };
    ctx.reply(
      `Logged in successfully as ${user.email}! Use /profile to view your details.`
    );
  } catch (error: unknown) {
    const err = error as Error;
    ctx.reply(`Error: ${err.message}`);
  }
});

// Logout Command
bot.command("logout", (ctx) => {
  const chatId = ctx.chat.id.toString();
  const session = sessions[chatId];

  if (!session || !session.accessToken) {
    ctx.reply("You are not logged in. Use /login to start.");
    return;
  }

  delete sessions[chatId]; // Remove session
  ctx.reply("You have been logged out successfully.");
});

// Profile Command
bot.command("profile", async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const session = sessions[chatId];

  if (!session || !session.accessToken) {
    ctx.reply("Please log in first with /login.");
    return;
  }

  try {
    const profile = await getProfile(session.accessToken);
    ctx.reply(
      `Profile Details:\n` +
        `ID: ${profile.id}\n` +
        `Name: ${profile.firstName || ""} ${profile.lastName || ""}\n` +
        `Email: ${profile.email}\n` +
        `Status: ${profile.status}`
    );
  } catch (error: unknown) {
    const err = error as Error;
    ctx.reply(`Error: ${err.message}`);
    if (err.message.includes("401")) {
      delete sessions[chatId]; // Clear session on auth failure
      ctx.reply("Session expired. Please log in again with /login.");
    }
  }
});

// Placeholder Commands (unchanged)
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

bot.action("balance_solana", (ctx) => {
  ctx.answerCbQuery();
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

export default bot;
