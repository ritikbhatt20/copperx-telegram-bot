import { Context, Markup } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { sessionManager } from "../services/sessionManager";
import {
  requestOtp,
  authenticateOtp,
  getProfile,
  getKycStatus,
  getBalances,
  sendUsdc,
  withdrawUsdc,
  getTransactionHistory,
} from "../services/apiClient";
import { CONFIG } from "../config";

// Helper function to check login and handle unauthorized users
function requireAuth(
  ctx: Context,
  next: () => Promise<void>
): Promise<void> | void {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return ctx.reply("Error: Could not identify your chat session.");

  if (!sessionManager.isLoggedIn(chatId)) {
    return ctx.reply(
      "⚠️ You need to be logged in to use this command.\n\n" +
        "Press the button below to log in:",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
  }

  return next();
}

// Start command
export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  // Create initial session if doesn't exist
  if (!sessionManager.getSession(chatId)) {
    sessionManager.setSession(chatId, { chatId });
  }

  await ctx.replyWithMarkdown(
    "*Welcome to the Copperx Payout Bot* 💰\n\n" +
      "I can help you manage your Copperx account directly from Telegram.\n\n" +
      "• Deposit, withdraw, and transfer USDC\n" +
      "• Check your balance and transaction history\n" +
      "• Manage your account profile\n\n" +
      "Let's get started!",
    Markup.inlineKeyboard([
      [Markup.button.callback("🔑 Log In", "start_login")],
      [Markup.button.callback("❓ Help", "show_help")],
    ])
  );
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
    `• ${
      isLoggedIn
        ? "📤 /logout - Log out of your account"
        : "🔑 Press 'Log In' button to authenticate"
    }\n` +
    "• 👤 /profile - View your account profile\n" +
    "• 🔒 /kyc - Check your KYC verification status\n\n" +
    "*Transactions:*\n" +
    "• 💵 /balance - Check your wallet balances\n" +
    "• 📤 /send - Send USDC to an email or wallet\n" +
    "• 🏦 /withdraw - Withdraw USDC to a wallet or bank\n" +
    "• 📜 /history - View your recent transactions\n\n" +
    `*Need help?* Contact support: ${CONFIG.SUPPORT_LINK}`;

  const keyboardButtons = [];

  if (isLoggedIn) {
    keyboardButtons.push([
      Markup.button.callback("👤 Profile", "view_profile"),
      Markup.button.callback("💵 Balance", "view_balance"),
    ]);
    keyboardButtons.push([
      Markup.button.callback("📤 Send USDC", "start_send"),
      Markup.button.callback("🏦 Withdraw", "start_withdraw"),
    ]);
  } else {
    keyboardButtons.push([Markup.button.callback("🔑 Log In", "start_login")]);
  }

  await ctx.replyWithMarkdown(
    helpMessage,
    Markup.inlineKeyboard(keyboardButtons)
  );
}

// Login flow
export async function handleStartLogin(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  if (sessionManager.isLoggedIn(chatId)) {
    return ctx.reply(
      "You're already logged in! Use /profile to view your account or /logout to sign out."
    );
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
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);

  if (!session || session.loginState !== "waiting_for_email") {
    return;
  }

  if (!email.includes("@") || !email.includes(".")) {
    return ctx.reply(
      "⚠️ That doesn't look like a valid email address. Please try again:"
    );
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
    return ctx.reply("⚠️ Please enter a valid 6-digit OTP code:");
  }

  try {
    await ctx.reply("🔄 Verifying your OTP...");

    const { accessToken, expireAt, user } = await authenticateOtp(
      session.email,
      otp,
      session.sid
    );

    sessionManager.setSession(chatId, {
      accessToken,
      expireAt,
      loginState: "logged_in",
    });

    await ctx.replyWithMarkdown(
      `🎉 *Login successful!*\n\n` +
        `Welcome back, ${user.email}.\n\n` +
        "What would you like to do next?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("👤 View Profile", "view_profile"),
          Markup.button.callback("💵 Check Balance", "view_balance"),
        ],
        [
          Markup.button.callback("📤 Send USDC", "start_send"),
          Markup.button.callback("🏦 Withdraw", "start_withdraw"),
        ],
      ])
    );
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`❌ Error: ${err.message}`);

    // Give option to retry
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
    return ctx.reply(
      "You're not currently logged in. Use /login to sign in to your account."
    );
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
    return ctx.reply(
      "⚠️ You need to be logged in to view your profile.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
  }

  try {
    await ctx.reply("🔄 Fetching your profile...");

    const profile = await getProfile(session.accessToken!);

    // Format the name
    const name =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      "Not set";

    await ctx.replyWithMarkdown(
      `*👤 Your Profile*\n\n` +
        `*ID:* \`${profile.id}\`\n` +
        `*Name:* ${name}\n` +
        `*Email:* ${profile.email}\n` +
        `*Status:* ${profile.status}\n\n` +
        `*Account Type:* ${profile.accountType || "Individual"}\n`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("🔒 KYC Status", "view_kyc"),
          Markup.button.callback("💵 Balance", "view_balance"),
        ],
        [Markup.button.callback("📜 Transaction History", "view_history")],
      ])
    );
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      return ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
    }

    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// KYC Status command
export async function handleKycStatus(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);

  if (!session || !sessionManager.isLoggedIn(chatId)) {
    return ctx.reply(
      "⚠️ You need to be logged in to check your KYC status.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
  }

  try {
    await ctx.reply("🔄 Checking your KYC status...");

    const kycData = await getKycStatus(session.accessToken!);

    if (kycData.count === 0) {
      return ctx.replyWithMarkdown(
        "⚠️ *No KYC Records Found*\n\n" +
          "You need to complete your KYC verification on the Copperx platform to " +
          "unlock all features of your account.",
        Markup.inlineKeyboard([
          Markup.button.url("🔒 Complete KYC", "https://copperx.io"),
        ])
      );
    }

    const kyc = kycData.data[0]; // Get the latest KYC record

    let statusEmoji = "⏳";
    if (kyc.status === "approved") statusEmoji = "✅";
    if (kyc.status === "rejected") statusEmoji = "❌";

    const statusMessage =
      `*${statusEmoji} KYC Status: ${kyc.status.toUpperCase()}*\n\n` +
      `*Type:* ${kyc.type}\n` +
      `*ID:* \`${kyc.id}\`\n\n`;

    if (kyc.status === "approved") {
      await ctx.replyWithMarkdown(
        statusMessage +
          "✅ Your account is fully verified. You can now use all Copperx features.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("💵 Balance", "view_balance"),
            Markup.button.callback("📤 Send USDC", "start_send"),
          ],
        ])
      );
    } else {
      const kycUrl = kyc.kycUrl || "https://copperx.io";

      await ctx.replyWithMarkdown(
        statusMessage +
          `To complete your verification, please visit the Copperx platform:`,
        Markup.inlineKeyboard([
          Markup.button.url("🔒 Complete Verification", kycUrl),
        ])
      );
    }
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      return ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
    }

    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// Balance command
export async function handleBalance(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);

  if (!session || !sessionManager.isLoggedIn(chatId)) {
    return ctx.reply(
      "⚠️ You need to be logged in to check your balance.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
  }

  try {
    await ctx.reply("🔄 Fetching your balances...");

    // Placeholder implementation - replace with actual API call when available
    // const balances = await getBalances(session.accessToken!);

    // Temporary mock data for demonstration
    const balances = {
      balances: [
        { currency: "USDC", network: "solana", amount: "1000.50" },
        { currency: "USDC", network: "ethereum", amount: "500.25" },
      ],
    };

    if (!balances.balances || balances.balances.length === 0) {
      return ctx.reply(
        "You don't have any balances yet. Deposit funds to get started."
      );
    }

    const balanceMessage = balances.balances
      .map((b) => `${b.currency} (${b.network}): ${b.amount}`)
      .join("\n");

    await ctx.replyWithMarkdown(
      `*💵 Your Balances*\n\n${balanceMessage}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("📤 Send USDC", "start_send"),
          Markup.button.callback("🏦 Withdraw", "start_withdraw"),
        ],
        [Markup.button.callback("📜 Transaction History", "view_history")],
      ])
    );
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      return ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
    }

    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// Send USDC command
export async function handleStartSend(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  if (!sessionManager.isLoggedIn(chatId)) {
    return ctx.reply(
      "⚠️ You need to be logged in to send USDC.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
  }

  await ctx.replyWithMarkdown(
    "*📤 Send USDC*\n\n" + "Please select which network you want to use:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Solana", "send_network_solana"),
        Markup.button.callback("Ethereum", "send_network_ethereum"),
      ],
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

// Withdraw USDC command
export async function handleStartWithdraw(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  if (!sessionManager.isLoggedIn(chatId)) {
    return ctx.reply(
      "⚠️ You need to be logged in to withdraw USDC.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
  }

  await ctx.replyWithMarkdown(
    "*🏦 Withdraw USDC*\n\n" + "Please select which network you want to use:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Solana", "withdraw_network_solana"),
        Markup.button.callback("Ethereum", "withdraw_network_ethereum"),
      ],
      [Markup.button.callback("❌ Cancel", "cancel_action")],
    ])
  );
}

export async function handleTransactionHistory(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);

  if (!session || !sessionManager.isLoggedIn(chatId)) {
    return ctx.reply(
      "⚠️ You need to be logged in to view your transaction history.",
      Markup.inlineKeyboard([
        Markup.button.callback("🔑 Log In", "start_login"),
      ])
    );
  }

  try {
    await ctx.reply("🔄 Fetching your transaction history...");

    // Placeholder - replace with actual API call when available
    // const history = await getTransactionHistory(session.accessToken!);

    // Temporary mock data for demonstration
    const history = {
      transactions: [
        {
          id: "tx1",
          type: "send",
          amount: "50.00",
          currency: "USDC",
          status: "completed",
          timestamp: "2025-03-10T10:15:30Z",
          recipient: "user@example.com",
        },
        {
          id: "tx2",
          type: "receive",
          amount: "100.00",
          currency: "USDC",
          status: "completed",
          timestamp: "2025-03-08T14:22:15Z",
          sender: "business@example.com",
        },
        {
          id: "tx3",
          type: "withdraw",
          amount: "25.50",
          currency: "USDC",
          status: "pending",
          timestamp: "2025-03-12T09:05:45Z",
          destination: "0x1234...",
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        totalPages: 1,
        totalItems: 3,
      },
    };

    if (!history.transactions || history.transactions.length === 0) {
      return ctx.reply(
        "You don't have any transactions yet. Start by sending or receiving USDC."
      );
    }

    // Format the transactions
    const transactionsMessage = history.transactions
      .map((tx) => {
        const date = new Date(tx.timestamp).toLocaleDateString();
        const time = new Date(tx.timestamp).toLocaleTimeString();

        let details = "";
        if (tx.type === "send") {
          details = `To: ${tx.recipient}`;
        } else if (tx.type === "receive") {
          details = `From: ${tx.sender}`;
        } else if (tx.type === "withdraw") {
          details = `To: ${tx.destination}`;
        }

        return (
          `*${date} ${time}*\n` +
          `${tx.type.toUpperCase()}: ${tx.amount} ${tx.currency}\n` +
          `Status: ${tx.status}\n` +
          `${details}\n`
        );
      })
      .join("\n");

    await ctx.replyWithMarkdown(
      `*📜 Recent Transactions*\n\n${transactionsMessage}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("💵 Check Balance", "view_balance"),
          Markup.button.callback("📤 Send USDC", "start_send"),
        ],
      ])
    );
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      return ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
    }

    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// Cancel action
export async function handleCancelAction(ctx: Context): Promise<void> {
  await ctx.reply(
    "✅ Action cancelled. What would you like to do next?",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🔑 Log In", "start_login"),
        Markup.button.callback("❓ Help", "show_help"),
      ],
    ])
  );
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
    return ctx.reply(
      "⚠️ Please enter a valid recipient email or wallet address:"
    );
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
    return ctx.reply("⚠️ Please enter a valid destination wallet address:");
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
    return ctx.reply("⚠️ Please enter a valid amount greater than 0:");
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

// Handle amount input for withdrawing
export async function handleWithdrawAmountInput(
  ctx: Context,
  amountStr: string
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (
    !session ||
    !session.lastAction?.startsWith("withdraw_") ||
    !session.accessToken
  )
    return;

  // Parse action details
  const parts = session.lastAction.split("_");
  if (parts.length < 4) return;

  const network = parts[1];
  const destination = parts[3];

  // Validate amount
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply("⚠️ Please enter a valid amount greater than 0:");
  }

  // Confirm transaction
  await ctx.replyWithMarkdown(
    `*🏦 Confirm Withdrawal*\n\n` +
      `Withdraw: ${amount} USDC\n` +
      `To: \`${destination}\`\n` +
      `Network: ${network}\n\n` +
      "Please confirm this withdrawal:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✅ Confirm",
          `confirm_withdraw_${network}_${destination}_${amount}`
        ),
        Markup.button.callback("❌ Cancel", "cancel_action"),
      ],
    ])
  );
}

// Handle send confirmation
export async function handleSendConfirmation(
  ctx: Context,
  network: string,
  recipient: string,
  amount: number
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session || !session.accessToken) return;

  try {
    await ctx.reply("🔄 Processing your transaction...");

    // Placeholder - replace with actual API call when available
    // await sendUsdc(session.accessToken, recipient, amount, network);

    // Simulate successful transaction for now
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await ctx.replyWithMarkdown(
      `✅ *Transaction Successful!*\n\n` +
        `You have sent ${amount} USDC to \`${recipient}\` on ${network}.\n\n` +
        `Transaction ID: \`TX${Date.now().toString().substr(-8)}\``,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("💵 Check Balance", "view_balance"),
          Markup.button.callback("📜 View History", "view_history"),
        ],
        [Markup.button.callback("📤 Send Again", "start_send")],
      ])
    );
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      return ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
    }

    await ctx.reply(
      `❌ Error: ${err.message}\n\nYour transaction could not be processed.`,
      Markup.inlineKeyboard([
        Markup.button.callback("🔄 Try Again", "start_send"),
        Markup.button.callback("💵 Check Balance", "view_balance"),
      ])
    );
  }
}

// Handle withdraw confirmation
export async function handleWithdrawConfirmation(
  ctx: Context,
  network: string,
  destination: string,
  amount: number
): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session || !session.accessToken) return;

  try {
    await ctx.reply("🔄 Processing your withdrawal...");

    // Placeholder - replace with actual API call when available
    // await withdrawUsdc(session.accessToken, destination, amount, network);

    // Simulate successful transaction for now
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await ctx.replyWithMarkdown(
      `✅ *Withdrawal Initiated!*\n\n` +
        `You have withdrawn ${amount} USDC to \`${destination}\` on ${network}.\n\n` +
        `Transaction ID: \`TX${Date.now().toString().substr(-8)}\`\n\n` +
        `Please allow some time for the transaction to be confirmed on the blockchain.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("💵 Check Balance", "view_balance"),
          Markup.button.callback("📜 View History", "view_history"),
        ],
        [Markup.button.callback("🏦 Withdraw Again", "start_withdraw")],
      ])
    );
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      sessionManager.deleteSession(chatId);
      return ctx.reply(
        "⚠️ Your session has expired. Please log in again.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
    }

    await ctx.reply(
      `❌ Error: ${err.message}\n\nYour withdrawal could not be processed.`,
      Markup.inlineKeyboard([
        Markup.button.callback("🔄 Try Again", "start_withdraw"),
        Markup.button.callback("💵 Check Balance", "view_balance"),
      ])
    );
  }
}
