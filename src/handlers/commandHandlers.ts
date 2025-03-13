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
  withdrawUsdc,
  getTransactionHistory,
  withdrawToWallet,
} from "../services/apiClient";
import { BalanceResponse } from "../config";
import { CONFIG, NETWORK_NAMES } from "../config";

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
    `• ${isLoggedIn ? "📤 /logout - Log out" : "🔑 Log in below"}\n` +
    "• 👤 /profile - View your profile\n" +
    "• 🔒 /kyc - Check KYC status\n" +
    "• 🏦 /setdefault - Set your default wallet\n\n" +
    "*Transactions:*\n" +
    "• 💵 /balance - Check wallet balances\n" +
    "• 📤 /send - Send USDC to a wallet\n" +
    "• 📧 /sendemail - Send USDC via email\n" +
    "• 🏦 /withdraw - Withdraw USDC to your bank account\n" + // Updated
    "• 📜 /history - View recent transactions\n" +
    "• ➕ /addpayee - Add a new payee\n\n" +
    "*Support:* https://t.me/copperxcommunity/2183";

  const keyboardButtons = isLoggedIn
    ? [
        [
          Markup.button.callback("👤 Profile", "view_profile"),
          Markup.button.callback("💵 Balance", "view_balance"),
        ],
        [
          Markup.button.callback("📤 Send USDC", "start_send"),
          Markup.button.callback("📧 Send via Email", "start_sendemail"),
        ],
        [
          Markup.button.callback("🏦 Withdraw to Bank", "start_withdraw"),
          Markup.button.callback("➕ Add Payee", "start_addpayee"),
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
      await ctx.replyWithMarkdown(
        "⚠️ *No KYC Records Found*\n\n" +
          "You need to complete your KYC verification on the Copperx platform to " +
          "unlock all features of your account.",
        Markup.inlineKeyboard([
          Markup.button.url("🔒 Complete KYC", "https://copperx.io"),
        ])
      );
      return;
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

export async function handleBalance(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("🔄 Fetching your wallet balances...");

      const wallets = await getWallets(session.accessToken!);
      const balances: BalanceResponse = await getBalances(session.accessToken!);

      if (!balances || balances.length === 0) {
        await ctx.reply(
          "No wallets found. Contact support to set up your account."
        );
        return;
      }

      const walletMap = new Map(wallets.map((w) => [w.id, w]));
      const balanceMessage = balances
        .map(
          (wallet: {
            walletId: string;
            isDefault: boolean | null;
            network: string;
            balances: Array<{
              symbol: string;
              balance: string;
              decimals: number;
              address: string;
            }>;
          }) => {
            const walletInfo = walletMap.get(wallet.walletId);
            const networkName =
              NETWORK_NAMES[wallet.network] || `Unknown (${wallet.network})`;
            const isDefault = wallet.isDefault ? " (Default)" : "";
            const balanceDetails =
              wallet.balances.length > 0
                ? wallet.balances
                    .map(
                      (b) => `${b.symbol}: ${parseFloat(b.balance).toFixed(2)}`
                    ) // No decimal adjustment
                    .join("\n")
                : "No balances";
            return `*${networkName}${isDefault}*\n${balanceDetails}`;
          }
        )
        .join("\n\n");

      await ctx.replyWithMarkdown(
        `*💵 Your Wallet Balances*\n\n${balanceMessage}\n\nTo add funds, deposit USDC to your wallet addresses via /profile.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback("📤 Send USDC", "start_send"),
            Markup.button.callback("🏦 Withdraw", "start_withdraw"),
          ],
          [Markup.button.callback("📜 History", "view_history")],
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

export async function handleSetDefaultWallet(ctx: Context): Promise<void> {
  await requireAuth(ctx, async () => {
    const chatId = ctx.chat!.id.toString();
    const session = sessionManager.getSession(chatId)!;

    try {
      await ctx.reply("🔄 Fetching your wallets...");

      // Fetch wallets
      const wallets = await getWallets(session.accessToken!);

      if (!wallets || wallets.length === 0) {
        await ctx.reply(
          "No wallets found. Contact support to set up your account."
        );
        return;
      }

      // Create inline keyboard with wallet options
      const walletButtons = wallets.map((wallet) => [
        Markup.button.callback(
          `${NETWORK_NAMES[wallet.network] || wallet.network} ${
            wallet.isDefault ? "(Default)" : ""
          }`,
          `set_default_wallet_${wallet.id}`
        ),
      ]);

      await ctx.replyWithMarkdown(
        `*🏦 Set Default Wallet*\n\nChoose a wallet to set as default:`,
        Markup.inlineKeyboard([
          ...walletButtons,
          [Markup.button.callback("❌ Cancel", "cancel_action")],
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
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

// Update handleCancelAction to clear send state
export async function handleCancelAction(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id.toString();
  const session = sessionManager.getSession(chatId);
  if (session) {
    session.lastAction = undefined;
    sessionManager.setSession(chatId, session);
  }
  await ctx.reply("Action cancelled.", Markup.removeKeyboard());
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
        [Markup.button.callback("📤 Send USDC", "start_send")],
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
    await ctx.reply(`❌ Error: ${err.message}`);
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
        {
          reply_markup: {
            inline_keyboard: payeeButtons.map((btn) => [btn]),
          },
        }
      );
    } catch (error) {
      const err = error as Error;
      session.lastAction = undefined;
      sessionManager.setSession(chatId, session);
      await ctx.reply(`❌ Error: ${err.message}`);
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
    await ctx.reply(`❌ Error: ${err.message}`);
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
      await ctx.reply(`❌ Error: ${err.message}`);
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
        `❌ Insufficient balance. You have ${usdcBalance.toFixed(
          2
        )} USDC.`
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
    await ctx.reply(`❌ Error: ${err.message}`);
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
    await ctx.reply(`❌ Error: ${err.message}`);
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
    await ctx.reply(`❌ Error: ${err.message}`);
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
            Markup.button.callback("📤 Send USDC", "start_send"),
          ])
        );
        return;
      }

      // Format transactions with better visual hierarchy
      const transactionsMessage = history.data
        .map((tx) => {
          // Format date in a cleaner way
          const txDate = new Date(tx.createdAt);
          const dateStr = txDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const timeStr = txDate.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });

          // Correct the amount by dividing by 1e8 instead of 1e8 (removing 2 extra zeros)
          const amount = (parseFloat(tx.fromAmount) / 1e8).toFixed(2);
          const currency = tx.fromCurrency;

          // Emoji based on transaction type
          let txEmoji = "";
          let details = "";
          let amountSign = "";

          switch (tx.type) {
            case "send":
              txEmoji = "↗️";
              amountSign = "-";
              const toAddress = tx.toAccount.walletAddress
                ? `${tx.toAccount.walletAddress.slice(
                    0,
                    6
                  )}...${tx.toAccount.walletAddress.slice(-4)}`
                : "Unknown";
              details = `To: \`${toAddress}\``;
              break;
            case "receive":
              txEmoji = "↘️";
              amountSign = "+";
              details = `From: \`${
                tx.fromAccount.payeeDisplayName || "Unknown"
              }\``;
              break;
            case "withdraw":
              txEmoji = "🏧";
              amountSign = "-";
              const withdrawAddress = tx.toAccount.walletAddress
                ? `${tx.toAccount.walletAddress.slice(
                    0,
                    6
                  )}...${tx.toAccount.walletAddress.slice(-4)}`
                : "Unknown";
              details = `To: \`${withdrawAddress}\``;
              break;
            case "deposit":
              txEmoji = "💰";
              amountSign = "+";
              details = `Network: \`${
                NETWORK_NAMES[tx.toAccount.network] || tx.toAccount.network
              }\``;
              break;
          }

          // Status emoji
          let statusEmoji = "";
          switch (tx.status.toLowerCase()) {
            case "success":
              statusEmoji = "✅";
              break;
            case "pending":
              statusEmoji = "⏳";
              break;
            case "awaiting_funds":
              statusEmoji = "⏳";
              break;
            case "canceled":
              statusEmoji = "❌";
              break;
            default:
              statusEmoji = "ℹ️";
          }

          return (
            `${txEmoji} *${tx.type.toUpperCase()}* • \`${dateStr} ${timeStr}\`\n` +
            `*${amountSign}${amount} ${currency}* ${statusEmoji} ${tx.status}\n` +
            `${details}`
          );
        })
        .join("\n\n");

      const formattedMessage = `*📜 Recent Transactions*\n\n${transactionsMessage}`;

      try {
        // Updated button configuration to include a Refresh button
        await ctx.replyWithMarkdown(
          formattedMessage,
          Markup.inlineKeyboard([
            [
              Markup.button.callback("💵 Check Balance", "view_balance"),
              Markup.button.callback("📤 Send USDC", "start_send"),
              Markup.button.callback("🔄 Refresh", "view_history"),
            ],
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
              Markup.button.callback("📤 Send USDC", "start_send"),
              Markup.button.callback("🔄 Refresh", "view_history"),
            ],
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
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });
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
