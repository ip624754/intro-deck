export function resolveTelegramMessageReference(ctx, message = null) {
  const candidate = message && typeof message === 'object' ? message : null;
  const chatId = candidate?.chat?.id ?? ctx?.callbackQuery?.message?.chat?.id ?? ctx?.chat?.id ?? null;
  const messageId = candidate?.message_id ?? ctx?.callbackQuery?.message?.message_id ?? ctx?.message?.message_id ?? null;
  if (chatId === null || messageId === null) return null;
  return { chatId, messageId };
}

function isBenignEditError(error) {
  const message = String(error?.message || error);
  return message.includes('message is not modified') || message.includes('message to edit not found');
}

export async function safeEditMessageByReference(ctx, reference, text, other = {}) {
  if (reference?.chatId !== null && reference?.messageId !== null && ctx?.api?.editMessageText) {
    try {
      const message = await ctx.api.editMessageText(reference.chatId, reference.messageId, text, other);
      return { message, reference, edited: true, replied: false };
    } catch (error) {
      if (!isBenignEditError(error)) {
        console.warn('[safeEditMessageByReference] edit failed, falling back to reply', String(error?.message || error));
      }
    }
  }

  const message = await ctx.reply(text, other);
  return {
    message,
    reference: resolveTelegramMessageReference(ctx, message),
    edited: false,
    replied: true
  };
}

export async function safeEditOrReply(ctx, text, other = {}) {
  const canEdit = Boolean(ctx.callbackQuery?.message);

  if (canEdit) {
    try {
      return await ctx.editMessageText(text, other);
    } catch (error) {
      if (!isBenignEditError(error)) {
        console.warn('[safeEditOrReply] edit failed, falling back to reply', String(error?.message || error));
      }
    }
  }

  return ctx.reply(text, other);
}
