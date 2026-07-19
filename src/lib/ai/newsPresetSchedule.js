export const AI_NEWS_SCHEDULE_KINDS = Object.freeze(['manual', 'daily', 'weekdays']);
export const AI_NEWS_DELIVERY_HOURS_UTC = Object.freeze([6, 9, 12, 15, 18, 21]);

export function normalizeScheduleKind(value, fallback = 'manual') {
  const normalized = String(value || '').trim().toLowerCase();
  return AI_NEWS_SCHEDULE_KINDS.includes(normalized) ? normalized : fallback;
}

export function normalizeDeliveryHourUtc(value, fallback = 9) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) {
    throw new Error('delivery_hour_utc must be between 0 and 23');
  }
  return parsed;
}

export function normalizePresetName(value, fallback = 'News preset') {
  const normalized = String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error('preset_name_length_invalid');
  }
  return normalized;
}

function nextUtcHour({ from, hour }) {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hour);
  if (next.getTime() <= from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export function computeNextPresetRunAt({ scheduleKind, deliveryHourUtc, from = new Date() }) {
  const kind = normalizeScheduleKind(scheduleKind);
  if (kind === 'manual') return null;
  const hour = normalizeDeliveryHourUtc(deliveryHourUtc);
  const next = nextUtcHour({ from: new Date(from), hour });
  if (kind === 'weekdays') {
    while ([0, 6].includes(next.getUTCDay())) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  }
  return next;
}

export function buildPresetName({ presetKey, customQuery, postLanguage, tone }) {
  const topicLabels = {
    ai_technology: 'AI & Technology',
    business_growth: 'Business & Growth',
    crypto_web3: 'Crypto & Web3',
    custom: String(customQuery || 'Custom topic').trim()
  };
  const topic = topicLabels[presetKey] || 'News';
  const language = String(postLanguage || 'en').toUpperCase();
  const toneLabel = String(tone || 'professional').replace(/^./, (letter) => letter.toUpperCase());
  return normalizePresetName(`${topic} · ${language} · ${toneLabel}`.slice(0, 80));
}

export function scheduleLabel({ scheduleKind, deliveryHourUtc }) {
  const kind = normalizeScheduleKind(scheduleKind);
  if (kind === 'manual') return 'Manual only';
  const hour = String(normalizeDeliveryHourUtc(deliveryHourUtc)).padStart(2, '0');
  return `${kind === 'weekdays' ? 'Weekdays' : 'Daily'} at ${hour}:00 UTC`;
}
