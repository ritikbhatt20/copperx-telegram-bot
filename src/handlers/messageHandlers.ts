import { Context, Markup } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { sessionManager } from "../bot";

export async function handleTextMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = await sessionManager.getSession(chatId);
  const text = (ctx.message as Message.TextMessage)?.text?.trim();

  console.log(`Processing text message: ${text}, session state:`, session); // Debug log

  if (!text) {
    await ctx.reply(
      "I'm not sure what you're trying to do. Use /help to see available commands or try 'send 5 USDC to user@example.com'."
    );
    return;
  }

  // Natural language parsing with regex for all commands
  const sendEmailPattern =
    /^send\s+(\d+(\.\d+)?)\s*(usdc)?\s*to\s*([^\s@]+@[^\s@]+\.[^\s@]+)$/i;
  const sendAddressPattern =
    /^send\s+(\d+(\.\d+)?)\s*(usdc)?\s*to\s*(0x[a-fA-F0-9]{40})$/i;
    const depositPattern = /\b(deposit)\b(?:\s+(\d+(\.\d+)?)\s*(usdc)?)?/i;
  const withdrawPattern = /^withdraw\s+(\d+(\.\d+)?)\s*(usdc)?$/i;
  const balancePattern = /\b(balance)\b/i;
  const profilePattern = /\b(profile)\b/i;
  const kycPattern = /\b(kyc)\b/i;
  const historyPattern = /\b(history|transactions)\b/i;
  const logoutPattern = /\b(logout|sign\s*out)\b/i;
  const addPayeePattern =
    /^add\s*(a)?\s*payee\s*(email)?\s*([^\s@]+@[^\s@]+\.[^\s@]+)$/i;
  const removePayeePattern =
    /^remove\s*(a)?\s*payee\s*([^\s@]+@[^\s@]+\.[^\s@]+)$/i;
  const setDefaultWalletPattern =
    /\b(set\s*(default\s*)?wallet)\b(?:\s*(polygon|arbitrum|base|starknet))?/i;
  const sendBatchPattern = /\b(send\s*batch|batch\s*payment)\b/i;
  const pointsPattern = /\b(points)\b/i;

  // Handle "send <amount> [USDC] to <email>"
  const sendEmailMatch = text.match(sendEmailPattern);
  if (sendEmailMatch) {
    const [, amountStr, , , email] = sendEmailMatch;
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        "⚠️ Please provide a valid amount (e.g., 'send 5 USDC to user@example.com')."
      );
      return;
    }

    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to send money.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    await sessionManager.setSession(chatId, {
      ...session,
      lastAction: `sendemail_to_${email}_amount_${amount}`,
    });

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
    return;
  }

  // Handle "send <amount> [USDC] to <wallet address>"
  const sendAddressMatch = text.match(sendAddressPattern);
  if (sendAddressMatch) {
    const [, amountStr, , , walletAddress] = sendAddressMatch;
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        "⚠️ Please provide a valid amount (e.g., 'send 5 USDC to 0x1234...abcd')."
      );
      return;
    }

    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to send money.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    await sessionManager.setSession(chatId, {
      ...session,
      lastAction: `send_to_${walletAddress}_amount_${amount}`,
    });

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
    return;
  }

  // Handle "deposit <amount> [USDC]"
  const depositMatch = text.match(depositPattern);
  if (depositMatch) {
    const [, amountStr] = depositMatch;
    const amount = parseFloat(amountStr);

    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to deposit funds.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleDeposit } = await import("./commandHandlers");
    await handleDeposit(ctx);
    return;
  }

  // Handle "withdraw <amount> [USDC]"
  const withdrawMatch = text.match(withdrawPattern);
  if (withdrawMatch) {
    const [, amountStr] = withdrawMatch;
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        "⚠️ Please provide a valid amount (e.g., 'withdraw 10 USDC')."
      );
      return;
    }

    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to withdraw funds.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleWithdrawAmount } = await import("./commandHandlers");
    await handleWithdrawAmount(ctx, amountStr);
    return;
  }

  // Handle "check my balance" or "balance"
  const balanceMatch = text.match(balancePattern);
  if (balanceMatch) {
    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to check your balance.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleBalance } = await import("./commandHandlers");
    await handleBalance(ctx);
    return;
  }

  // Handle "check my profile" or "profile"
  const profileMatch = text.match(profilePattern);
  if (profileMatch) {
    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to view your profile.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleProfile } = await import("./commandHandlers");
    await handleProfile(ctx);
    return;
  }

  // Handle "check my kyc" or "kyc"
  const kycMatch = text.match(kycPattern);
  if (kycMatch) {
    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to check your KYC status.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleKycStatus } = await import("./commandHandlers");
    await handleKycStatus(ctx);
    return;
  }

  // Handle "check my history" or "history"
  const historyMatch = text.match(historyPattern);
  if (historyMatch) {
    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to view your transaction history.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleTransactionHistory } = await import("./commandHandlers");
    await handleTransactionHistory(ctx);
    return;
  }

  // Handle "logout" or "sign out"
  const logoutMatch = text.match(logoutPattern);
  if (logoutMatch) {
    if (!session) {
      await ctx.reply("You're not logged in. Use /start to begin.");
      return;
    }

    const { handleLogout } = await import("./commandHandlers");
    await handleLogout(ctx);
    return;
  }

  // Handle "add payee <email>"
  const addPayeeMatch = text.match(addPayeePattern);
  if (addPayeeMatch) {
    const [, , , , email] = addPayeeMatch;

    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to add a payee.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handlePayeeEmail } = await import("./commandHandlers");
    await handlePayeeEmail(ctx, email);
    return;
  }

  // Handle "remove payee <email>"
  const removePayeeMatch = text.match(removePayeePattern);
  if (removePayeeMatch) {
    const [, , , email] = removePayeeMatch;

    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to remove a payee.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleRemovePayee, handleRemovePayeeConfirmation } = await import(
      "./commandHandlers"
    );
    const payees = await (
      await import("../services/apiClient")
    ).getPayees(session.accessToken!);
    const payee = payees.data.find(
      (p) => p.email.toLowerCase() === email.toLowerCase()
    );

    if (!payee) {
      await ctx.replyWithMarkdown(
        `⚠️ *Payee Not Found*\n\nNo payee with email \`${email}\` exists. Use /removepayee to see available payees.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🗑️ Remove Payee", "removepayee")],
        ])
      );
      return;
    }

    await handleRemovePayeeConfirmation(ctx, payee.id);
    return;
  }

  // Handle "set default wallet [network]"
  const setDefaultWalletMatch = text.match(setDefaultWalletPattern);
  if (setDefaultWalletMatch) {
    const network = setDefaultWalletMatch[3]?.toLowerCase();

    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to set a default wallet.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleSetDefaultWallet, handleSetDefaultWalletSelection } =
      await import("./commandHandlers");
    if (!network) {
      await handleSetDefaultWallet(ctx);
    } else {
      const networkMap: { [key: string]: string } = {
        polygon: "137",
        arbitrum: "42161",
        base: "8453",
        starknet: "23434",
      };
      const networkId = networkMap[network];
      if (!networkId) {
        await ctx.reply(
          "⚠️ Invalid network. Use Polygon, Arbitrum, Base, or Starknet."
        );
        return;
      }

      const wallets = await (
        await import("../services/apiClient")
      ).getWallets(session.accessToken!);
      const wallet = wallets.find((w) => w.network === networkId);
      if (!wallet) {
        await ctx.reply(
          `⚠️ No wallet found for ${
            network.charAt(0).toUpperCase() + network.slice(1)
          }. Use /setdefault to see options.`
        );
        return;
      }

      await handleSetDefaultWalletSelection(ctx, wallet.id);
    }
    return;
  }

  // Handle "send batch [to <number> payees]"
  const sendBatchMatch = text.match(sendBatchPattern);
  if (sendBatchMatch) {
    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to send a batch payment.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handleSendBatch } = await import("./commandHandlers");
    await handleSendBatch(ctx);
    return;
  }

  // Handle "check my points" or "points"
  const pointsMatch = text.match(pointsPattern);
  if (pointsMatch) {
    if (!session) {
      await ctx.reply(
        "⚠️ You need to be logged in to check your points.",
        Markup.inlineKeyboard([
          Markup.button.callback("🔑 Log In", "start_login"),
        ])
      );
      return;
    }

    const { handlePoints } = await import("./commandHandlers");
    await handlePoints(ctx);
    return;
  }

  // Existing structured input handling
  if (!session) {
    await ctx.reply(
      "I'm not sure what you're trying to do. Use /help to see available commands or try 'send 5 USDC to user@example.com'."
    );
    return;
  }

  if (session.loginState === "waiting_for_email") {
    const { handleEmailInput } = await import("./commandHandlers");
    return handleEmailInput(ctx, text);
  }

  if (session.loginState === "waiting_for_otp") {
    const { handleOtpInput } = await import("./commandHandlers");
    return handleOtpInput(ctx, text);
  }

  if (session.lastAction === "send") {
    const { handleSendAddress } = await import("./commandHandlers");
    return handleSendAddress(ctx, text);
  }

  if (
    session.lastAction?.startsWith("send_to_") &&
    !session.lastAction.includes("_amount_")
  ) {
    const { handleSendAmount } = await import("./commandHandlers");
    return handleSendAmount(ctx, text);
  }

  if (session.lastAction === "addpayee") {
    const { handlePayeeEmail } = await import("./commandHandlers");
    return handlePayeeEmail(ctx, text);
  }

  if (session.lastAction?.startsWith("addpayee_email_")) {
    const { handlePayeeNickname } = await import("./commandHandlers");
    return handlePayeeNickname(ctx, text);
  }

  if (
    session.lastAction?.startsWith("sendemail_to_") &&
    !session.lastAction.includes("_amount_")
  ) {
    const { handleSendEmailAmount } = await import("./commandHandlers");
    return handleSendEmailAmount(ctx, text);
  }

  if (session.lastAction === "withdraw") {
    const { handleWithdrawAmount } = await import("./commandHandlers");
    return handleWithdrawAmount(ctx, text);
  }

  if (session.batchPaymentState && session.batchPaymentState.step !== "start") {
    const { handleSendBatch } = await import("./commandHandlers");
    return handleSendBatch(ctx);
  }

  // Fallback for unrecognized input
  console.log(`Unhandled text message: ${text}`); // Debug log
  await ctx.reply(
    "I'm not sure what you're trying to do. Use /help to see available commands or try 'send 5 USDC to user@example.com'."
  );
}
