import { Composer } from 'grammy';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import {
  authorizeDmCheckoutForTelegramUser,
  beginDmReplyComposeForTelegramUser,
  beginDmRequestComposeForTelegramUser,
  confirmDmPaymentForTelegramUser,
  decideDmThreadForTelegramUser,
  getDmThreadInvoiceForTelegramUser,
  loadDmThreadDetailForTelegramUser,
  parseDmInvoicePayload
} from '../../lib/storage/dmStore.js';
import { formatDmDecisionReason, formatDmRequestReason, formatUserFacingError } from '../utils/notices.js';
import { getTransactionDisclosures, paymentSheetOpenedNotice } from '../../lib/telegram/transactionCopy.js';
import { localizeMemberText } from '../../lib/telegram/memberLocalization.js';
import {
  recordLinkedInShareAttributionApprovalByEntity,
  recordLinkedInShareAttributionEventForTelegramUser
} from '../../lib/storage/linkedinShareAttributionStore.js';

async function sendDmInvoice(ctx, invoice) {
  return ctx.api.raw.sendInvoice({
    chat_id: ctx.from.id,
    title: invoice.title,
    description: invoice.description,
    payload: invoice.payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: ctx.interfaceLanguage === 'ru' ? 'Доставка запроса' : 'Request delivery', amount: invoice.amountStars }]
  });
}

export function createDmComposer({ clearAllPendingInputs, buildDmInboxSurface, buildDmThreadSurface }) {
  const composer = new Composer();

  composer.command('dm', async (ctx) => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildDmInboxSurface(ctx);
    await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery('dm:inbox', async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildDmInboxSurface(ctx);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dir:dm:(\d+):(\d+)$/, async (ctx) => {
    const profileId = Number.parseInt(ctx.match?.[1] || '0', 10);
    await clearAllPendingInputs(ctx.from.id);

    await recordLinkedInShareAttributionEventForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      targetProfileId: profileId,
      eventType: 'private_chat_request_started',
      telegramUpdateId: ctx.update?.update_id || null,
      detail: { contactKind: 'private_chat' }
    }).catch(() => null);

    const result = await beginDmRequestComposeForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      targetProfileId: profileId
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      created: false,
      duplicate: false,
      blocked: false,
      throttled: false,
      reason: String(error?.message || error),
      thread: null,
      target: null
    }));

    if (!result.persistenceEnabled) {
      await ctx.answerCallbackQuery({ text: localizeMemberText('This feature is temporarily unavailable. Try again later.', ctx.interfaceLanguage) });
      return;
    }

    if (result.blocked || result.throttled) {
      await ctx.answerCallbackQuery({ text: formatDmRequestReason(result.reason, ctx.interfaceLanguage) });
      return;
    }

    if (result.duplicate && result.thread?.dm_thread_id) {
      const surface = await buildDmThreadSurface(ctx, result.thread.dm_thread_id, `ℹ️ ${formatDmRequestReason(result.reason, ctx.interfaceLanguage)}`);
      await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
      return;
    }

    await ctx.answerCallbackQuery({ text: ctx.interfaceLanguage === 'ru' ? 'Отправьте первое сообщение для запроса в приватный чат.' : 'Send your first private-chat request message.' });
    await ctx.reply(localizeMemberText([
      `💬 Private-chat request to ${result.target?.display_name || 'this member'}`,
      '',
      'Reply with the first message now.',
      'The conversation opens only if the recipient accepts.',
      'After you send the message, you can pay to deliver this permission request.',
      getTransactionDisclosures(ctx.interfaceLanguage).requestDeliveryPayment
    ].join('\n'), ctx.interfaceLanguage));
  });

  composer.callbackQuery(/^dm:view:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const threadId = Number.parseInt(ctx.match?.[1] || '0', 10);
    const surface = await buildDmThreadSurface(ctx, threadId);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.callbackQuery(/^dm:send:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const threadId = Number.parseInt(ctx.match?.[1] || '0', 10);
    const result = await beginDmReplyComposeForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      threadId
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      blocked: false,
      reason: String(error?.message || error),
      thread: null
    }));

    if (!result.persistenceEnabled) {
      await ctx.reply(localizeMemberText('⚠️ This feature is temporarily unavailable. Try again later.', ctx.interfaceLanguage));
      return;
    }

    if (!result.changed) {
      const surface = await buildDmThreadSurface(ctx, threadId, `⚠️ ${formatDmRequestReason(result.reason, ctx.interfaceLanguage)}`);
      await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
      return;
    }

    await ctx.reply(localizeMemberText([
      `💬 Reply to ${result.thread?.display_name || 'this member'}`,
      '',
      'Send your next text message in chat now.',
      'It will be delivered inside this active private chat.'
    ].join('\n'), ctx.interfaceLanguage));
  });

  composer.callbackQuery(/^dm:pay:(\d+)$/, async (ctx) => {
    const threadId = Number.parseInt(ctx.match?.[1] || '0', 10);
    await clearAllPendingInputs(ctx.from.id);
    const result = await getDmThreadInvoiceForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      threadId
    }).catch((error) => ({
      persistenceEnabled: true,
      blocked: false,
      reason: String(error?.message || error),
      thread: null,
      invoice: null
    }));

    if (!result.persistenceEnabled) {
      await ctx.answerCallbackQuery({ text: localizeMemberText('This feature is temporarily unavailable. Try again later.', ctx.interfaceLanguage) });
      return;
    }

    if (result.blocked || !result.invoice) {
      await ctx.answerCallbackQuery({ text: formatDmRequestReason(result.reason, ctx.interfaceLanguage) });
      return;
    }

    try {
      await sendDmInvoice(ctx, result.invoice);
      await ctx.answerCallbackQuery({ text: paymentSheetOpenedNotice(result.invoice.amountStars, ctx.interfaceLanguage) });
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatUserFacingError(error?.message || error, 'Could not open the DM payment sheet right now.', ctx.interfaceLanguage) });
    }
  });

  composer.callbackQuery(/^dm:(acc|dec|blk|rpt):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await clearAllPendingInputs(ctx.from.id);
    const decision = ctx.match?.[1];
    const threadId = Number.parseInt(ctx.match?.[2] || '0', 10);

    const result = await decideDmThreadForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      threadId,
      decision
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      duplicate: false,
      blocked: false,
      reason: String(error?.message || error),
      thread: null
    }));

    const russian = ctx.interfaceLanguage === 'ru';
    let notice = russian ? 'Приватный чат обновлён.' : 'Private chat updated.';
    if (!result.persistenceEnabled) {
      notice = russian ? '⚠️ Функция временно недоступна. Попробуйте позже.' : '⚠️ This feature is temporarily unavailable. Try again later.';
    } else if (result.changed && result.reason === 'dm_thread_accepted') {
      await recordLinkedInShareAttributionApprovalByEntity({
        ownerTelegramUserId: ctx.from.id,
        entityType: 'dm_thread',
        entityId: result.thread?.dm_thread_id || threadId,
        telegramUpdateId: ctx.update?.update_id || null,
        detail: { decision: 'accepted' }
      }).catch(() => null);
      notice = russian
        ? `✅ Вы приняли запрос в чат от ${result.thread?.display_name || 'этого участника'}. Приватный диалог открыт.`
        : `✅ Accepted the chat request from ${result.thread?.display_name || 'this member'}. The private conversation is now active.`;
    } else if (result.changed && result.reason === 'dm_thread_declined') {
      notice = russian
        ? `✅ Вы отклонили запрос в чат от ${result.thread?.display_name || 'этого участника'}. Диалог не был открыт.`
        : `✅ Declined the chat request from ${result.thread?.display_name || 'this member'}. No conversation was opened.`;
    } else if (result.changed && result.reason === 'dm_thread_reported') {
      notice = russian ? '✅ Жалоба отправлена, участник заблокирован для этого чата.' : '✅ Reported the request and blocked this member from this chat path.';
    } else if (result.changed && result.reason === 'dm_thread_blocked') {
      notice = russian ? '✅ Участник заблокирован для этого чата.' : '✅ Blocked this member from this chat path.';
    } else if (result.duplicate) {
      notice = `ℹ️ ${formatDmDecisionReason(result.reason, ctx.interfaceLanguage)}`;
    } else if (result.blocked) {
      notice = `⚠️ ${formatDmDecisionReason(result.reason, ctx.interfaceLanguage)}`;
    } else {
      notice = `⚠️ ${formatUserFacingError(result.reason, formatDmDecisionReason(result.reason, ctx.interfaceLanguage), ctx.interfaceLanguage)}`;
    }

    const surface = result.thread?.dm_thread_id
      ? await buildDmThreadSurface(ctx, result.thread.dm_thread_id, notice)
      : await buildDmInboxSurface(ctx, notice);
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  });

  composer.on('pre_checkout_query', async (ctx, next) => {
    const parsed = parseDmInvoicePayload(ctx.preCheckoutQuery?.invoice_payload);
    if (!parsed) {
      return next();
    }

    const authorization = await authorizeDmCheckoutForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      threadId: parsed.threadId,
      currency: ctx.preCheckoutQuery.currency,
      totalAmount: ctx.preCheckoutQuery.total_amount
    }).catch(() => ({ persistenceEnabled: true, authorized: false, blocked: true, reason: 'dm_checkout_authorization_failed' }));

    const ok = Boolean(authorization.authorized);
    await ctx.api.raw.answerPreCheckoutQuery({
      pre_checkout_query_id: ctx.preCheckoutQuery.id,
      ok,
      ...(ok ? {} : { error_message: formatDmRequestReason(authorization.reason, ctx.interfaceLanguage) })
    });
  });

  composer.on('message:successful_payment', async (ctx, next) => {
    const payment = ctx.message?.successful_payment;
    const parsed = parseDmInvoicePayload(payment?.invoice_payload);
    if (!parsed) {
      return next();
    }

    const result = await confirmDmPaymentForTelegramUser({
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username || null,
      threadId: parsed.threadId,
      telegramPaymentChargeId: payment.telegram_payment_charge_id,
      providerPaymentChargeId: payment.provider_payment_charge_id || null,
      currency: payment.currency,
      totalAmount: payment.total_amount
    }).catch((error) => ({
      persistenceEnabled: true,
      changed: false,
      duplicate: false,
      blocked: false,
      reason: String(error?.message || error),
      thread: null
    }));

    if (result.changed) {
      await recordLinkedInShareAttributionEventForTelegramUser({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username || null,
        targetProfileId: result.thread?.target_profile_id,
        eventType: 'request_submitted',
        telegramUpdateId: ctx.update?.update_id || null,
        entityType: 'dm_thread',
        entityId: result.thread?.dm_thread_id || parsed.threadId,
        detail: { contactKind: 'private_chat', paymentMode: 'telegram_stars' }
      }).catch(() => null);
      const russian = ctx.interfaceLanguage === 'ru';
      const disclosure = getTransactionDisclosures(ctx.interfaceLanguage).requestDeliveryPayment;
      await ctx.reply(russian
        ? `✅ Оплата подтверждена. Запрос в приватный чат доставлен. ${disclosure}`
        : `✅ Payment confirmed. Your private-chat request was delivered. ${disclosure}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: russian ? '💬 Приватные чаты' : '💬 Private chats', callback_data: 'dm:inbox' }],
            [{ text: russian ? '🧾 Открыть диалог' : '🧾 View thread', callback_data: `dm:view:${parsed.threadId}` }]
          ]
        }
      });
      return;
    }

    if (result.duplicate) {
      await ctx.reply(`ℹ️ ${formatDmRequestReason(result.reason, ctx.interfaceLanguage)}`);
      return;
    }

    await ctx.reply(`⚠️ ${formatUserFacingError(result.reason, 'The private-chat payment was received, but the request could not be finalized. Do not pay again. Contact support.', ctx.interfaceLanguage)}`);
  });

  return composer;
}
