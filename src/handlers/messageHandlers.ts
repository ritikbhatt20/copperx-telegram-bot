import { Context } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { sessionManager } from "../services/sessionManager";

export async function handleTextMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session) return;

  const text = (ctx.message as Message.TextMessage).text.trim();

  // Handle login flow
  if (session.loginState === "waiting_for_email") {
    const { handleEmailInput } = await import("./commandHandlers");
    return handleEmailInput(ctx, text);
  }

  if (session.loginState === "waiting_for_otp") {
    const { handleOtpInput } = await import("./commandHandlers");
    return handleOtpInput(ctx, text);
  }

  // Handle send flow
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

  // Handle addpayee flow
  if (session.lastAction === "addpayee") {
    const { handlePayeeEmail } = await import("./commandHandlers");
    return handlePayeeEmail(ctx, text);
  }

  if (session.lastAction?.startsWith("addpayee_email_")) {
    const { handlePayeeNickname } = await import("./commandHandlers");
    return handlePayeeNickname(ctx, text);
  }

  // Handle existing transaction flows
  if (
    session.lastAction?.startsWith("send_") &&
    session.lastAction.includes("_to_") &&
    !session.lastAction.includes("_amount_")
  ) {
    const { handleSendAmountInput } = await import("./commandHandlers");
    return handleSendAmountInput(ctx, text);
  }

  if (
    session.lastAction?.startsWith("withdraw_") &&
    !session.lastAction.includes("_to_")
  ) {
    const { handleDestinationInput } = await import("./commandHandlers");
    return handleDestinationInput(ctx, text);
  }

  if (
    session.lastAction?.startsWith("withdraw_") &&
    session.lastAction.includes("_to_") &&
    !session.lastAction.includes("_amount_")
  ) {
    const { handleWithdrawAmountInput } = await import("./commandHandlers");
    return handleWithdrawAmountInput(ctx, text);
  }

  await ctx.reply(
    "I'm not sure what you're trying to do. Use /help to see available commands."
  );
}
