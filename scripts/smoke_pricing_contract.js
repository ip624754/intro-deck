import { readFileSync } from 'node:fs';
import { renderPricingText } from '../src/lib/telegram/render.js';

const envSource = readFileSync(new URL('../src/config/env.js', import.meta.url), 'utf8');
for (const fragment of ['PRO_MONTHLY_PRICE_STARS', 'PRO_MONTHLY_DURATION_DAYS', 'getPricingConfig', 'getSubscriptionConfig', 'pricingConfigured']) {
  if (!envSource.includes(fragment)) {
    throw new Error(`Env pricing contract missing ${fragment}`);
  }
}

const monetizationStoreSource = readFileSync(new URL('../src/lib/storage/monetizationStore.js', import.meta.url), 'utf8');
for (const fragment of ['buildProInvoicePayload', 'parseProInvoicePayload', 'confirmProSubscriptionPaymentForTelegramUser', 'getProSubscriptionInvoiceForTelegramUser']) {
  if (!monetizationStoreSource.includes(fragment)) {
    throw new Error(`Monetization store missing ${fragment}`);
  }
}

const composerSource = readFileSync(new URL('../src/bot/composers/monetizationComposer.js', import.meta.url), 'utf8');
for (const fragment of ['command(\'plans\'', 'plans:buy:pro', 'pre_checkout_query', 'message:successful_payment']) {
  if (!composerSource.includes(fragment)) {
    throw new Error(`Monetization composer missing ${fragment}`);
  }
}

const renderSource = readFileSync(new URL('../src/lib/telegram/render.js', import.meta.url), 'utf8');
for (const fragment of ['renderPricingText', 'renderPricingKeyboard']) {
  if (!renderSource.includes(fragment)) {
    throw new Error(`Render pricing contract missing ${fragment}`);
  }
}
const pricingText = renderPricingText({
  persistenceEnabled: true,
  pricingState: {
    pricing: { proMonthlyPriceStars: 149, contactUnlockPriceStars: 75, dmOpenPriceStars: 100 },
    subscription: { isActive: false },
    proOutreachAllowance: { supported: true, limit: 10, used: 0, remaining: 10 }
  }
});
if (!pricingText.includes('⭐ Intro Deck Pro')) {
  throw new Error('Rendered Pro surface missing canonical title');
}

console.log('OK: pricing contract');
