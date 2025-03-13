import { Context } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { sessionManager } from "../services/sessionManager";

export async function handleTextMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  const text = (ctx.message as Message.TextMessage)?.text?.trim();

  if (!text) {
    await ctx.reply(
      "I'm not sure what you're trying to do. Use /help to see available commands."
    );
    return;
  }

  if (!session) {
    await ctx.reply(
      "I'm not sure what you're trying to do. Use /help to see available commands."
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

  // Fallback for any unmatched input
  await ctx.reply(
    "I'm not sure what you're trying to do. Use /help to see available commands."
  );
}
