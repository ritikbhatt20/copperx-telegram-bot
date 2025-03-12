import { Context } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { sessionManager } from "../services/sessionManager";

// Handle text messages
export async function handleTextMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const session = sessionManager.getSession(chatId);
  if (!session) return;

  // Get message text
  const text = (ctx.message as Message.TextMessage).text.trim();

  // Handle login flow
  if (session.loginState === "waiting_for_email") {
    // Import dynamically to avoid circular dependencies
    const { handleEmailInput } = await import("./commandHandlers");
    return handleEmailInput(ctx, text);
  }

  if (session.loginState === "waiting_for_otp") {
    // Import dynamically to avoid circular dependencies
    const { handleOtpInput } = await import("./commandHandlers");
    return handleOtpInput(ctx, text);
  }

  // Handle transaction flows
  if (
    session.lastAction?.startsWith("send_") &&
    !session.lastAction.includes("_to_")
  ) {
    // Import dynamically to avoid circular dependencies
    const { handleRecipientInput } = await import("./commandHandlers");
    return handleRecipientInput(ctx, text);
  }

  if (
    session.lastAction?.startsWith("send_") &&
    session.lastAction.includes("_to_") &&
    !session.lastAction.includes("_amount_")
  ) {
    // Import dynamically to avoid circular dependencies
    const { handleSendAmountInput } = await import("./commandHandlers");
    return handleSendAmountInput(ctx, text);
  }

  if (
    session.lastAction?.startsWith("withdraw_") &&
    !session.lastAction.includes("_to_")
  ) {
    // Import dynamically to avoid circular dependencies
    const { handleDestinationInput } = await import("./commandHandlers");
    return handleDestinationInput(ctx, text);
  }

  if (
    session.lastAction?.startsWith("withdraw_") &&
    session.lastAction.includes("_to_") &&
    !session.lastAction.includes("_amount_")
  ) {
    // Import dynamically to avoid circular dependencies
    const { handleWithdrawAmountInput } = await import("./commandHandlers");
    return handleWithdrawAmountInput(ctx, text);
  }

  // If we reach here, the text doesn't match any expected input
  await ctx.reply(
    "I'm not sure what you're trying to do. Use /help to see available commands."
  );
}
