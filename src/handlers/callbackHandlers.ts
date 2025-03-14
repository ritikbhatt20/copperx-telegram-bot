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
    handleStart, // Import handleStart for "back_to_menu"
  } = await import("./commandHandlers");

  console.log("Callback data received:", data);

  // Handle all callback actions
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
  if (data === "back_to_menu") return handleStart(ctx); // Return to main menu

  // Handle set default wallet selection
  if (data.startsWith("set_default_wallet_")) {
    const walletId = data.replace("set_default_wallet_", "");
    return handleSetDefaultWalletSelection(ctx, walletId);
  }

  // Handle send email payee selection
  if (data.startsWith("sendemail_to_")) {
    const email = data.replace("sendemail_to_", "");
    return handleSendEmailPayee(ctx, email);
  }

  // Handle confirm send email
  if (data.startsWith("confirm_sendemail_")) {
    const parts = data.replace("confirm_sendemail_", "").split("_");
    if (parts.length >= 2) {
      return handleSendEmailConfirmation(ctx, parts[0], parseFloat(parts[1]));
    }
  }

  // Handle confirm send to wallet
  if (data.startsWith("confirm_send_")) {
    const parts = data.replace("confirm_send_", "").split("_");
    if (parts.length >= 2) {
      return handleSendConfirmation(ctx, parts[0], parseFloat(parts[1]));
    }
  }

  // Handle withdraw bank selection
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

  // Handle confirm withdraw
  if (data === "confirm_withdraw") {
    return handleWithdrawConfirmation(ctx);
  }

  // Handle deposit network selection (assuming this was intended to be handled)
  if (data.startsWith("deposit_network_")) {
    const network = data.replace("deposit_network_", "");
    const { handleDepositNetworkSelection } = await import("./commandHandlers");
    return handleDepositNetworkSelection(ctx, network);
  }

  // Default case for unhandled callbacks
  await ctx.reply("Unknown action. Use /help for commands.");
}
