import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  renderContactInboxKeyboard,
  renderContactInboxText,
  renderContactRequestKeyboard,
  renderContactRequestText,
  renderDirectoryCardKeyboard,
  renderHelpKeyboard,
  renderHelpText,
  renderHomeKeyboard
} from '../src/lib/telegram/render.js';

const paidProfile = {
  profile_id: 42,
  display_name: 'Paid Member',
  headline_user: 'Founder',
  contact_mode: 'paid_unlock_requires_approval',
  is_viewer: false
};
const introProfile = { ...paidProfile, profile_id: 43, display_name: 'Intro Member', contact_mode: 'intro_request' };
const pricingState = {
  persistenceEnabled: true,
  profile: { linkedin_sub: 'viewer-sub' },
  pricing: { contactUnlockPriceStars: 75, dmOpenPriceStars: 100 },
  subscription: { isActive: false },
  proOutreachAllowance: { supported: true, allowed: false, remaining: 0 }
};

const paidCard = JSON.stringify(renderDirectoryCardKeyboard({ profileSnapshot: paidProfile, page: 2 }));
assert.match(paidCard, /dir:contact:42:2/);
assert.doesNotMatch(paidCard, /dir:unlock:/);
assert.doesNotMatch(paidCard, /dir:dm:/);
assert.doesNotMatch(paidCard, /dir:intro:/);

const introCard = JSON.stringify(renderDirectoryCardKeyboard({ profileSnapshot: introProfile, page: 1 }));
assert.match(introCard, /dir:contact:43:1/);
assert.doesNotMatch(introCard, /dir:intro:/);

const paidText = renderContactRequestText({ profileSnapshot: paidProfile, pricingState, persistenceEnabled: true });
assert.match(paidText, /Private chat • 100⭐/);
assert.match(paidText, /Telegram contact • 75⭐/);
assert.match(paidText, /request delivery only/i);
const paidOptions = JSON.stringify(renderContactRequestKeyboard({ profileSnapshot: paidProfile, pricingState, page: 2 }));
assert.match(paidOptions, /dir:dm:42:2/);
assert.match(paidOptions, /dir:unlock:42:2/);

const introText = renderContactRequestText({ profileSnapshot: introProfile, pricingState, persistenceEnabled: true });
assert.match(introText, /Free intro request/);
const introOptions = JSON.stringify(renderContactRequestKeyboard({ profileSnapshot: introProfile, pricingState, page: 1 }));
assert.match(introOptions, /dir:intro:43:1/);
assert.doesNotMatch(introOptions, /dir:dm:/);
assert.doesNotMatch(introOptions, /dir:unlock:/);

const proState = {
  ...pricingState,
  subscription: { isActive: true },
  proOutreachAllowance: { supported: true, allowed: true, remaining: 4 }
};
const proOptions = JSON.stringify(renderContactRequestKeyboard({ profileSnapshot: paidProfile, pricingState: proState, page: 0 }));
assert.match(proOptions, /Included in Pro/);

assert.match(JSON.stringify(renderHomeKeyboard({ persistenceEnabled: true, profileSnapshot: { linkedin_sub: 'x', completion: { isReady: true }, visibility_status: 'listed' } })), /contact:inbox/);
assert.match(renderHelpText(), /find professionals and connect by permission/i);
assert.match(JSON.stringify(renderHelpKeyboard()), /contact:inbox/);
assert.match(renderContactInboxText(), /Review contact requests and continue approved private conversations/);
assert.match(JSON.stringify(renderContactInboxKeyboard()), /intro:inbox/);
assert.match(JSON.stringify(renderContactInboxKeyboard()), /dm:inbox/);

const directoryComposer = fs.readFileSync(new URL('../src/bot/composers/directoryComposer.js', import.meta.url), 'utf8');
assert.match(directoryComposer, /dir:contact/);
assert.match(directoryComposer, /contact:inbox/);
const contactComposer = fs.readFileSync(new URL('../src/bot/composers/contactUnlockComposer.js', import.meta.url), 'utf8');
const dmComposer = fs.readFileSync(new URL('../src/bot/composers/dmComposer.js', import.meta.url), 'utf8');
assert.match(contactComposer, /dir:unlock/);
assert.match(dmComposer, /dir:dm/);

console.log('OK: STEP056 core contact rail simplification');
