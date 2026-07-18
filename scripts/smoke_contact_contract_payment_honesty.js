import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import {
  buildProFairUseDisclosure,
  buildRequestFeeDisclosure,
  canOpenContactRequestRail,
  canOpenPaidContactRail,
  CONTACT_POLICY_SNAPSHOT,
  getTelegramStarsPaymentMismatchReason,
  PAID_CONTACT_MODE,
  REQUEST_DELIVERY_FEE_POLICY,
  TELEGRAM_STARS_CURRENCY
} from '../src/lib/contact/contract.js';
import { getContactPolicyConfig } from '../src/config/env.js';
import { renderContactRequestKeyboard, renderDirectoryCardKeyboard, renderPricingText } from '../src/lib/telegram/render.js';

const paidProfile = { profile_id: 42, is_viewer: false, contact_mode: PAID_CONTACT_MODE };
const introOnlyProfile = { profile_id: 43, is_viewer: false, contact_mode: 'intro_request' };

assert.equal(canOpenPaidContactRail(paidProfile), true);
assert.equal(canOpenPaidContactRail(introOnlyProfile), false);
assert.equal(canOpenPaidContactRail({ ...paidProfile, is_viewer: true }), false);
assert.equal(canOpenContactRequestRail(paidProfile), true);
assert.equal(canOpenContactRequestRail({ ...paidProfile, is_viewer: true }), false);

const paidKeyboard = JSON.stringify(renderDirectoryCardKeyboard({ profileSnapshot: paidProfile, page: 0 }));
assert.match(paidKeyboard, /dir:contact:42:0/);
assert.doesNotMatch(paidKeyboard, /dir:unlock:/);
assert.doesNotMatch(paidKeyboard, /dir:dm:/);
const paidOptions = JSON.stringify(renderContactRequestKeyboard({ profileSnapshot: paidProfile, pricingState: { profile: { linkedin_sub: 'viewer' }, pricing: { contactUnlockPriceStars: 75, dmOpenPriceStars: 100 } }, page: 0 }));
assert.match(paidOptions, /dir:unlock:42:0/);
assert.match(paidOptions, /dir:dm:42:0/);

const introKeyboard = JSON.stringify(renderDirectoryCardKeyboard({ profileSnapshot: introOnlyProfile, page: 0 }));
assert.match(introKeyboard, /dir:contact:43:0/);
assert.doesNotMatch(introKeyboard, /dir:unlock:/);
assert.doesNotMatch(introKeyboard, /dir:dm:/);

const disclosure = buildRequestFeeDisclosure({
  amountStars: 75,
  actionLabel: 'direct-contact permission request',
  recipientName: 'Alice'
});
assert.match(disclosure, /pays to deliver/i);
assert.match(disclosure, /not guaranteed/i);
assert.match(disclosure, /may decline/i);
assert.match(disclosure, /No automatic refund/i);
assert.ok(disclosure.length <= 255, `Telegram invoice description too long: ${disclosure.length}`);
const longestDisclosure = buildRequestFeeDisclosure({
  amountStars: 100,
  actionLabel: 'x'.repeat(300),
  recipientName: 'y'.repeat(300)
});
assert.ok(longestDisclosure.length <= 255, `Worst-case Telegram invoice description too long: ${longestDisclosure.length}`);
assert.equal(getTelegramStarsPaymentMismatchReason({ currency: TELEGRAM_STARS_CURRENCY, totalAmount: 75, expectedAmount: 75 }), null);
assert.equal(getTelegramStarsPaymentMismatchReason({ currency: 'USD', totalAmount: 75, expectedAmount: 75 }), 'payment_currency_mismatch');
assert.equal(getTelegramStarsPaymentMismatchReason({ currency: TELEGRAM_STARS_CURRENCY, totalAmount: 74, expectedAmount: 75 }), 'payment_amount_mismatch');

const policy = getContactPolicyConfig();
assert.deepEqual(policy, {
  proOutreachDailyLimit: 10,
  retryCooldownDays: 30,
  checkoutAuthorizationTtlMinutes: 30,
  checkoutRetryLockSeconds: 1800
});
assert.match(buildProFairUseDisclosure({ dailyLimit: policy.proOutreachDailyLimit }), /rolling 24 hours/i);

const pricingText = renderPricingText({
  pricingState: {
    persistenceEnabled: true,
    pricing: { proMonthlyPriceStars: 149, contactUnlockPriceStars: 75, dmOpenPriceStars: 100 },
    subscriptionConfig: { proMonthlyDurationDays: 30 },
    contactPolicy: policy,
    proOutreachAllowance: { supported: true, allowed: true, used: 3, remaining: 7, limit: 10 },
    subscription: { isActive: true, expiresAt: '2026-08-17T00:00:00.000Z' },
    recentReceipts: []
  }
});
assert.match(pricingText, /bounded fair-use allowance/i);
assert.match(pricingText, /3\/10 used/i);
assert.match(pricingText, /Recipient approval is always required/i);
assert.match(pricingText, /does not trigger an automatic refund/i);

const sources = {
  contactPolicyRepo: fs.readFileSync(new URL('../src/db/contactPolicyRepo.js', import.meta.url), 'utf8'),
  contactRepo: fs.readFileSync(new URL('../src/db/contactUnlockRepo.js', import.meta.url), 'utf8'),
  dmRepo: fs.readFileSync(new URL('../src/db/dmRepo.js', import.meta.url), 'utf8'),
  monetizationRepo: fs.readFileSync(new URL('../src/db/monetizationRepo.js', import.meta.url), 'utf8'),
  contactStore: fs.readFileSync(new URL('../src/lib/storage/contactUnlockStore.js', import.meta.url), 'utf8'),
  dmStore: fs.readFileSync(new URL('../src/lib/storage/dmStore.js', import.meta.url), 'utf8'),
  contactComposer: fs.readFileSync(new URL('../src/bot/composers/contactUnlockComposer.js', import.meta.url), 'utf8'),
  dmComposer: fs.readFileSync(new URL('../src/bot/composers/dmComposer.js', import.meta.url), 'utf8'),
  monetizationStore: fs.readFileSync(new URL('../src/lib/storage/monetizationStore.js', import.meta.url), 'utf8'),
  monetizationComposer: fs.readFileSync(new URL('../src/bot/composers/monetizationComposer.js', import.meta.url), 'utf8'),
  migration: fs.readFileSync(new URL('../migrations/027_contact_contract_payment_honesty.sql', import.meta.url), 'utf8'),
  terms: fs.readFileSync(new URL('../terms/index.html', import.meta.url), 'utf8')
};

for (const [name, source] of Object.entries(sources)) {
  assert.ok(source.length > 0, `${name} source must be readable`);
}

assert.match(sources.contactPolicyRepo, /pg_advisory_xact_lock/);
assert.match(sources.contactPolicyRepo, /pair_blocked/);
assert.match(sources.contactPolicyRepo, /union all/);
assert.match(sources.contactRepo, /target\.contact_mode !== PAID_CONTACT_MODE/);
assert.match(sources.dmRepo, /target\.contact_mode !== PAID_CONTACT_MODE/);
assert.match(sources.contactRepo, /authorizeContactUnlockCheckout/);
assert.match(fs.readFileSync(new URL('../src/config/env.js', import.meta.url), 'utf8'), /Math\.max\(configuredCheckoutRetryLockSeconds, checkoutAuthorizationTtlMinutes \* 60\)/);
assert.match(sources.contactRepo, /getTelegramStarsPaymentMismatchReason/);
assert.match(sources.dmRepo, /authorizeDmCheckout/);
assert.match(sources.dmRepo, /getTelegramStarsPaymentMismatchReason/);
assert.match(sources.dmRepo, /retryAvailableAt/);
assert.match(sources.monetizationRepo, /pg_advisory_xact_lock/);
assert.match(sources.monetizationRepo, /getProOutreachAllowance/);
assert.match(sources.contactStore, /payment_charge_replay_detected/);
const contactBeginStart = sources.contactStore.indexOf('export async function beginContactUnlockPaymentForTelegramUser');
const contactBeginEnd = sources.contactStore.indexOf('export async function authorizeContactUnlockCheckoutForTelegramUser', contactBeginStart);
const contactBeginSource = sources.contactStore.slice(contactBeginStart, contactBeginEnd);
assert.ok(contactBeginSource.indexOf('getProOutreachAllowance') < contactBeginSource.indexOf('createOrGetContactUnlockRequest'), 'Direct-contact Pro lock must be acquired before the pair lock path');
assert.match(sources.dmStore, /payment_charge_replay_detected/);
assert.match(sources.dmStore, /getContactPairRestriction/);
assert.match(sources.contactComposer, /authorizeContactUnlockCheckoutForTelegramUser/);
assert.match(sources.dmComposer, /authorizeDmCheckoutForTelegramUser/);
assert.match(sources.monetizationStore, /authorizeProCheckoutForTelegramUser/);
assert.match(sources.monetizationStore, /paidAmountStars/);
assert.match(sources.monetizationComposer, /authorizeProCheckoutForTelegramUser/);
assert.match(sources.migration, /contact_unlock_events/);
assert.match(sources.migration, /pro_covered/);
assert.match(sources.migration, /checkout_authorized_at/);
assert.match(sources.migration, /to_regclass/);
assert.match(sources.migration, /duplicate DM Telegram payment charge IDs/);
assert.match(sources.terms, /purchases delivery of a permission request/i);
assert.match(sources.terms, /does not provide unlimited outreach/i);

assert.equal(CONTACT_POLICY_SNAPSHOT, `${PAID_CONTACT_MODE}|${REQUEST_DELIVERY_FEE_POLICY}`);

console.log('OK: STEP053 contact contract and payment honesty');
