import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  computeProfileCompletion,
  getProfileActivationNextAction,
  getProfileActivationState
} from '../src/lib/profile/contract.js';
import {
  renderHomeKeyboard,
  renderProfileMenuKeyboard,
  renderProfileMenuText,
  renderProfileOptionalKeyboard,
  renderProfileOptionalText,
  renderProfilePreviewKeyboard,
  renderProfilePreviewText,
  renderProfileSavedKeyboard,
  renderProfileSavedNotice
} from '../src/lib/telegram/render.js';

function withCompletion(profile) {
  return {
    ...profile,
    completion: computeProfileCompletion(profile)
  };
}

const disconnected = withCompletion({ skills: [], visibility_status: 'hidden' });
const disconnectedActivation = getProfileActivationState(disconnected);
assert.equal(disconnectedActivation.completedCount, 0);
assert.equal(disconnectedActivation.totalCount, 6);
assert.equal(getProfileActivationNextAction(disconnected).kind, 'linkedin');

const seededDraft = withCompletion({
  linkedin_sub: 'linkedin-sub',
  linkedin_name: 'Rustam',
  display_name: 'Rustam',
  skills: [],
  visibility_status: 'hidden',
  contact_mode: 'intro_request'
});
const seededActivation = getProfileActivationState(seededDraft);
assert.equal(seededActivation.completedCount, 2);
assert.equal(seededActivation.nextStep?.fieldKey, 'hl');
assert.equal(getProfileActivationNextAction(seededDraft).callbackData, 'p:ed:hl');

const fieldsComplete = withCompletion({
  ...seededDraft,
  headline_user: 'Founder',
  industry_user: 'B2B SaaS',
  about_user: 'I build Telegram-first products.',
  company_user: null,
  city_user: null,
  linkedin_public_url: null,
  telegram_username_hidden: null,
  skills: []
});
const fieldsActivation = getProfileActivationState(fieldsComplete);
assert.equal(fieldsActivation.completedCount, 5);
assert.equal(fieldsActivation.nextStep?.kind, 'skills');
assert.equal(getProfileActivationNextAction(fieldsComplete).callbackData, 'p:sk');

const readyHidden = withCompletion({
  ...fieldsComplete,
  skills: [{ skill_slug: 'founder', skill_label: 'Founder' }],
  visibility_status: 'hidden'
});
const readyActivation = getProfileActivationState(readyHidden);
assert.equal(readyActivation.completedCount, 6);
assert.equal(readyActivation.isReady, true);
assert.equal(readyActivation.needsPreview, true);
assert.equal(getProfileActivationNextAction(readyHidden).kind, 'preview');

const readyListed = withCompletion({ ...readyHidden, visibility_status: 'listed' });
assert.equal(getProfileActivationNextAction(readyListed).kind, 'listed_preview');

const menuText = renderProfileMenuText({ profileSnapshot: seededDraft, persistenceEnabled: true });
assert.match(menuText, /Profile setup/);
assert.match(menuText, /Setup progress: 2\/6 required steps/);
assert.match(menuText, /Next required step: Add headline/);
assert.match(menuText, /Optional details and contact settings are kept on a separate screen/);

const menuButtons = renderProfileMenuKeyboard({ profileSnapshot: seededDraft, persistenceEnabled: true }).inline_keyboard.flat();
assert.ok(menuButtons.some((button) => button.callback_data === 'p:next'));
assert.ok(menuButtons.some((button) => button.callback_data === 'p:opt'));
for (const optionalCallback of ['p:ed:co', 'p:ed:ci', 'p:ed:li', 'p:ed:tg', 'p:cm']) {
  assert.ok(!menuButtons.some((button) => button.callback_data === optionalCallback), `main setup screen must not expose optional callback ${optionalCallback}`);
}

const optionalText = renderProfileOptionalText({ profileSnapshot: seededDraft, persistenceEnabled: true });
assert.match(optionalText, /not required to publish/);
assert.match(optionalText, /Hidden Telegram username stays private/);
const optionalButtons = renderProfileOptionalKeyboard({ profileSnapshot: seededDraft, persistenceEnabled: true }).inline_keyboard.flat();
for (const optionalCallback of ['p:ed:co', 'p:ed:ci', 'p:ed:li', 'p:ed:tg', 'p:cm']) {
  assert.ok(optionalButtons.some((button) => button.callback_data === optionalCallback), `optional screen missing ${optionalCallback}`);
}

const incompletePreviewText = renderProfilePreviewText({ profileSnapshot: seededDraft, persistenceEnabled: true });
assert.match(incompletePreviewText, /Publishing remains locked/);
const incompletePreviewButtons = renderProfilePreviewKeyboard({ profileSnapshot: seededDraft, persistenceEnabled: true }).inline_keyboard.flat();
assert.ok(incompletePreviewButtons.some((button) => button.callback_data === 'p:next'));
assert.ok(!incompletePreviewButtons.some((button) => button.callback_data === 'p:pub'));

const readyPreviewButtons = renderProfilePreviewKeyboard({ profileSnapshot: readyHidden, persistenceEnabled: true }).inline_keyboard.flat();
assert.ok(readyPreviewButtons.some((button) => button.callback_data === 'p:pub'));
assert.ok(!readyPreviewButtons.some((button) => button.callback_data === 'p:vis'));
const listedPreviewButtons = renderProfilePreviewKeyboard({ profileSnapshot: readyListed, persistenceEnabled: true }).inline_keyboard.flat();
assert.ok(listedPreviewButtons.some((button) => button.callback_data === 'p:vis'));
assert.ok(!listedPreviewButtons.some((button) => button.callback_data === 'p:pub'));

const savedNotice = renderProfileSavedNotice({ fieldLabel: 'Display name', profileSnapshot: seededDraft });
assert.match(savedNotice, /Next required step: Add headline/);
const savedButtons = renderProfileSavedKeyboard({ profileSnapshot: seededDraft }).inline_keyboard.flat();
assert.ok(savedButtons.some((button) => button.callback_data === 'p:next'));

const homeButtons = renderHomeKeyboard({
  appBaseUrl: 'https://example.com',
  telegramUserId: 1,
  profileSnapshot: seededDraft,
  persistenceEnabled: true
}).inline_keyboard.flat();
assert.ok(homeButtons.some((button) => button.callback_data === 'p:next' && button.text.includes('Continue setup')));

const profileComposerSource = fs.readFileSync(new URL('../src/bot/composers/profileComposer.js', import.meta.url), 'utf8');
const textComposerSource = fs.readFileSync(new URL('../src/bot/composers/textComposer.js', import.meta.url), 'utf8');
const profileStoreSource = fs.readFileSync(new URL('../src/lib/storage/profileEditStore.js', import.meta.url), 'utf8');
const createBotSource = fs.readFileSync(new URL('../src/bot/createBot.js', import.meta.url), 'utf8');

assert.match(profileComposerSource, /callbackQuery\('p:next'/);
assert.match(profileComposerSource, /callbackQuery\('p:pub'/);
assert.match(profileComposerSource, /visibilityStatus: 'listed'/);
assert.match(profileComposerSource, /callbackQuery\('p:vis'/);
assert.match(profileComposerSource, /visibilityStatus: 'hidden'/);
assert.match(profileComposerSource, /safeEditOrReply\(ctx, renderProfileInputPrompt/);
assert.match(textComposerSource, /renderProfileSavedKeyboard/);
assert.match(profileStoreSource, /export async function setProfileVisibilityForTelegramUser/);
assert.match(createBotSource, /buildProfileOptionalSurface: surfaces\.buildProfileOptionalSurface/);

console.log('OK: STEP055 guided activation spine contract');
