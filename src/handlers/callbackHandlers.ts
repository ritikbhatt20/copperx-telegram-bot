import { Context, Markup } from "telegraf";
import { sessionManager } from "../services/sessionManager";

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  await ctx.answerCbQuery(); // Acknowledge the callback to Telegram

  const {
    handleStartLogin,
    handleLogout,
    handleProfile,
    handleKycStatus,
    handleBalance,
    handleStartSend,
    handleTransactionHistory,
    handleCancelAction,
    handleRequestNewOtp,
    handleSendConfirmation,
    handleStartAddPayee,
    handleStartSendEmail,
    handleSendEmailPayee,
    handleSendEmailConfirmation,
    handleStartWithdraw,
    handleWithdrawSelectBank,
    handleWithdrawConfirmation,
    handleDeposit,
    handleSetDefaultWallet,
    handleSetDefaultWalletSelection,
    handleHelp,
    handleWallets,
    handleSendMoneyMenu,
    handleStart,
    handleSendBatch,
    handleConfirmBatch,
  } = await import("./commandHandlers");

  console.log("Callback data received:", data);

  if (data === "start_login") return handleStartLogin(ctx);
  if (data === "logout") return handleLogout(ctx);
  if (data === "view_profile") return handleProfile(ctx);
  if (data === "view_wallets") return handleWallets(ctx);
  if (data === "view_kyc") return handleKycStatus(ctx);
  if (data === "view_balance") return handleBalance(ctx);
  if (data === "send_money_menu") return handleSendMoneyMenu(ctx);
  if (data === "start_send") return handleStartSend(ctx);
  if (data === "view_history") return handleTransactionHistory(ctx);
  if (data === "cancel_action") return handleCancelAction(ctx);
  if (data === "request_new_otp") return handleRequestNewOtp(ctx);
  if (data === "start_addpayee") return handleStartAddPayee(ctx);
  if (data === "start_sendemail") return handleStartSendEmail(ctx);
  if (data === "start_withdraw") return handleStartWithdraw(ctx);
  if (data === "deposit") return handleDeposit(ctx);
  if (data === "set_default_wallet") return handleSetDefaultWallet(ctx);
  if (data === "show_help") return handleHelp(ctx);
  if (data === "back_to_menu") return handleStart(ctx);
  if (data === "send_batch") return handleSendBatch(ctx);

  if (data.startsWith("set_default_wallet_")) {
    const walletId = data.replace("set_default_wallet_", "");
    return handleSetDefaultWalletSelection(ctx, walletId);
  }

  if (data.startsWith("sendemail_to_")) {
    const email = data.replace("sendemail_to_", "");
    return handleSendEmailPayee(ctx, email);
  }

  if (data.startsWith("confirm_sendemail_")) {
    const parts = data.replace("confirm_sendemail_", "").split("_");
    if (parts.length >= 2) {
      return handleSendEmailConfirmation(ctx, parts[0], parseFloat(parts[1]));
    }
  }

  if (data.startsWith("confirm_send_")) {
    const parts = data.replace("confirm_send_", "").split("_");
    if (parts.length >= 2) {
      return handleSendConfirmation(ctx, parts[0], parseFloat(parts[1]));
    }
  }

  if (data.startsWith("withdraw_bank_")) {
    const parts = data.split("_");
    if (parts.length !== 4) {
      await ctx.reply("❌ Invalid selection. Please try again.");
      return;
    }
    const [, , bankId, amountStr] = parts;
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      await ctx.reply("❌ Invalid amount. Please try again.");
      return;
    }
    return handleWithdrawSelectBank(ctx, bankId, amount);
  }

  if (data === "confirm_withdraw") {
    return handleWithdrawConfirmation(ctx);
  }

  if (data.startsWith("deposit_network_")) {
    const network = data.replace("deposit_network_", "");
    const { handleDepositNetworkSelection } = await import("./commandHandlers");
    return handleDepositNetworkSelection(ctx, network);
  }

  if (data.startsWith("batch_payee_")) {
    const email = data.replace("batch_payee_", "");
    const session = sessionManager.getSession(chatId);
    if (session && session.batchPaymentState) {
      session.batchPaymentState.currentEmail = email;
      session.batchPaymentState.step = "add_amount";
      sessionManager.setSession(chatId, session);
      await ctx.reply(
        `📧 Email set: ${email}\n\nPlease enter the amount in USDC (e.g., 1 for 1 USDC):`,
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "cancel_action")],
        ])
      );
      return; // Ensure we exit after handling to prevent fallback
    }
  }

  if (data === "add_new_payee") {
    const session = sessionManager.getSession(chatId);
    if (session && session.batchPaymentState) {
      session.batchPaymentState.step = "select_or_add_payee";
      sessionManager.setSession(chatId, session);
      await ctx.reply(
        "Please enter a new payee's email address:",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "cancel_action")],
        ])
      );
      return; // Prevent fallback
    }
  }

  if (data === "confirm_batch") {
    const session = sessionManager.getSession(chatId);
    if (session && session.batchPaymentState) {
      session.batchPaymentState.step = "confirm";
      sessionManager.setSession(chatId, session);
      return handleConfirmBatch(ctx, chatId, session);
    }
    await ctx.reply(
      "⚠️ No batch payment in progress. Use /sendbatch to start."
    );
    return;
  }

  await ctx.reply("Unknown action. Use /help for commands.");
}
