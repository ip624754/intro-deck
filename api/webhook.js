import { getTelegramConfig } from '../src/config/env.js';
import { createBot } from '../src/bot/createBot.js';
import { claimWebhookUpdateReceipt } from '../src/lib/storage/runtimeGuardStore.js';
import { secretsMatch } from '../src/lib/crypto/secretCompare.js';

function readWebhookSecretHeader(req) {
  return req?.headers?.['x-telegram-bot-api-secret-token'] || req?.headers?.['X-Telegram-Bot-Api-Secret-Token'] || null;
}


const TELEGRAM_BOT_TOKEN_PATTERN = /\b\d{6,15}:[A-Za-z0-9_-]{20,}\b/g;
const TELEGRAM_BOT_URL_TOKEN_PATTERN = /(\/bot)\d{6,15}:[A-Za-z0-9_-]{20,}/g;

function redactWebhookLogText(value, maxLength = 4000) {
  if (value === null || value === undefined) return null;
  return String(value)
    .replace(TELEGRAM_BOT_TOKEN_PATTERN, '[REDACTED_TELEGRAM_BOT_TOKEN]')
    .replace(TELEGRAM_BOT_URL_TOKEN_PATTERN, '$1[REDACTED_TELEGRAM_BOT_TOKEN]')
    .slice(0, maxLength);
}

function readUpdateKind(update) {
  if (!update || typeof update !== 'object') return null;
  return Object.keys(update).find((key) => key !== 'update_id') || null;
}

export function buildSafeWebhookErrorLog(error, fallbackUpdateId = null) {
  const ctx = error?.ctx || null;
  const update = ctx?.update || null;
  const callbackData = ctx?.callbackQuery?.data || ctx?.callback_query?.data || ctx?.match || null;
  return {
    name: redactWebhookLogText(error?.name || 'Error', 120),
    message: redactWebhookLogText(error?.message || error || 'Unknown webhook error', 1000),
    stack: redactWebhookLogText(error?.stack || null),
    updateId: readUpdateId(update) ?? fallbackUpdateId,
    updateKind: readUpdateKind(update),
    callbackData: redactWebhookLogText(callbackData, 256)
  };
}

function readUpdateId(update) {
  const candidate = update?.update_id;
  return Number.isInteger(candidate) && candidate >= 0 ? candidate : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { webhookSecret } = getTelegramConfig();
  if (!webhookSecret) {
    return res.status(503).json({ ok: false, error: 'webhook_secret_not_configured' });
  }

  const providedSecret = readWebhookSecretHeader(req);
  if (!secretsMatch(webhookSecret, providedSecret)) {
    return res.status(401).json({ ok: false, error: 'invalid_webhook_secret' });
  }

  const updateId = readUpdateId(req.body);
  if (updateId === null) {
    return res.status(400).json({ ok: false, error: 'invalid_update_id' });
  }

  try {
    const receipt = await claimWebhookUpdateReceipt({ updateId }).catch((error) => {
      console.warn('[api/webhook] runtime guard degraded', error?.message || error);
      return {
        persistenceEnabled: false,
        accepted: true,
        duplicate: false,
        degraded: true,
        reason: 'runtime_guard_failed'
      };
    });

    if (receipt.duplicate) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const bot = await createBot();
    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true, dedupeDegraded: Boolean(receipt.degraded) });
  } catch (error) {
    console.error('[api/webhook] failed', buildSafeWebhookErrorLog(error, updateId));
    return res.status(500).json({ ok: false, error: 'webhook_failed' });
  }
}
