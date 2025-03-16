import { Context, Markup } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { sessionManager } from "../services/sessionManager";
import {
  requestOtp,
  authenticateOtp,
  getProfile,
  getKycStatus,
  getBalances,
  getWallets,
  setDefaultWallet,
  createPayee,
  getPayees,
  sendToUser,
  getWalletBalance,
  getAccounts,
  getOfframpQuote,
  createOfframpTransfer,
  getTransactionHistory,
  withdrawToWallet,
  sendBatchPayment,
  getTotalPoints,
} from "../services/apiClient";
import { UserSession } from "../config";
import { BalanceResponse, NETWORK_NAMES } from "../config";
import { initializePusherClient } from "../services/pusherClient";
import { v4 as uuidv4 } from "uuid";

interface SendState {
  step: "address" | "amount" | "confirm";
  walletAddress?: string;
  amount?: number;
}

const sendStates = new Map<string, SendState>();

// Helper function to check login and handle unauthorized users
function requireAuth(ctx: Context, next: () => Promise<void>): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) {
    ctx.reply("Error: Could not identify your chat session.");
    return Promise.resolve();
  }

  if (!sessionManager.isLoggedIn(chatId)) {
    ctx.reply(
      "⚠️ You need to be logged in to use this command.\n\n" +
        "Press the button below to log in:",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
    return Promise.resolve();
  }

  return next();
}

// Start command
export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  if (!sessionManager.getSession(chatId)) {
    sessionManager.setSession(chatId, { chatId });
  }

  const isLoggedIn = sessionManager.isLoggedIn(chatId);

  if (!isLoggedIn) {
    await ctx.reply(
      "🚀 Welcome to CopperX Bot!\n\n" +
        "⚠️ You need to be logged in first to use this bot.\n\n" +
        "Press the button below to log in:",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔑 Log In", "start_login")],
      ])
    );
  } else {
    await ctx.reply(
      "🚀 Welcome to CopperX Bot!\n\n" +
        "I'm here to help you manage your CopperX account. Choose an option below:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("👤 Profile", "view_profile"),
          Markup.button.callback("📋 KYC Status", "view_kyc"),
        ],
        [
          Markup.button.callback("🎒 Wallets", "view_wallets"),
          Markup.button.callback("💰 Balance", "view_balance"),
        ],
        [
          Markup.button.callback("📤 Send Money", "send_money_menu"),
          Markup.button.callback("📥 Deposit", "deposit"),
        ],
        [
          Markup.button.callback("⚙️ Set Default Wallet", "set_default_wallet"),
          Markup.button.callback("➕ Add Payee", "start_addpayee"),
        ],
        [
          Markup.button.callback("📱 Batch Payment", "send_batch"),
          Markup.button.callback("📜 Transactions", "view_history"),
        ],
        [
          Markup.button.callback("💎 View Points", "view_points"),
          Markup.button.callback("🔒 Logout", "logout"),
        ],
      ])
    );
  }
}

// Help command
export async function handleHelp(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const isLoggedIn = sessionManager.isLoggedIn(chatId);

  const helpMessage =
    "*Copperx Payout Bot Commands* 📋\n\n" +
    "*Basic Commands:*\n" +
    "• /start - Start or restart the bot\n" +
    "• /help - Show this help message\n\n" +
    "*Account:*\n" +
    `• ${isLoggedIn ? "📤 /logout - Log out" : "🔑 Log in below"}\n` +
    "• 👤 /profile - View your profile\n" +
    "• 🔒 /kyc - Check KYC status\n" +
    "• 🏦 /setdefault - Set your default wallet\n\n" +
    "*Transactions:*\n" +
    "• 💰 /deposit - Deposit USDC to your account\n" +
    "• 💵 /balance - Check wallet balances\n" +
    "• 📤 /send - Send USDC to a wallet\n" +
    "• 📧 /sendemail - Send USDC via email\n" +
    "• 📤 /sendbatch - Send USDC to multiple payees\n" +
    "• 🏦 /withdraw - Withdraw USDC to your bank account\n" +
    "• 📜 /history - View recent transactions\n" +
    "• ➕ /addpayee - Add a new payee\n\n" +
    "*Rewards:*\n" +
    "• 💎 /points - View your Copperx Mint points\n\n" +
    "*Support:* https://t.me/copperxcommunity/2183";

  const keyboardButtons = isLoggedIn
    ? [
        [
          Markup.button.callback("👤 Profile", "view_profile"),
          Markup.button.callback("💵 Balance", "view_balance"),
        ],
        [
          Markup.button.callback("📥 Deposit", "deposit"),
          Markup.button.callback("💸 Send Money", "send_money_menu"),
        ],
        [
          Markup.button.callback("📤 Batch Send", "send_batch"),
          Markup.button.callback("🏦 Withdraw to Bank", "start_withdraw"),
        ],
        [
          Markup.button.callback("➕ Add Payee", "start_addpayee"),
          Markup.button.callback("📜 History", "view_history"),
        ],
        [
          Markup.button.callback("💎 View Points", "view_points"),
        ],
      ]
    : [[Markup.button.callback("🔑 Log In", "start_login")]];

  await ctx.replyWithMarkdown(
    helpMessage,
    Markup.inlineKeyboard(keyboardButtons)
  );
}

// Login flow
export async function handleStartLogin(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) {
    await ctx.reply("Error: Could not identify your chat session.");
    return;
  }

  if (sessionManager.isLoggedIn(chatId)) {
    await ctx.reply(
      "You're already logged in! Use /profile to view your account or /logout to sign out."
    );
    return;
  }

  sessionManager.setSession(chatId, { loginState: "waiting_for_email" });

  await ctx.reply(
    "📧 Please enter your email address to receive a one-time password (OTP):",
    Markup.forceReply().selective()
  );
}

// Handle email input
export async function handleEmailInput(
  ctx: Context,
  email: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) {
    await ctx.reply("Error: Could not identify your chat session.");
    return;
  }

  const session = sessionManager.getSession(chatId);

  if (!session || session.loginState !== "waiting_for_email") {
    return;
  }

  if (!email.includes("@") || !email.includes(".")) {
    await ctx.reply(
      "⚠️ That doesn't look like a valid email address. Please try again:"
    );
    return;
  }

  try {
    await ctx.reply(`🔄 Requesting OTP for ${email}...`);

    const { sid } = await requestOtp(email);

    sessionManager.setSession(chatId, {
      email,
      sid,
      loginState: "waiting_for_otp",
      otpRequestedAt: new Date(),
    });

    await ctx.reply(
      `✅ OTP sent to ${email}!\n\n` +
        "📱 Please enter the 6-digit code you received:",
      Markup.forceReply().selective()
    );
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`❌ Error: ${err.message}`);

    // Reset login state
    sessionManager.setSession(chatId, { loginState: "waiting_for_email" });

    await ctx.reply(
      "Would you like to try again?",
      Markup.inlineKeyboard([
        Markup.button.callback("🔄 Try Again", "start_login"),
        Markup.button.callback("❌ Cancel", "cancel_login"),
      ])
    );
  }
}

// Handle OTP input
export async function handleOtpInput(ctx: Context, otp: string): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);

  if (
    !session ||
    session.loginState !== "waiting_for_otp" ||
    !session.email ||
    !session.sid
  ) {
    return;
  }

  if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
    await ctx.reply("⚠️ Please enter a valid 6-digit OTP code:");
    return;
  }

  try {
    await ctx.reply("🔄 Verifying your OTP...");

    const { accessToken, expireAt, user } = await authenticateOtp(
      session.email,
      otp,
      session.sid
    );

    // Fetch profile to get organizationId
    const profile = await getProfile(accessToken);
    const organizationId =
      profile.organizationId || "180ad9b1-3d7b-49cc-a901-f8a9b7727800"; // Fallback from your getWallets response

    sessionManager.setSession(chatId, {
      accessToken,
      expireAt,
      loginState: "logged_in",
      organizationId,
    });

    // Initialize Pusher client after login
    initializePusherClient(chatId);

    // Then show the main menu (copied from handleStart)
    await ctx.replyWithHTML(
      `🎉 <b>Login successful!</b>\n\n🚀 Welcome to CopperX Bot, ${user.email}!\n\nI'm here to help you manage your CopperX account. Choose an option below:`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("👤 Profile", "view_profile"),
          Markup.button.callback("📋 KYC Status", "view_kyc"),
        ],
        [
          Markup.button.callback("🎒 Wallets", "view_wallets"),
          Markup.button.callback("💰 Balance", "view_balance"),
        ],
        [
          Markup.button.callback("📤 Send Money", "send_money_menu"),
          Markup.button.callback("📥 Deposit", "deposit"),
        ],
        [
          Markup.button.callback("⚙️ Set Default Wallet", "set_default_wallet"),
          Markup.button.callback("➕ Add Payee", "start_addpayee"),
        ],
        [
          Markup.button.callback("📱 Batch Payment", "send_batch"),
          Markup.button.callback("📜 Transactions", "view_history"),
        ],
        [
          Markup.button.callback("💎 View Points", "view_points"),
          Markup.button.callback("🔒 Logout", "logout"),
        ],
      ])
    );
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`❌ Error: ${err.message}`);
    await ctx.reply(
      "Would you like to try again?",
      Markup.inlineKeyboard([
        Markup.button.callback("🔄 Try New OTP", "request_new_otp"),
        Markup.button.callback("📧 Change Email", "start_login"),
        Markup.button.callback("❌ Cancel", "cancel_login"),
      ])
    );
  }
}

// Logout command
export async function handleLogout(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  if (!sessionManager.isLoggedIn(chatId)) {
    await ctx.reply(
      "You're not currently logged in. Use /login to sign in to your account."
    );
    return;
  }

  sessionManager.deleteSession(chatId);

  await ctx.reply(
    "👋 You've been successfully logged out of your Copperx account.",
    Markup.inlineKeyboard([
      Markup.button.callback("🔑 Log In Again", "start_login"),
    ])
  );
}

// Profile command
export async function handleProfile(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);

  if (!session || !sessionManager.isLoggedIn(chatId)) {
    await ctx.reply(
      "⚠️ You need to be logged in to view your profile.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
    return;
  }

  try {
    await ctx.reply("🔄 Fetching your profile...");

    const profile = await getProfile(session.accessToken!);

    // Format the name
    const name =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      "Not set";

    const statusEmoji = profile.status === "active" ? "🟢" : "🔴";

    await ctx.replyWithHTML(
      `👤 <b>Your CopperX Profile</b>\n\n` +
        `<b>Personal Details</b>\n` +
        `📧 Email: ${profile.email}\n` +
        `🆔 User ID: <code><a href="https://example.com/address/${profile.id}">${profile.id}</a></code>\n` +
        `👤 Name: ${name}\n\n` +
        `📑 <b>KYC Status</b>: ${statusEmoji} ${profile.status}\n\n` +
        `Use /kyc to check detailed KYC status\n` +
        `Use /wallets to manage your wallets`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("📋 Check KYC Status", "view_kyc"),
          Markup.button.callback("🎒 Manage Wallets", "view_wallets"),
        ],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

export async function handlePoints(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    if (!session.email) {
      await ctx.reply(
        "⚠️ Email not found in session. Please log in again.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔑 Log In", "start_login")],
        ])
      );
      return;
    }

    try {
      await ctx.reply("🔄 Fetching your Copperx Mint points...");
      const pointsResponse = await getTotalPoints(
        session.email,
        session.accessToken!
      );

      const tweetText = encodeURIComponent(
        `I have earned ${pointsResponse.total} points on Copperx Mint! 🚀 Join me and start earning too! #CopperxMint #CryptoPayments`
      );
      const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

      await ctx.replyWithMarkdown(
        `💎 *Your Copperx Mint Points*\n\n` +
          `Email: \`${session.email}\`\n` +
          `Total Points: 🟡*${pointsResponse.total}*\n\n` +
          `Share your achievement on X (Twitter)!`,
        Markup.inlineKeyboard([
          [Markup.button.url("📢 Share on X", tweetUrl)],
          [Markup.button.callback("<< Back to Menu", "back_to_menu")],
        ])
      );
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("401")) {
        sessionManager.deleteSession(chatId);
        await ctx.reply(
          "⚠️ Session expired. Please log in again.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔑 Log In", "start_login")],
          ])
        );
        return;
      }
      await ctx.replyWithMarkdown(
        `❌ *Error*: ${err.message}\n\nPlease try again or contact support.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🔄 Try Again", "view_points")],
          [Markup.button.callback("<< Back to Menu", "back_to_menu")],
        ])
      );
    }
  });
}

export async function handleWallets(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("🔄 Fetching your wallets...");

      const wallets = await getWallets(session.accessToken!);
      if (!wallets || wallets.length === 0) {
        await ctx.reply(
          "⚠️ No wallets found. Contact support to set up your account."
        );
        return;
      }

      const walletMessages = wallets.map((wallet) => {
        const networkName = NETWORK_NAMES[wallet.network] || wallet.network;
        const isDefault = wallet.isDefault
          ? "✅ <b>Default Wallet</b> "
          : "👛 <b>Wallet</b> ";
        return `${isDefault}<i>(${networkName})</i>\n<code><a href="https://example.com/address/${wallet.walletAddress}">${wallet.walletAddress}</a></code>`;
      });

      await ctx.replyWithHTML(
        `💳 <b>Your Wallets</b>\n\n${walletMessages.join(
          "\n\n"
        )}\n\nUse /setdefault to change your default wallet.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback("⚙️ Set Default", "set_default_wallet"),
            Markup.button.callback("💰 View Balances", "view_balance"),
          ],
          [Markup.button.callback("<< Back to Menu", "back_to_menu")],
        ])
      );
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("401")) {
        sessionManager.deleteSession(chatId);
        await ctx.reply(
          "⚠️ Session expired. Please log in again.",
          Markup.inlineKeyboard([
            Markup.button.callback("🔑 Log In", "start_login"),
          ])
        );
        return;
      }
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });
}

// KYC Status command
export async function handleKycStatus(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);

  if (!session || !sessionManager.isLoggedIn(chatId)) {
    await ctx.reply(
      "⚠️ You need to be logged in to check your KYC status.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
    return;
  }

  try {
    await ctx.reply("🔄 Checking your KYC status...");

    const kycData = await getKycStatus(session.accessToken!);

    if (kycData.count === 0) {
      await ctx.replyWithHTML(
        "📋 <b>KYC Verification Status</b>\n\n" +
          "<b>Current Status</b>: ⏳ PENDING\n" +
          "You need to complete your KYC verification on the Copperx platform to unlock all features of your account.",
        Markup.inlineKeyboard([
          Markup.button.url("🔒 Complete KYC", "https://copperx.io"),
          Markup.button.callback("<< Back to Menu", "back_to_menu"),
        ])
      );
      return;
    }

    const kyc = kycData.data[0]; // Get the latest KYC record
    const statusEmoji =
      kyc.status === "approved"
        ? "✅"
        : kyc.status === "rejected"
        ? "❌"
        : "⏳";
    const statusMessage =
      kyc.status === "approved"
        ? "✅ Your account is fully verified!"
        : "Please complete your verification.";

    // Format the date
    const kycDate = new Date(kyc.createdAt || Date.now());
    const dateStr = kycDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const timeStr = kycDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    await ctx.replyWithHTML(
      `📋 <b>KYC Verification Status</b>\n\n` +
        `<b>Current Status</b>: ${statusEmoji} ${kyc.status.toUpperCase()}\n` +
        `${statusMessage}\n\n` +
        `<b>Verification Details</b>\n` +
        `🗓️ Approved Date: ${dateStr} at ${timeStr}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("👤 View Profile", "view_profile")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

export async function handleDepositNetworkSelection(
  ctx: Context,
  network: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session || !session.accessToken) {
    await ctx.reply(
      "⚠️ You need to be logged in to view deposit addresses.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
    return;
  }

  try {
    await ctx.reply("🔄 Fetching your wallet address...");

    const wallets = await getWallets(session.accessToken!);
    const selectedWallet = wallets.find((w) => w.network === network);

    if (!selectedWallet) {
      await ctx.reply(
        `⚠️ No wallet found for ${NETWORK_NAMES[network] || network}.`
      );
      return;
    }

    const networkName =
      NETWORK_NAMES[selectedWallet.network] || selectedWallet.network;
    const walletAddress = selectedWallet.walletAddress;

    await ctx.replyWithHTML(
      `💎 <b>Deposit Instructions</b>\n\n` +
        `To deposit funds to your wallet:\n\n` +
        `1. Send your funds to this address:\n<code><a href="https://example.com/address/${walletAddress}">${walletAddress}</a></code>\n\n` +
        `2. Make sure to select the correct network:\n<b>${networkName}</b>\n\n` +
        `⚠️ <b>Important</b>:\n` +
        `• Only send supported tokens\n` +
        `• Double-check the network before sending\n` +
        `• Minimum deposit amount may apply\n\n` +
        `Use /history to check your recent Transaction History.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    if (err.message.includes("401")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Session expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

export async function handleDeposit(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("🔄 Fetching your deposit options...");

      const wallets = await getWallets(session.accessToken!);
      if (!wallets || wallets.length === 0) {
        await ctx.reply(
          "⚠️ No wallets found. Please contact support to set up your account."
        );
        return;
      }

      const networkButtons = wallets.map((wallet) => {
        const networkName = NETWORK_NAMES[wallet.network] || wallet.network;
        const isDefault = wallet.isDefault ? " (Default)" : "";
        return [
          Markup.button.callback(
            `${networkName}${isDefault}`,
            `deposit_network_${wallet.network}`
          ),
        ];
      });

      await ctx.replyWithHTML(
        `📥 <b>Deposit</b>\n\nSelect a network to view your deposit address:`,
        Markup.inlineKeyboard([
          ...networkButtons,
          [Markup.button.callback("<< Back to Menu", "back_to_menu")],
        ])
      );
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("401")) {
        sessionManager.deleteSession(chatId);
        await ctx.reply(
          "⚠️ Session expired. Please log in again.",
          Markup.inlineKeyboard([
            Markup.button.callback("🔑 Log In", "start_login"),
          ])
        );
        return;
      }
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });
}

export async function handleBalance(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      // First send the fetching message
      await ctx.reply("🔄 Fetching your wallets...");

      const wallets = await getWallets(session.accessToken!);
      const balances: BalanceResponse = await getBalances(session.accessToken!);

      if (!balances || balances.length === 0) {
        await ctx.reply(
          "⚠️ No wallets found. Contact support to set up your account."
        );
        return;
      }

      const walletMap = new Map(wallets.map((w) => [w.id, w]));

      // Build the response message with HTML formatting for bold text
      let message = "💰 <b>Your Wallet Balances</b>\n\n";

      // Sort balances to put default wallet first
      const sortedBalances = [...balances].sort(
        (a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)
      );

      for (const wallet of sortedBalances) {
        const walletInfo = walletMap.get(wallet.walletId)!;
        const networkName = NETWORK_NAMES[wallet.network] || wallet.network;

        if (wallet.isDefault) {
          message += `✅ <b>Default Wallet</b> <i>(${networkName})</i>\n`;
        } else {
          message += `👛 <b>Wallet</b> <i>(${networkName})</i>\n`;
        }

        for (const balance of wallet.balances) {
          message += `• <b>${balance.symbol}</b>: ${parseFloat(
            balance.balance
          ).toFixed(2)}\n`;
        }

        // Make address blue and formatted as code for easy copying
        message += `<code><a href="https://example.com/address/${walletInfo.walletAddress}">${walletInfo.walletAddress}</a></code>\n`;

        message += "\n";
      }

      message +=
        "Use /deposit to add funds or /setdefault to change your default wallet.";

      // Use HTML parse mode for formatting
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📥 Deposit", callback_data: "deposit" },
              { text: "⚙️ Set Default", callback_data: "set_default_wallet" },
            ],
            [{ text: "« Back to Menu", callback_data: "back_to_menu" }],
          ],
        },
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("401")) {
        sessionManager.deleteSession(chatId);
        await ctx.reply("⚠️ Session expired. Please log in again.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Log In", callback_data: "start_login" }],
            ],
          },
        });
        return;
      }
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });
}

export async function handleSetDefaultWallet(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("🔄 Fetching your wallets...");

      const wallets = await getWallets(session.accessToken!);
      if (!wallets || wallets.length === 0) {
        await ctx.reply(
          "No wallets found. Contact support to set up your account."
        );
        return;
      }

      const walletButtons = wallets.map((wallet) => [
        Markup.button.callback(
          `${NETWORK_NAMES[wallet.network] || wallet.network}${
            wallet.isDefault ? " ✅" : ""
          }`,
          `set_default_wallet_${wallet.id}`
        ),
      ]);

      await ctx.replyWithHTML(
        `🗃️ <b>Set Default Wallet</b>\n\nChoose a wallet to set as default:`,
        Markup.inlineKeyboard([
          ...walletButtons,
          [Markup.button.callback("<< Back to Menu", "back_to_menu")],
        ])
      );
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("401")) {
        sessionManager.deleteSession(chatId);
        await ctx.reply(
          "⚠️ Session expired. Please log in again.",
          Markup.inlineKeyboard([
            Markup.button.callback("🔑 Log In", "start_login"),
          ])
        );
        return;
      }
      await ctx.reply(
        `❌ Error: ${err.message}`,
        Markup.inlineKeyboard([
          Markup.button.callback("<< Back to Menu", "back_to_menu"),
        ])
      );
    }
  });
}

export async function handleSetDefaultWalletSelection(
  ctx: Context,
  walletId: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session || !session.accessToken) return;

  try {
    await ctx.reply("🔄 Setting default wallet...");

    // Set the default wallet
    const updatedWallet = await setDefaultWallet(session.accessToken, walletId);

    const networkName =
      NETWORK_NAMES[updatedWallet.network] || updatedWallet.network;
    await ctx.replyWithMarkdown(
      `✅ *Default Wallet Updated!*\n\n` +
        `New default wallet: *${networkName}*\n` +
        `Address: \`${updatedWallet.walletAddress}\``,
      Markup.inlineKeyboard([
        [Markup.button.callback("💵 Check Balances", "view_balance")],
        [
          Markup.button.callback(
            "🏦 Set Another Default",
            "set_default_wallet"
          ),
        ],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    if (err.message.includes("401")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Session expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }
    await ctx.reply(
      `❌ Error: ${err.message}`,
      Markup.inlineKeyboard([
        Markup.button.callback("<< Back to Menu", "back_to_menu"),
      ])
    );
  }
}

export async function handleSendMoneyMenu(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      // Just send the send money menu without fetching or displaying balances
      await ctx.replyWithHTML(
        `📤 <b>Send Money</b>\n\n👇 Choose how you'd like to send funds:`,
        Markup.inlineKeyboard([
          [Markup.button.callback("📧 Send to Email", "start_sendemail")],
          [Markup.button.callback("💸 Send to Wallet", "start_send")],
          [Markup.button.callback("🏦 Bank Withdraw", "start_withdraw")],
          [Markup.button.callback("« Back to Menu", "back_to_menu")],
        ])
      );
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("401")) {
        sessionManager.deleteSession(chatId);
        await ctx.reply(
          "⚠️ Session expired. Please log in again.",
          Markup.inlineKeyboard([
            Markup.button.callback("🔑 Log In", "start_login"),
          ])
        );
        return;
      }
      await ctx.reply(
        `❌ Error: ${err.message}`,
        Markup.inlineKeyboard([
          Markup.button.callback("<< Back to Menu", "back_to_menu"),
        ])
      );
    }
  });
}

export async function handleStartSend(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    session.lastAction = "send"; // Start send flow
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      "📤 *Send USDC*\n\nPlease enter the wallet address to send funds to:",
      Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", "cancel_action")],
      ])
    );
  });
}

export async function handleSendAddress(
  ctx: Context,
  walletAddress: string
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    await ctx.reply(
      "❌ Invalid wallet address. Please enter a valid Ethereum address (e.g., 0x...)."
    );
    return;
  }

  session.lastAction = `send_to_${walletAddress}`;
  sessionManager.setSession(chatId, session);

  await ctx.replyWithMarkdown(
    `📤 *Send USDC*\n\nWallet address: \`${walletAddress}\`\n\nPlease enter the amount in USDC:`,
    Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

export async function handleSendAmount(
  ctx: Context,
  amountStr: string
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  const amount = parseFloat(amountStr.trim());
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply(
      "❌ Invalid amount. Please enter a positive number (e.g., 5)."
    );
    return;
  }

  const walletAddress = session.lastAction!.split("_to_")[1];
  session.lastAction = `send_to_${walletAddress}_amount_${amount}`;
  sessionManager.setSession(chatId, session);

  await ctx.replyWithMarkdown(
    `📤 *Confirm Send*\n\n` +
      `To: \`${walletAddress}\`\n` +
      `Amount: *${amount.toFixed(2)} USDC*\n\n` +
      `Press "Confirm" to send the funds.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✅ Confirm",
          `confirm_send_${walletAddress}_${amount}`
        ),
      ],
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

export async function handleSendConfirmation(
  ctx: Context,
  walletAddress: string,
  amount: number
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId);

  if (!session || !session.accessToken) return;

  try {
    await ctx.reply("🔄 Sending funds...");

    const withdrawData = {
      walletAddress,
      amount: (amount * 1e8).toString(), // 10^8 scale: 5 USDC = 500000000
      purposeCode: "self",
      currency: "USDC",
    };

    const result = await withdrawToWallet(session.accessToken, withdrawData);

    session.lastAction = undefined; // Clear state
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      `✅ *Funds Sent!*\n\n` +
        `To: \`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\`\n` +
        `Amount: *${amount.toFixed(2)} USDC*\n` +
        `Transaction ID: \`${result.id}\`\n` +
        `Status: ${result.status}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("💵 Check Balance", "view_balance")],
        [Markup.button.callback("📜 History", "view_history")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    session.lastAction = undefined; // Clear state on error
    sessionManager.setSession(chatId, session);

    if (err.message.includes("401")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Session expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }
    await ctx.reply(
      `❌ Error: ${err.message}`,
      Markup.inlineKeyboard([
        Markup.button.callback("<< Back to Menu", "back_to_menu"),
      ])
    );
  }
}

// Update handleCancelAction to clear send state
export async function handleCancelAction(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId);
  if (session) {
    if (session.batchPaymentState) {
      session.batchPaymentState.step = "start";
      session.batchPaymentState.payees = [];
      sessionManager.setSession(chatId, session);
    }
    session.lastAction = undefined;
  }
  await ctx.reply("Action cancelled.");
  await handleStart(ctx);
}

export async function handleStartAddPayee(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    session.lastAction = "addpayee";
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      "➕ *Add Payee*\n\nPlease enter the payee's email address:",
      Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", "cancel_action")],
      ])
    );
  });
}

export async function handlePayeeEmail(
  ctx: Context,
  email: string
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  if (!email.includes("@") || !email.includes(".")) {
    await ctx.reply(
      "❌ Invalid email address. Please enter a valid email (e.g., user@example.com)."
    );
    return;
  }

  session.lastAction = `addpayee_email_${email}`;
  sessionManager.setSession(chatId, session);

  await ctx.replyWithMarkdown(
    `➕ *Add Payee*\n\nEmail: \`${email}\`\n\nPlease enter the payee's nickname:`,
    Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

export async function handlePayeeNickname(
  ctx: Context,
  nickName: string
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  const email = session.lastAction!.split("_email_")[1];

  try {
    await ctx.reply("🔄 Adding payee...");

    const payeeData = {
      nickName,
      email,
    };

    const result = await createPayee(session.accessToken!, payeeData);

    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      `✅ *Payee Added!*\n\n` +
        `Name: \`${result.nickName}\`\n` +
        `Email: \`${result.email}\`\n` +
        `ID: \`${result.id}\``,
      Markup.inlineKeyboard([
        [Markup.button.callback("📤 Send USDC", "send_money_menu")],
        [Markup.button.callback("➕ Add Another Payee", "start_addpayee")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);

    if (err.message.includes("401")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Session expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }
    await ctx.reply(
      `❌ Error: ${err.message}`,
      Markup.inlineKeyboard([
        Markup.button.callback("<< Back to Menu", "back_to_menu"),
      ])
    );
  }
}

export async function handleStartSendEmail(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("🔄 Fetching your payees...");
      const payees = await getPayees(session.accessToken!);

      if (payees.count === 0) {
        session.lastAction = undefined;
        sessionManager.setSession(chatId, session);
        await ctx.replyWithMarkdown(
          "📭 *No Payees Found*\n\nYou need to add a payee before sending USDC via email. Use /addpayee to add one now.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "➕ Add Payee", callback_data: "start_addpayee" }],
              ],
            },
          }
        );
        return;
      }

      const payeeButtons = payees.data.map((payee) => ({
        text: `${payee.displayName} (${payee.email})`,
        callback_data: `sendemail_to_${payee.email}`,
      }));

      session.lastAction = "sendemail";
      sessionManager.setSession(chatId, session);

      await ctx.replyWithMarkdown(
        "📤 *Send USDC via Email*\n\nChoose a payee to send USDC to:",
        Markup.inlineKeyboard([
          ...payeeButtons.map((btn) => [btn]),
          [
            Markup.button.callback("➕ Add New Payee", "add_new_payee"),
            Markup.button.callback("❌ Cancel", "cancel_action"),
          ],
        ])
      );
    } catch (error) {
      const err = error as Error;
      session.lastAction = undefined;
      sessionManager.setSession(chatId, session);
      await ctx.reply(
        `❌ Error: ${err.message}`,
        Markup.inlineKeyboard([
          Markup.button.callback("<< Back to Menu", "back_to_menu"),
        ])
      );
    }
  });
}

export async function handleSendEmailPayee(
  ctx: Context,
  email: string
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  session.lastAction = `sendemail_to_${email}`;
  sessionManager.setSession(chatId, session);

  await ctx.replyWithMarkdown(
    `📤 *Send USDC via Email*\n\nEmail: \`${email}\`\n\nPlease enter the amount in USDC:`,
    Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

export async function handleSendEmailAmount(
  ctx: Context,
  amountStr: string
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  const amount = parseFloat(amountStr.trim());
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply(
      "❌ Invalid amount. Please enter a positive number (e.g., 5)."
    );
    return;
  }

  const email = session.lastAction!.split("_to_")[1];
  session.lastAction = `sendemail_to_${email}_amount_${amount}`;
  sessionManager.setSession(chatId, session);

  await ctx.replyWithMarkdown(
    `📤 *Confirm Send via Email*\n\n` +
      `To: \`${email}\`\n` +
      `Amount: *${amount.toFixed(2)} USDC*\n\n` +
      `Press "Confirm" to send the funds.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✅ Confirm",
          `confirm_sendemail_${email}_${amount}`
        ),
      ],
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

export async function handleSendEmailConfirmation(
  ctx: Context,
  email: string,
  amount: number
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId);

  if (!session || !session.accessToken) return;

  try {
    await ctx.reply("🔄 Sending funds...");

    const sendData = {
      email,
      amount: (amount * 1e8).toString(), // 10^8 scale
      purposeCode: "self",
      currency: "USDC",
    };

    const result = await sendToUser(session.accessToken, sendData);

    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      `✅ *Funds Sent!*\n\n` +
        `To: \`${email}\`\n` +
        `Amount: *${amount.toFixed(2)} USDC*\n` +
        `Transaction ID: \`${result.id}\`\n` +
        `Status: ${result.status}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("💵 Check Balance", "view_balance")],
        [Markup.button.callback("📜 History", "view_history")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);

    if (err.message.includes("401")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Session expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }
    await ctx.reply(
      `❌ Error: ${err.message}`,
      Markup.inlineKeyboard([
        Markup.button.callback("<< Back to Menu", "back_to_menu"),
      ])
    );
  }
}

export async function handleStartWithdraw(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("🔄 Fetching your balance...");
      const balance = await getWalletBalance(session.accessToken!);
      const usdcBalance = parseInt(balance.balance);

      session.lastAction = "withdraw";
      sessionManager.setSession(chatId, session);

      await ctx.replyWithMarkdown(
        `🏦 *Withdraw USDC to Bank*\n\nYour balance: *${usdcBalance.toFixed(
          2
        )} USDC*\n\nPlease enter the amount in USDC to withdraw:`,
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "cancel_action")],
        ])
      );
    } catch (error) {
      const err = error as Error;
      await ctx.reply(
        `❌ Error: ${err.message}`,
        Markup.inlineKeyboard([
          Markup.button.callback("<< Back to Menu", "back_to_menu"),
        ])
      );
    }
  });
}

export async function handleWithdrawAmount(
  ctx: Context,
  amountStr: string
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  const amount = parseFloat(amountStr.trim());
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply(
      "❌ Invalid amount. Please enter a positive number (e.g., 5)."
    );
    return;
  }

  try {
    const balance = await getWalletBalance(session.accessToken!);
    const usdcBalance = parseInt(balance.balance); // No division by decimals
    if (amount > usdcBalance) {
      await ctx.reply(
        `❌ Insufficient balance. You have ${usdcBalance.toFixed(2)} USDC.`,
        Markup.inlineKeyboard([
          Markup.button.callback("<< Back to Menu", "back_to_menu"),
        ])
      );
      return;
    }

    await ctx.reply("🔄 Fetching your bank accounts...");
    const accounts = await getAccounts(session.accessToken!);
    const bankAccounts = accounts.data.filter(
      (acc) => acc.type === "bank_account" && acc.status === "verified"
    );

    if (bankAccounts.length === 0) {
      session.lastAction = undefined;
      sessionManager.setSession(chatId, session);
      await ctx.replyWithMarkdown(
        "🏦 *No Bank Accounts Found*\n\nYou need to add a bank account in Copperx to withdraw. Visit the app to add one.",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "cancel_action")],
        ])
      );
      return;
    }

    const bankButtons = bankAccounts.map((acc) => ({
      text: `${
        acc.bankAccount!.bankName
      } (****${acc.bankAccount!.bankAccountNumber.slice(-4)})`,
      callback_data: `withdraw_bank_${acc.id}_${amount}`,
    }));

    session.lastAction = "withdraw_selectbank";
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      `🏦 *Select Bank Account*\n\nAmount: *${amount.toFixed(
        2
      )} USDC*\nChoose a bank account:`,
      Markup.inlineKeyboard(bankButtons.map((btn) => [btn]))
    );
  } catch (error) {
    const err = error as Error;
    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);
    await ctx.reply(
      `❌ Error: ${err.message}`,
      Markup.inlineKeyboard([
        Markup.button.callback("<< Back to Menu", "back_to_menu"),
      ])
    );
  }
}

export async function handleWithdrawSelectBank(
  ctx: Context,
  bankAccountId: string,
  amount: number
): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  console.log(
    "handleWithdrawSelectBank called with bankAccountId:",
    bankAccountId,
    "amount:",
    amount
  );

  try {
    await ctx.reply("🔄 Fetching withdrawal quote...");

    const accounts = await getAccounts(session.accessToken!);
    const bankAccount = accounts.data.find((acc) => acc.id === bankAccountId);
    if (!bankAccount || bankAccount.type !== "bank_account") {
      console.log(
        "Bank account not found or invalid:",
        bankAccountId,
        accounts.data
      );
      throw new Error("Invalid bank account selected.");
    }

    const quoteData = {
      amount: (amount * 1e8).toString(),
      currency: "USDC",
      destinationCountry: bankAccount.country,
      onlyRemittance: true,
      preferredBankAccountId: bankAccountId,
      sourceCountry: "none",
    };

    const quote = await getOfframpQuote(session.accessToken!, quoteData);

    const quotePayload = JSON.parse(quote.quotePayload);
    const usdcAmount = parseInt(quotePayload.amount) / 1e8;
    const inrAmount = parseInt(quotePayload.toAmount) / 1e8;
    const fee = parseInt(quotePayload.totalFee) / 1e8;
    const exchangeRate = parseFloat(quotePayload.rate);

    // Store the full quote in session
    session.withdrawQuote = {
      signature: quote.quoteSignature,
      bankAccountId: bankAccountId,
      amount: amount,
      payload: quote.quotePayload, // Store payload too
    };
    session.lastAction = "withdraw_quote";
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      `🏦 *Withdrawal Details*\n\n` +
        `Withdraw: *${usdcAmount.toFixed(2)} USDC*\n` +
        `You’ll receive: *₹${inrAmount.toFixed(2)} INR*\n` +
        `Exchange rate: 1 USDC ≈ ₹${exchangeRate.toFixed(2)}\n` +
        `Fee: $${fee.toFixed(2)} USDC\n` +
        `Arrival: ${quote.arrivalTimeMessage}\n` +
        `Bank: ${
          bankAccount.bankAccount!.bankName
        } (****${bankAccount.bankAccount!.bankAccountNumber.slice(-4)})\n\n` +
        `Press "Confirm" to proceed.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Confirm", "confirm_withdraw")],
        [Markup.button.callback("❌ Cancel", "cancel_action")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);
    await ctx.reply(
      `❌ Error: ${err.message}`,
      Markup.inlineKeyboard([
        Markup.button.callback("<< Back to Menu", "back_to_menu"),
      ])
    );
  }
}

export async function handleWithdrawConfirmation(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId)!;

  if (!session.withdrawQuote) {
    await ctx.reply("❌ No withdrawal quote found. Please start over.");
    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);
    return;
  }

  const {
    signature: quoteSignature,
    bankAccountId,
    amount,
    payload: quotePayload,
  } = session.withdrawQuote;

  try {
    await ctx.reply("🔄 Processing withdrawal...");

    const accounts = await getAccounts(session.accessToken!);
    const bankAccount = accounts.data.find((acc) => acc.id === bankAccountId);
    if (!bankAccount) throw new Error("Bank account not found.");

    const transferData = {
      purposeCode: "self",
      quotePayload: quotePayload, // Use stored payload
      quoteSignature: quoteSignature, // Use stored signature
    };

    const result = await createOfframpTransfer(
      session.accessToken!,
      transferData
    );

    session.lastAction = undefined;
    delete session.withdrawQuote; // Clean up
    sessionManager.setSession(chatId, session);

    const usdcAmount = parseInt(result.amount) / 1e8;
    const inrAmount = parseInt(JSON.parse(quotePayload).toAmount) / 1e8;

    await ctx.replyWithMarkdown(
      `✅ *Withdrawal Initiated!*\n\n` +
        `Amount: *${usdcAmount.toFixed(2)} USDC*\n` +
        `To receive: *₹${inrAmount.toFixed(2)} INR*\n` +
        `Transaction ID: \`${result.id}\`\n` +
        `Status: ${result.status}\n` +
        `Bank: ${
          bankAccount.bankAccount!.bankName
        } (****${bankAccount.bankAccount!.bankAccountNumber.slice(-4)})\n` +
        `Check status: [Payment Link](${result.paymentUrl})`,
      Markup.inlineKeyboard([
        [Markup.button.callback("💵 Check Balance", "view_balance")],
        [Markup.button.callback("📜 History", "view_history")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    session.lastAction = undefined;
    delete session.withdrawQuote; // Clean up
    sessionManager.setSession(chatId, session);

    if (err.message.includes("401")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Session expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }
    await ctx.reply(
      `❌ Error: ${err.message}`,
      Markup.inlineKeyboard([
        Markup.button.callback("<< Back to Menu", "back_to_menu"),
      ])
    );
  }
}

export async function handleTransactionHistory(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("💼 Fetching your transaction history...");

      const history = await getTransactionHistory(session.accessToken!, 1, 10); // Last 10 transactions

      if (!history.data || history.data.length === 0) {
        await ctx.reply(
          "✨ No transactions found. Start by sending or receiving USDC.",
          Markup.inlineKeyboard([
            Markup.button.callback("💵 Check Balance", "view_balance"),
            Markup.button.callback("📤 Send USDC", "send_money_menu"),
          ])
        );
        return;
      }

      // Format transactions to match the specified style
      const transactionsMessage = history.data
        .map((tx) => {
          // Use the first transaction in the transactions array for status and amounts
          const transaction = tx.transactions[0] || {};
          const txDate = new Date(tx.createdAt);
          const dateStr = txDate.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric",
          });
          const timeStr = txDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });

          // Format the amount (divide by 1e8 for USDC scaling)
          const amount = (
            parseFloat(transaction.fromAmount || tx.amount) / 1e8
          ).toFixed(2);
          const currency = transaction.fromCurrency || tx.currency;

          // Determine transaction type and emoji
          let txType = tx.type.toUpperCase();
          let txEmoji = "";
          let amountSign = "";

          switch (tx.type.toLowerCase()) {
            case "send":
              txEmoji = "➤";
              amountSign = "-";
              txType = "SEND";
              break;
            case "withdraw":
              txEmoji = "📤";
              amountSign = "-";
              txType = tx.mode === "off_ramp" ? "OFF-RAMP" : "WITHDRAW";
              break;
            case "deposit":
              txEmoji = "📥";
              amountSign = "+";
              txType = "DEPOSIT";
              break;
            case "receive":
              txEmoji = "📥";
              amountSign = "+";
              txType = "RECEIVE";
              break;
            default:
              txEmoji = "📤"; // Fallback for unknown types
          }

          // Determine recipient details
          let recipientDetails = "";
          if (tx.mode === "off_ramp" && tx.destinationAccount.bankName) {
            recipientDetails = `To: ${tx.destinationAccount.bankName}`;
          } else {
            const toAddress = tx.destinationAccount.walletAddress
              ? `${tx.destinationAccount.walletAddress.slice(
                  0,
                  6
                )}...${tx.destinationAccount.walletAddress.slice(-5)}`
              : tx.destinationAccount.payeeEmail || "Unknown";
            recipientDetails = `To: <code><a href="https://example.com/address/${toAddress}">${toAddress}</a></code>`;
          }

          // Determine status emoji and text
          let statusEmoji = "";
          let statusText = transaction.status || tx.status || "unknown";
          switch (statusText.toLowerCase()) {
            case "success":
              statusEmoji = "✅";
              break;
            case "processing":
            case "pending":
              statusEmoji = "⌛";
              break;
            case "canceled":
              statusEmoji = "❌";
              break;
            default:
              statusEmoji = "ℹ️";
          }

          return (
            `${txEmoji} <b>${txType}</b>\n` +
            `Amount: ${amountSign}${amount} ${currency}\n` +
            `${recipientDetails}\n` +
            `Status: ${statusEmoji}\n` +
            `Date: ${dateStr} at ${timeStr}`
          );
        })
        .join("\n\n");

      const formattedMessage = `<b>📜 Recent Transactions</b>\n\n${transactionsMessage}`;

      try {
        await ctx.replyWithHTML(
          formattedMessage,
          Markup.inlineKeyboard([
            [
              Markup.button.callback("💵 Check Balance", "view_balance"),
              Markup.button.callback("📤 Send USDC", "send_money_menu"),
              Markup.button.callback("🔄 Refresh", "view_history"),
            ],
            [Markup.button.callback("<< Back to Menu", "back_to_menu")],
          ])
        );
      } catch (markdownError) {
        // Fallback to plain text if Markdown fails
        const plainTextMessage = formattedMessage
          .replace(/\*/g, "")
          .replace(/`/g, "");

        await ctx.reply(
          plainTextMessage,
          Markup.inlineKeyboard([
            [
              Markup.button.callback("💵 Check Balance", "view_balance"),
              Markup.button.callback("📤 Send USDC", "send_money_menu"),
              Markup.button.callback("🔄 Refresh", "view_history"),
            ],
            [Markup.button.callback("<< Back to Menu", "back_to_menu")],
          ])
        );
      }
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("401")) {
        sessionManager.deleteSession(chatId);
        await ctx.reply(
          "⚠️ Session expired. Please log in again.",
          Markup.inlineKeyboard([
            Markup.button.callback("🔑 Log In", "start_login"),
          ])
        );
        return;
      }
      await ctx.reply(
        `❌ Error: ${err.message}`,
        Markup.inlineKeyboard([
          Markup.button.callback("<< Back to Menu", "back_to_menu"),
        ])
      );
    }
  });
}

export async function handleSendBatch(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    // Initialize or reset batch payment state
    if (!session.batchPaymentState) {
      session.batchPaymentState = {
        payees: [],
        step: "start",
        availablePayees: [],
      };
      sessionManager.setSession(chatId, session);
    }

    const batchState = session.batchPaymentState!;

    switch (batchState.step) {
      case "start":
        await startBatchPayment(ctx, chatId, session);
        break;
      case "select_or_add_payee":
        const text = (ctx.message as any)?.text?.trim();
        if (text) {
          await handleAddNewPayee(ctx, chatId, session, text);
        } else {
          await showPayeeSelection(ctx, chatId, session);
        }
        break;
      case "add_amount":
        const amountText = (ctx.message as any)?.text?.trim();
        if (amountText) {
          await handleAddAmount(ctx, chatId, session, amountText);
        } else {
          await ctx.reply(
            "Please enter the amount in USDC (e.g., 1 for 1 USDC):",
            Markup.inlineKeyboard([
              [Markup.button.callback("❌ Cancel", "cancel_action")],
            ])
          );
        }
        break;
      case "confirm":
        await handleConfirmBatch(ctx, chatId, session);
        break;
    }
  });
}

async function startBatchPayment(
  ctx: Context,
  chatId: string,
  session: any
): Promise<void> {
  const batchState = session.batchPaymentState!;
  try {
    await ctx.reply("🔄 Fetching your payees...");
    const payees = await getPayees(session.accessToken!);
    batchState.availablePayees = payees.data;
    batchState.step = "select_or_add_payee";
    sessionManager.setSession(chatId, session);

    if (payees.count === 0) {
      await ctx.replyWithMarkdown(
        "📭 *No Payees Found*\n\nYou need to add a payee to proceed. Enter a new payee's email:",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "cancel_action")],
        ])
      );
    } else {
      await showPayeeSelection(ctx, chatId, session);
    }
  } catch (error) {
    const err = error as Error;
    await ctx.replyWithMarkdown(
      `❌ *Error*: ${err.message}\n\nPlease try again.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📤 Try Again", "send_batch")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  }
}

async function showPayeeSelection(
  ctx: Context,
  chatId: string,
  session: any,
  showConfirmButton: boolean = false // Add parameter to control Confirm button visibility
): Promise<void> {
  const batchState = session.batchPaymentState!;
  const payeeButtons = batchState.availablePayees.map((payee: any) => ({
    text: `${payee.displayName} (${payee.email})`,
    callback_data: `batch_payee_${payee.email}`,
  }));

  // Build the keyboard with payee buttons and additional options
  const keyboard = [
    ...payeeButtons.map((btn: any) => [btn]),
    [Markup.button.callback("➕ Add New Payee", "add_new_payee")],
  ];

  // Add Confirm Batch button if there are payees and showConfirmButton is true
  if (showConfirmButton && batchState.payees.length > 0) {
    keyboard.push([
      Markup.button.callback("✅ Confirm Batch", "confirm_batch"),
    ]);
  }

  // Always add Cancel button
  keyboard.push([Markup.button.callback("❌ Cancel", "cancel_action")]);

  await ctx.replyWithMarkdown(
    `📱 *Batch Payment*\n\n` +
      (batchState.payees.length > 0
        ? `Current payees: ${batchState.payees.length}\n` +
          batchState.payees
            .map(
              (payee: any) =>
                `- ${payee.email}: ${(parseInt(payee.amount) / 1e8).toFixed(
                  2
                )} USDC`
            )
            .join("\n") +
          "\n\n"
        : "") +
      "Choose a payee or enter a new email to add:",
    Markup.inlineKeyboard(keyboard)
  );
}

async function handleAddNewPayee(
  ctx: Context,
  chatId: string,
  session: any,
  text?: string
): Promise<void> {
  const batchState = session.batchPaymentState!;
  const email = text || (ctx.message as any)?.text?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await ctx.replyWithMarkdown(
      "⚠️ *Invalid Email*\n\nPlease enter a valid email address (e.g., user@example.com). Try again:",
      Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", "cancel_action")],
      ])
    );
    return;
  }

  batchState.currentEmail = email;
  batchState.step = "add_amount";
  sessionManager.setSession(chatId, session);

  await ctx.reply(
    `📧 Email set: ${email}\n\nPlease enter the amount in USDC (e.g., 1 for 1 USDC):`,
    Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

async function handleAddAmount(
  ctx: Context,
  chatId: string,
  session: any,
  text?: string
): Promise<void> {
  const batchState = session.batchPaymentState!;
  const amountText = text || (ctx.message as any)?.text?.trim();

  if (!amountText) {
    await ctx.reply(
      "Please enter the amount in USDC (e.g., 1 for 1 USDC):",
      Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", "cancel_action")],
      ])
    );
    return;
  }

  const amount = parseFloat(amountText);
  if (isNaN(amount) || amount <= 0) {
    await ctx.replyWithMarkdown(
      "⚠️ *Invalid Amount*\n\nPlease enter a positive number (e.g., 1). Try again:",
      Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", "cancel_action")],
      ])
    );
    return;
  }

  batchState.currentAmount = (amount * 1e8).toString();
  batchState.payees.push({
    email: batchState.currentEmail!,
    amount: batchState.currentAmount,
  });
  batchState.step = "select_or_add_payee";
  sessionManager.setSession(chatId, session);

  // Instead of just showing confirm/cancel, re-display the payee selection menu
  await ctx.replyWithMarkdown(
    `💰 Amount set: ${amount} USDC for ${batchState.currentEmail}`
  );
  await showPayeeSelection(ctx, chatId, session, true); // Pass true to show Confirm button
}

export async function handleConfirmBatch(
  ctx: Context,
  chatId: string,
  session: any
): Promise<void> {
  const batchState = session.batchPaymentState!;
  if (batchState.payees.length === 0) {
    await ctx.replyWithMarkdown(
      "⚠️ *No Payees Added*\n\nNo payees have been added. Use /sendbatch to start again.",
      Markup.inlineKeyboard([
        [Markup.button.callback("📱 Start Batch Payment", "send_batch")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
    batchState.step = "start";
    sessionManager.setSession(chatId, session);
    return;
  }

  try {
    await ctx.reply("🔄 Sending batch payment...");

    const requests = batchState.payees.map((payee: any, index: any) => ({
      requestId: `batch-payment-${index + 1}-${uuidv4()}`,
      request: {
        email: payee.email,
        amount: payee.amount,
        purposeCode: "self",
        currency: "USDC",
      },
    }));

    const response = await sendBatchPayment(session.accessToken!, requests);

    let message = "📱 *Batch Payment Initiated*\n\n";
    response.responses.forEach((res) => {
      message +=
        `📧 ${res.request.email}:\n` +
        `  - Amount: ${(parseInt(res.request.amount) / 1e8).toFixed(
          2
        )} USDC\n` +
        `  - Status: ${
          res.response?.status || res.error?.error || "unknown"
        }\n` +
        `  - Transaction ID: \`${res.response?.id || "N/A"}\`\n\n`;
    });

    batchState.payees = [];
    batchState.step = "start";
    sessionManager.setSession(chatId, session);

    await ctx.replyWithMarkdown(
      message,
      Markup.inlineKeyboard([
        [Markup.button.callback("📜 View History", "view_history")],
        [Markup.button.callback("📱 Send Another Batch", "send_batch")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  } catch (error) {
    const err = error as Error;
    batchState.step = "start";
    sessionManager.setSession(chatId, session);

    if (err.message.includes("401")) {
      sessionManager.deleteSession(chatId);
      await ctx.reply(
        "⚠️ Session expired. Please log in again.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔑 Log In", "start_login")],
        ])
      );
      return;
    }
    await ctx.replyWithMarkdown(
      `❌ *Error*: ${err.message}\n\nPlease try again or contact support.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📤 Try Again", "send_batch")],
        [Markup.button.callback("<< Back to Menu", "back_to_menu")],
      ])
    );
  }
}

// Request new OTP
export async function handleRequestNewOtp(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session || !session.email) {
    return handleStartLogin(ctx);
  }

  try {
    await ctx.reply(`🔄 Requesting a new OTP for ${session.email}...`);

    const { sid } = await requestOtp(session.email);

    sessionManager.setSession(chatId, {
      sid,
      loginState: "waiting_for_otp",
      otpRequestedAt: new Date(),
    });

    await ctx.reply(
      `✅ New OTP sent to ${session.email}!\n\n` +
        "📱 Please enter the 6-digit code you received:",
      Markup.forceReply().selective()
    );
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`❌ Error: ${err.message}`);

    await ctx.reply(
      "Would you like to try again?",
      Markup.inlineKeyboard([
        Markup.button.callback("🔄 Try Again", "start_login"),
        Markup.button.callback("❌ Cancel", "cancel_login"),
      ])
    );
  }
}

// Handle network selection for sending
export async function handleSendNetworkSelection(
  ctx: Context,
  network: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session) return;

  sessionManager.setSession(chatId, {
    ...session,
    lastAction: `send_${network}`,
  });

  await ctx.replyWithMarkdown(
    `*📤 Send USDC on ${network}*\n\n` +
      "Please enter the recipient's email address or wallet address:",
    Markup.forceReply().selective()
  );
}

// Handle network selection for withdrawing
export async function handleWithdrawNetworkSelection(
  ctx: Context,
  network: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session) return;

  sessionManager.setSession(chatId, {
    ...session,
    lastAction: `withdraw_${network}`,
  });

  await ctx.replyWithMarkdown(
    `*🏦 Withdraw USDC on ${network}*\n\n` +
      "Please enter the destination wallet address:",
    Markup.forceReply().selective()
  );
}

// Handle recipient input for sending
export async function handleRecipientInput(
  ctx: Context,
  recipient: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session || !session.lastAction?.startsWith("send_")) return;

  const network = session.lastAction.split("_")[1];

  // Basic validation
  if (!recipient || recipient.trim().length < 5) {
    await ctx.reply(
      "⚠️ Please enter a valid recipient email or wallet address:"
    );
    return;
  }

  sessionManager.setSession(chatId, {
    ...session,
    lastAction: `send_${network}_to_${recipient}`,
  });

  await ctx.replyWithMarkdown(
    `*📤 Send USDC on ${network}*\n\n` +
      `Recipient: \`${recipient}\`\n\n` +
      "Please enter the amount of USDC to send:",
    Markup.forceReply().selective()
  );
}

// Handle destination input for withdrawing
export async function handleDestinationInput(
  ctx: Context,
  destination: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session || !session.lastAction?.startsWith("withdraw_")) return;

  const network = session.lastAction.split("_")[1];

  // Basic validation
  if (!destination || destination.trim().length < 5) {
    await ctx.reply("⚠️ Please enter a valid destination wallet address:");
    return;
  }

  sessionManager.setSession(chatId, {
    ...session,
    lastAction: `withdraw_${network}_to_${destination}`,
  });

  await ctx.replyWithMarkdown(
    `*🏦 Withdraw USDC on ${network}*\n\n` +
      `Destination: \`${destination}\`\n\n` +
      "Please enter the amount of USDC to withdraw:",
    Markup.forceReply().selective()
  );
}

// Handle amount input for sending
export async function handleSendAmountInput(
  ctx: Context,
  amountStr: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (
    !session ||
    !session.lastAction?.startsWith("send_") ||
    !session.accessToken
  )
    return;

  // Parse action details
  const parts = session.lastAction.split("_");
  if (parts.length < 4) return;

  const network = parts[1];
  const recipient = parts[3];

  // Validate amount
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply("⚠️ Please enter a valid amount greater than 0:");
    return;
  }

  // Confirm transaction
  await ctx.replyWithMarkdown(
    `*📤 Confirm Transaction*\n\n` +
      `Send: ${amount} USDC\n` +
      `To: \`${recipient}\`\n` +
      `Network: ${network}\n\n` +
      "Please confirm this transaction:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✅ Confirm",
          `confirm_send_${network}_${recipient}_${amount}`
        ),
        Markup.button.callback("❌ Cancel", "cancel_action"),
      ],
    ])
  );
}
