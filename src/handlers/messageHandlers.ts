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

  // Natural language parsing with regex
  const sendEmailPattern =
    /^send\s+(\d+(\.\d+)?)\s*(usdc)?\s*to\s*([^\s@]+@[^\s@]+\.[^\s@]+)$/i;
  const sendAddressPattern =
    /^send\s+(\d+(\.\d+)?)\s*(usdc)?\s*to\s*(0x[a-fA-F0-9]{40})$/i;
  const depositPattern = /^deposit\s+(\d+(\.\d+)?)\s*(usdc)?$/i;

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

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        "⚠️ Please provide a valid amount (e.g., 'deposit 5 USDC')."
      );
      return;
    }

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

  // Handle batch payment flow
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
