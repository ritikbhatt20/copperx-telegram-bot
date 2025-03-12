import { Context } from "telegraf";
import { sessionManager } from "../services/sessionManager";

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  await ctx.answerCbQuery();

  const {
    handleStartLogin,
    handleLogout,
    handleProfile,
    handleKycStatus,
    handleBalance,
    handleStartSend,
    handleStartWithdraw,
    handleTransactionHistory,
    handleCancelAction,
    handleRequestNewOtp,
    handleSendNetworkSelection,
    handleWithdrawNetworkSelection,
    handleSendConfirmation,
    handleWithdrawConfirmation,
    handleHelp,
    handleSetDefaultWallet, // Added
    handleSetDefaultWalletSelection, // Added
  } = await import("./commandHandlers");

  // Basic commands
  if (data === "start_login") {
    return handleStartLogin(ctx);
  }

  if (data === "show_help") {
    return handleHelp(ctx);
  }

  if (data === "logout") {
    return handleLogout(ctx);
  }

  if (data === "view_profile") {
    return handleProfile(ctx);
  }

  if (data === "view_kyc") {
    return handleKycStatus(ctx);
  }

  if (data === "view_balance") {
    return handleBalance(ctx);
  }

  if (data === "start_send") {
    return handleStartSend(ctx);
  }

  if (data === "start_withdraw") {
    return handleStartWithdraw(ctx);
  }

  if (data === "view_history") {
    return handleTransactionHistory(ctx);
  }

  if (data === "cancel_action" || data === "cancel_login") {
    return handleCancelAction(ctx);
  }

  if (data === "request_new_otp") {
    return handleRequestNewOtp(ctx);
  }

  // Set default wallet
  if (data === "set_default_wallet") {
    return handleSetDefaultWallet(ctx);
  }

  if (data.startsWith("set_default_wallet_")) {
    const walletId = data.replace("set_default_wallet_", "");
    return handleSetDefaultWalletSelection(ctx, walletId);
  }

  // Network selection for send
  if (data.startsWith("send_network_")) {
    const network = data.replace("send_network_", "");
    return handleSendNetworkSelection(ctx, network);
  }

  // Network selection for withdraw
  if (data.startsWith("withdraw_network_")) {
    const network = data.replace("withdraw_network_", "");
    return handleWithdrawNetworkSelection(ctx, network);
  }

  // Transaction confirmations
  if (data.startsWith("confirm_send_")) {
    const parts = data.replace("confirm_send_", "").split("_");
    if (parts.length >= 3) {
      const network = parts[0];
      const recipient = parts[1];
      const amount = parseFloat(parts[2]);
      return handleSendConfirmation(ctx, network, recipient, amount);
    }
  }

  if (data.startsWith("confirm_withdraw_")) {
    const parts = data.replace("confirm_withdraw_", "").split("_");
    if (parts.length >= 3) {
      const network = parts[0];
      const destination = parts[1];
      const amount = parseFloat(parts[2]);
      return handleWithdrawConfirmation(ctx, network, destination, amount);
    }
  }

  // Unknown callback
  await ctx.reply(
    "Unknown action. Please try again or use /help to see available commands."
  );
}
