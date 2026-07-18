export const PAID_CONTACT_MODE = 'paid_unlock_requires_approval';
export const REQUEST_DELIVERY_FEE_POLICY = 'request_delivery_fee_non_refundable_v1';
export const TELEGRAM_STARS_CURRENCY = 'XTR';
export const CONTACT_POLICY_SNAPSHOT = `${PAID_CONTACT_MODE}|${REQUEST_DELIVERY_FEE_POLICY}`;
export const CONTACT_RAIL_CALLBACK_PREFIX = 'dir:contact';

export function canOpenContactRequestRail(profileSnapshot = null) {
  return Boolean(
    profileSnapshot?.profile_id &&
    !profileSnapshot?.is_viewer &&
    [PAID_CONTACT_MODE, 'intro_request'].includes(profileSnapshot?.contact_mode)
  );
}

export function getContactRequestCoverageLabel({ pricingState = null, amountStars = 0 } = {}) {
  const subscriptionActive = Boolean(pricingState?.subscription?.isActive);
  const allowance = pricingState?.proOutreachAllowance || null;
  if (subscriptionActive && allowance?.supported && allowance?.allowed && Number(allowance?.remaining || 0) > 0) {
    return 'Included in Pro';
  }
  const amount = Number.isFinite(Number(amountStars)) ? Number(amountStars) : 0;
  return `${amount}⭐`;
}

export function canOpenPaidContactRail(profileSnapshot = null) {
  return Boolean(
    profileSnapshot?.profile_id &&
    !profileSnapshot?.is_viewer &&
    profileSnapshot?.contact_mode === PAID_CONTACT_MODE
  );
}

export function buildRequestFeeDisclosure({
  amountStars = 0,
  actionLabel = 'request',
  recipientName = 'this member'
} = {}) {
  const amount = Number.isFinite(Number(amountStars)) ? Number(amountStars) : 0;
  const safeAction = String(actionLabel || 'request').trim().slice(0, 48) || 'request';
  const safeRecipient = String(recipientName || 'this member').trim().slice(0, 32) || 'this member';
  const disclosure = [
    `${amount}⭐ pays to deliver this ${safeAction} to ${safeRecipient}.`,
    'Approval or reply is not guaranteed.',
    'The recipient may decline.',
    'No automatic refund is issued only because the request is declined or unanswered.'
  ].join(' ');
  if (disclosure.length <= 255) {
    return disclosure;
  }
  return `${amount}⭐ pays to deliver this permission request. Approval or reply is not guaranteed. The recipient may decline. No automatic refund is issued only because the request is declined or unanswered.`;
}

export function getTelegramStarsPaymentMismatchReason({
  currency,
  totalAmount,
  expectedAmount
} = {}) {
  if (String(currency || '').trim().toUpperCase() !== TELEGRAM_STARS_CURRENCY) {
    return 'payment_currency_mismatch';
  }
  const actual = Number.parseInt(String(totalAmount), 10);
  const expected = Number.parseInt(String(expectedAmount), 10);
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || actual !== expected) {
    return 'payment_amount_mismatch';
  }
  return null;
}

export function buildProFairUseDisclosure({ dailyLimit = 0 } = {}) {
  const limit = Number.isFinite(Number(dailyLimit)) ? Number(dailyLimit) : 0;
  return `Active Pro includes up to ${limit} combined contact-request deliveries per rolling 24 hours across private-chat and Telegram-contact options, subject to recipient cooldowns and abuse controls.`;
}
