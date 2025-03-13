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
    handleSendConfirmation,
    handleStartAddPayee,
    handleStartSendEmail,
    handleSendEmailPayee,
    handleSendEmailConfirmation,
  } = await import("./commandHandlers");

  if (data === "start_login") return handleStartLogin(ctx);
  if (data === "logout") return handleLogout(ctx);
  if (data === "view_profile") return handleProfile(ctx);
  if (data === "view_kyc") return handleKycStatus(ctx);
  if (data === "view_balance") return handleBalance(ctx);
  if (data === "start_send") return handleStartSend(ctx);
  if (data === "start_withdraw") return handleStartWithdraw(ctx);
  if (data === "view_history") return handleTransactionHistory(ctx);
  if (data === "cancel_action") return handleCancelAction(ctx);
  if (data === "start_addpayee") return handleStartAddPayee(ctx);
  if (data === "start_sendemail") return handleStartSendEmail(ctx);

  if (data.startsWith("sendemail_to_")) {
    const email = data.replace("sendemail_to_", "");
    return handleSendEmailPayee(ctx, email);
  }

  if (data.startsWith("confirm_sendemail_")) {
    const parts = data.replace("confirm_sendemail_", "").split("_");
    if (parts.length >= 2) {
      const email = parts[0];
      const amount = parseFloat(parts[1]);
      return handleSendEmailConfirmation(ctx, email, amount);
    }
  }

  if (data.startsWith("confirm_send_")) {
    const parts = data.replace("confirm_send_", "").split("_");
    if (parts.length >= 2) {
      const walletAddress = parts[0];
      const amount = parseFloat(parts[1]);
      return handleSendConfirmation(ctx, walletAddress, amount);
    }
  }

  await ctx.reply("Unknown action. Use /help for commands.");
}
