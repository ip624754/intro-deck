import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  renderPricingText,
  renderPricingKeyboard,
  renderProfileInputPrompt,
  renderProfileInputKeyboard,
  renderDirectoryListText,
  renderDirectoryCardText,
  renderDirectoryCardKeyboard,
  renderDmInboxText,
  renderDmInboxKeyboard,
  renderDmThreadText,
  renderDmThreadKeyboard,
  renderInviteText,
  renderInviteKeyboard,
  renderInvitePerformanceText,
  renderInvitePerformanceKeyboard,
  renderInviteRewardsText,
  renderInviteRewardsKeyboard,
  renderInvitePublicCaption,
  renderInviteCardText
} from '../src/lib/telegram/render.js';
import {
  renderAiNewsHubText,
  renderAiNewsHubKeyboard,
  renderAiNewsAudienceText,
  renderAiNewsAudienceKeyboard,
  renderAiNewsAngleText,
  renderAiNewsAngleKeyboard
} from '../src/lib/telegram/aiNewsRender.js';
import {
  localizeMemberKeyboard,
  localizeMemberSurface,
  localizeMemberText
} from '../src/lib/telegram/memberLocalization.js';
import { TRANSACTION_DISCLOSURES } from '../src/lib/telegram/transactionCopy.js';

assert.ok(['STEP064B4B', 'STEP064B4C', 'STEP064B4C1'].includes(CURRENT_SOURCE_STEP));

function callbackContract(replyMarkup) {
  return (replyMarkup?.inline_keyboard || []).flat().map((button) => ({
    callback_data: button.callback_data || null,
    url: button.url || null,
    switch_inline_query: button.switch_inline_query || null
  }));
}

function localized(text, keyboard = null) {
  return {
    text: localizeMemberText(text, 'ru'),
    reply_markup: keyboard ? localizeMemberKeyboard(keyboard, 'ru') : null
  };
}

const pricingState = {
  persistenceEnabled: true,
  pricing: { proMonthlyPriceStars: 149, contactUnlockPriceStars: 75, dmOpenPriceStars: 100 },
  subscriptionConfig: { proMonthlyDurationDays: 30 },
  contactPolicy: { proOutreachDailyLimit: 10 },
  aiNewsConfig: { mode: 'pro', dailyLimit: 3, presetLimit: 3 }
};
const pricingText = renderPricingText({ pricingState });
assert.equal(localizeMemberText(pricingText, 'en'), pricingText, 'English rendering must stay byte-identical');
const ruPricing = localizeMemberText(pricingText, 'ru');
assert.match(ruPricing, /Лимиты использования/);
assert.match(ruPricing, /Активный Pro включает до 10 доставок/);
assert.doesNotMatch(ruPricing, /Active Pro includes|Fair use/);
const pricingKeyboard = renderPricingKeyboard({ pricingState });
assert.deepEqual(callbackContract(localizeMemberKeyboard(pricingKeyboard, 'ru')), callbackContract(pricingKeyboard));

const profilePrompt = localizeMemberText(renderProfileInputPrompt({
  fieldKey: 'dn',
  profileSnapshot: { display_name: 'Rustam' }
}), 'ru');
assert.match(profilePrompt, /Редактировать: Имя/);
assert.match(profilePrompt, /Отправьте имя для карточки/);
assert.doesNotMatch(profilePrompt, /Display name|Send the display name/);
assert.deepEqual(
  callbackContract(localizeMemberKeyboard(renderProfileInputKeyboard(), 'ru')),
  callbackContract(renderProfileInputKeyboard())
);

const filters = {
  textQuery: 'ai', textQueryLabel: 'ai',
  cityQuery: 'London', cityQueryLabel: 'London',
  industryBucket: 'saas', industryLabel: 'B2B SaaS',
  skillSlugs: ['founder'], skillLabels: ['Founder'],
  isDefault: false
};
const directoryText = localizeMemberText(renderDirectoryListText({
  profiles: [{ profile_id: 1, display_name: 'Alice', headline_user: 'Founder' }],
  page: 0,
  totalCount: 1,
  persistenceEnabled: true,
  filterSummary: filters
}), 'ru');
assert.match(directoryText, /Каталог/);
assert.match(directoryText, /Поиск: ai/);
assert.match(directoryText, /Профилей: 1/);
assert.doesNotMatch(directoryText, /Browse published|Search: ai|Profiles: 1/);

const profileSnapshot = {
  profile_id: 1,
  display_name: 'Alice',
  headline_user: 'Founder',
  company_user: 'Acme',
  city_user: 'London',
  industry_user: 'B2B SaaS',
  skills: [{ skill_label: 'Founder' }],
  about_user: 'Builds AI products.',
  contact_mode: 'paid_unlock_requires_approval',
  linkedin_public_url: 'https://www.linkedin.com/in/alice'
};
const cardText = localizeMemberText(renderDirectoryCardText({ profileSnapshot, persistenceEnabled: true }), 'ru');
assert.match(cardText, /Публичная ссылка LinkedIn: https:\/\/www\.linkedin\.com\/in\/alice/);
assert.match(cardText, /требуется одобрение получателя/);
assert.match(cardText, /Builds AI products\./, 'member-provided content must not be translated');
const directoryKeyboard = renderDirectoryCardKeyboard({ profileSnapshot });
const localizedDirectoryKeyboard = localizeMemberKeyboard(directoryKeyboard, 'ru');
assert.deepEqual(callbackContract(localizedDirectoryKeyboard), callbackContract(directoryKeyboard));
assert.match(JSON.stringify(localizedDirectoryKeyboard), /Варианты связи/);

const inboxState = {
  counts: { received_pending: 1, received_total: 2, sent_pending: 1, sent_total: 3, active_total: 1 },
  received: [],
  sent: []
};
const dmInbox = localizeMemberText(renderDmInboxText({ persistenceEnabled: true, inboxState }), 'ru');
assert.match(dmInbox, /1\/2 ожидают\/всего/);
assert.doesNotMatch(dmInbox, /pending\/total/);
const dmInboxKeyboard = renderDmInboxKeyboard({ inboxState });
assert.deepEqual(callbackContract(localizeMemberKeyboard(dmInboxKeyboard, 'ru')), callbackContract(dmInboxKeyboard));

const dmThread = {
  dm_thread_id: 7,
  role: 'sent',
  display_name: 'Alice',
  headline_user: 'Founder',
  status: 'payment_pending',
  payment_state: 'unpaid',
  price_stars_snapshot: 100,
  pro_covered: false,
  created_at: '2026-07-24T00:00:00Z',
  first_message: 'Hello from a member'
};
const dmText = localizeMemberText(renderDmThreadText({ persistenceEnabled: true, thread: dmThread, viewerTelegramUserId: 1 }), 'ru');
assert.match(dmText, /Статус: ожидает оплаты/);
assert.match(dmText, /Оплата: не оплачено/);
assert.match(dmText, /Payment covers delivery/, 'transaction disclosure remains intentionally deferred to STEP064B4C');
const dmKeyboard = renderDmThreadKeyboard({ thread: dmThread });
assert.deepEqual(callbackContract(localizeMemberKeyboard(dmKeyboard, 'ru')), callbackContract(dmKeyboard));

const inviteState = {
  persistenceEnabled: true,
  invitedCount: 2,
  activatedCount: 1,
  joined7d: 2,
  activated7d: 1,
  inlineShareCount: 1,
  rawLinkCount: 1,
  inviteCardCount: 0
};
const inviteText = localizeMemberText(renderInviteText({ inviteState }), 'ru');
assert.match(inviteText, /Приглашено: 2/);
assert.match(inviteText, /Активировано: 1/);
const invitePerformance = localizeMemberText(renderInvitePerformanceText({ inviteState }), 'ru');
assert.match(invitePerformance, /За всё время/);
assert.match(invitePerformance, /Доля активаций/);
assert.match(invitePerformance, /По источникам/);
assert.doesNotMatch(invitePerformance, /All-time|By source|Activation rate/);
const inviteKeyboard = renderInviteKeyboard({ inviteState });
assert.deepEqual(callbackContract(localizeMemberKeyboard(inviteKeyboard, 'ru')), callbackContract(inviteKeyboard));
const performanceKeyboard = renderInvitePerformanceKeyboard({ inviteState });
assert.deepEqual(callbackContract(localizeMemberKeyboard(performanceKeyboard, 'ru')), callbackContract(performanceKeyboard));

const rewardsState = {
  persistenceEnabled: true,
  summary: { pendingPoints: 1, availablePoints: 2, redeemedPoints: 3, mode: 'off', config: { activationConfirmHours: 24 } },
  activationHint: 'the invited member connected LinkedIn and reached listed-ready state',
  recentEvents: []
};
const rewardsText = localizeMemberText(renderInviteRewardsText({ rewardsState }), 'ru');
assert.match(rewardsText, /Режим: выключен/);
assert.match(rewardsText, /приглашённый участник подключил LinkedIn/);
assert.doesNotMatch(rewardsText, /Mode: off|the invited member connected/);
const rewardsKeyboard = renderInviteRewardsKeyboard({ rewardsState });
assert.deepEqual(callbackContract(localizeMemberKeyboard(rewardsKeyboard, 'ru')), callbackContract(rewardsKeyboard));

const storyState = {
  eligible: true,
  preferences: {
    preset_key: 'for_you',
    audience_key: 'founders_executives',
    angle_key: 'expert_take',
    post_language: 'en',
    tone: 'professional'
  },
  personalization: { available: true },
  config: { generator: { mode: 'off' }, searchDailyLimit: 10, presetLimit: 3 },
  searchUsage: { remaining: 9, limit: 10 },
  presetUsage: { used: 0, limit: 3 },
  presets: [],
  presetPersistenceReady: true
};
const storyText = localizeMemberText(renderAiNewsHubText({ state: storyState }), 'ru');
assert.match(storyText, /Тема: Для вас/);
assert.match(storyText, /Аудитория: Основатели и руководители/);
assert.match(storyText, /Ракурс: Экспертный взгляд/);
assert.doesNotMatch(storyText, /Topic:|Audience:|Angle:/);
const storyKeyboard = renderAiNewsHubKeyboard({ state: storyState });
const ruStoryKeyboard = localizeMemberKeyboard(storyKeyboard, 'ru');
assert.deepEqual(callbackContract(ruStoryKeyboard), callbackContract(storyKeyboard));
assert.match(JSON.stringify(ruStoryKeyboard), /ИИ и технологии/);
assert.match(JSON.stringify(ruStoryKeyboard), /Основатели и руководители/);

const audienceText = localizeMemberText(renderAiNewsAudienceText({ preferences: storyState.preferences }), 'ru');
assert.match(audienceText, /Выбрано: Основатели и руководители/);
const audienceKeyboard = renderAiNewsAudienceKeyboard({ preferences: storyState.preferences });
assert.deepEqual(callbackContract(localizeMemberKeyboard(audienceKeyboard, 'ru')), callbackContract(audienceKeyboard));
const angleText = localizeMemberText(renderAiNewsAngleText({ preferences: storyState.preferences }), 'ru');
assert.match(angleText, /Выберите профессиональный ракурс/);
const angleKeyboard = renderAiNewsAngleKeyboard({ preferences: storyState.preferences });
assert.deepEqual(callbackContract(localizeMemberKeyboard(angleKeyboard, 'ru')), callbackContract(angleKeyboard));

const sampleSurface = { text: '🌐 Directory', reply_markup: { inline_keyboard: [[{ text: '🏠 Home', callback_data: 'home:root' }]] } };
assert.deepEqual(localizeMemberSurface(sampleSurface, 'en'), sampleSurface);
assert.deepEqual(callbackContract(localizeMemberSurface(sampleSurface, 'ru').reply_markup), callbackContract(sampleSurface.reply_markup));

assert.match(TRANSACTION_DISCLOSURES.requestDeliveryPayment, /Payment covers delivery/);
assert.match(renderInvitePublicCaption(), /Discover professionals/);
assert.match(renderInviteCardText(), /Discover professionals/);

const createBotSource = readFileSync(new URL('../src/bot/createBot.js', import.meta.url), 'utf8');
assert.match(createBotSource, /createLanguageContextMiddleware/);
assert.match(createBotSource, /createLocalizedSurfaceBuilders/);
const localizedBuildersSource = readFileSync(new URL('../src/bot/surfaces/localizedSurfaceBuilders.js', import.meta.url), 'utf8');
for (const surface of ['buildDirectoryListSurface', 'buildContactInboxSurface', 'buildDmThreadSurface', 'buildInvitePerformanceSurface', 'buildPricingSurface']) {
  assert.match(localizedBuildersSource, new RegExp(surface));
}
const adminSource = readFileSync(new URL('../src/bot/surfaces/adminSurfaces.js', import.meta.url), 'utf8');
assert.doesNotMatch(adminSource, /localizeMemberSurface|memberLocalization/, 'admin Russian boundary must remain independent');

console.log('OK: STEP064B4B member interface language rendering');
