import { Context, Markup } from "telegraf";
import { sessionManager } from "../bot";
import QRCode from "qrcode";

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
    handleStart,
    handleSendBatch,
    handleConfirmBatch,
    handlePoints,
    handleDepositNetworkSelection,
    handleRemovePayee,
    handleRemovePayeeConfirmation,
    handleConfirmRemovePayee,
  } = await import("./commandHandlers");

  console.log("Callback data received:", data);

  if (data.startsWith("generate_qr_")) {
    const walletAddress = data.replace("generate_qr_", "");

    try {
      // Generate QR code as a buffer
      const qrCodeBuffer = await QRCode.toBuffer(walletAddress, {
        type: "png",
        width: 300, // Size of the QR code
        errorCorrectionLevel: "H", // High error correction for reliability
      });

      // Send the QR code image
      await ctx.replyWithPhoto(
        { source: qrCodeBuffer },
        {
          caption: `Scan this QR code to deposit funds to:\n\`${walletAddress}\``,
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("<< Back to Menu", "back_to_menu")],
          ]).reply_markup,
        }
      );
    } catch (error) {
      const err = error as Error;
      await ctx.reply(`❌ Error generating QR code: ${err.message}`);
    }
    return;
  }

  // Handle existing callback actions
  if (data === "start_login") return await handleStartLogin(ctx);
  if (data === "logout") return await handleLogout(ctx);
  if (data === "view_profile") return await handleProfile(ctx);
  if (data === "view_wallets") return await handleWallets(ctx);
  if (data === "view_kyc") return await handleKycStatus(ctx);
  if (data === "view_balance") return await handleBalance(ctx);
  if (data === "send_money_menu") return await handleSendMoneyMenu(ctx);
  if (data === "start_send") return await handleStartSend(ctx);
  if (data === "view_history") return await handleTransactionHistory(ctx);
  if (data === "cancel_action") return await handleCancelAction(ctx);
  if (data === "request_new_otp") return await handleRequestNewOtp(ctx);
  if (data === "start_addpayee") return await handleStartAddPayee(ctx);
  if (data === "start_sendemail") return await handleStartSendEmail(ctx);
  if (data === "start_withdraw") return await handleStartWithdraw(ctx);
  if (data === "deposit") return await handleDeposit(ctx);
  if (data === "set_default_wallet") return await handleSetDefaultWallet(ctx);
  if (data === "show_help") return await handleHelp(ctx);
  if (data === "send_batch") return await handleSendBatch(ctx);
  if (data === "view_points") return await handlePoints(ctx);

  if (data === "back_to_menu") {
    try {
      // Check if the message contains a photo
      const message = ctx.callbackQuery?.message;
      // Use type guard to check if the message has a 'photo' property
      const hasPhoto =
        message && "photo" in message && Array.isArray(message.photo);

      if (hasPhoto) {
        // For photo messages, send a new main menu message
        const chatId = ctx.chat?.id.toString();
        if (!chatId) return;

        const isLoggedIn = await sessionManager.isLoggedIn(chatId);
        if (isLoggedIn) {
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
                Markup.button.callback("🗑️ Remove Payee", "removepayee"),
                Markup.button.callback("📱 Batch Payment", "send_batch"),
              ],
              [
                Markup.button.callback("📜 Transactions", "view_history"),
                Markup.button.callback("💎 View Points", "view_points"),
              ],
              [Markup.button.callback("🔒 Logout", "logout")],
            ])
          );
        } else {
          await ctx.reply(
            "🚀 Welcome to CopperX Bot!\n\n" +
              "⚠️ You need to be logged in first to use this bot.\n\n" +
              "Press the button below to log in:",
            Markup.inlineKeyboard([
              [Markup.button.callback("🔑 Log In", "start_login")],
            ])
          );
        }
      } else {
        // For text messages, use the existing handleStart
        await handleStart(ctx);
      }
    } catch (error) {
      const err = error as Error;
      console.error("Error handling 'back_to_menu':", err.message);
      await ctx.reply(
        "⚠️ Something went wrong. Please try /start to return to the main menu."
      );
    }
    return;
  }

  if (data.startsWith("set_default_wallet_")) {
    const walletId = data.replace("set_default_wallet_", "");
    return await handleSetDefaultWalletSelection(ctx, walletId);
  }

  if (data.startsWith("sendemail_to_")) {
    const email = data.replace("sendemail_to_", "");
    return await handleSendEmailPayee(ctx, email);
  }

  if (data.startsWith("confirm_sendemail_")) {
    const parts = data.replace("confirm_sendemail_", "").split("_");
    if (parts.length >= 2) {
      return await handleSendEmailConfirmation(
        ctx,
        parts[0],
        parseFloat(parts[1])
      );
    }
  }

  if (data.startsWith("confirm_send_")) {
    const parts = data.replace("confirm_send_", "").split("_");
    if (parts.length >= 2) {
      return await handleSendConfirmation(ctx, parts[0], parseFloat(parts[1]));
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
    return await handleWithdrawSelectBank(ctx, bankId, amount);
  }

  if (data === "confirm_withdraw") {
    return await handleWithdrawConfirmation(ctx);
  }

  if (data.startsWith("deposit_network_")) {
    const network = data.replace("deposit_network_", "");
    return await handleDepositNetworkSelection(ctx, network);
  }

  if (data.startsWith("batch_payee_")) {
    const email = data.replace("batch_payee_", "");
    const session = await sessionManager.getSession(chatId);
    if (!session) {
      await ctx.reply("⚠️ Session not found. Please start over with /start.");
      return;
    }
    if (session.batchPaymentState) {
      session.batchPaymentState.currentEmail = email;
      session.batchPaymentState.step = "add_amount";
      await sessionManager.setSession(chatId, session);
      await ctx.reply(
        `📧 Email set: ${email}\n\nPlease enter the amount in USDC (e.g., 1 for 1 USDC):`,
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "cancel_action")],
        ])
      );
      return;
    }
  }

  if (data === "add_new_payee") {
    const session = await sessionManager.getSession(chatId);
    if (!session) {
      await ctx.reply("⚠️ Session not found. Please start over with /start.");
      return;
    }
    if (session.batchPaymentState) {
      session.batchPaymentState.step = "select_or_add_payee";
      await sessionManager.setSession(chatId, session);
      await ctx.reply(
        "Please enter a new payee's email address:",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ Cancel", "cancel_action")],
        ])
      );
      return;
    }
  }

  if (data === "confirm_batch") {
    const session = await sessionManager.getSession(chatId);
    if (!session) {
      await ctx.reply("⚠️ Session not found. Please start over with /start.");
      return;
    }
    if (session.batchPaymentState) {
      session.batchPaymentState.step = "confirm";
      await sessionManager.setSession(chatId, session);
      return await handleConfirmBatch(ctx, chatId, session);
    }
    await ctx.reply(
      "⚠️ No batch payment in progress. Use /sendbatch to start."
    );
    return;
  }

  if (data === "removepayee") return await handleRemovePayee(ctx);
  if (data.startsWith("remove_payee_")) {
    const payeeId = data.replace("remove_payee_", "");
    return await handleRemovePayeeConfirmation(ctx, payeeId);
  }
  if (data.startsWith("confirm_remove_")) {
    const payeeId = data.replace("confirm_remove_", "");
    return await handleConfirmRemovePayee(ctx, payeeId);
  }

  // Fallback for unknown callbacks
  await ctx.reply("Unknown action. Use /help for commands.");
}
