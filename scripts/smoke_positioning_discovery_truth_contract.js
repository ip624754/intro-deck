import fs from 'node:fs';
import path from 'node:path';
import {
  renderDirectoryCardText,
  renderDirectoryListText,
  renderHelpText,
  renderHomeText,
  renderInlineInviteCaption,
  renderProfileMenuText
} from '../src/lib/telegram/render.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';

const root = process.cwd();
const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const read = (relativePath) => normalize(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const homeText = renderHomeText({
  persistenceEnabled: true,
  profileSnapshot: null,
  directoryStats: { totalCount: 0 },
  introInboxStats: { receivedPending: 0, sentPending: 0 }
});
const helpText = renderHelpText();
const directoryText = renderDirectoryListText({
  persistenceEnabled: true,
  profiles: [{ profile_id: 1, display_name: 'Member', headline_user: 'Founder' }],
  totalCount: 1
});
const profileMenuText = renderProfileMenuText({
  persistenceEnabled: true,
  profileSnapshot: {
    linkedin_sub: 'linkedin-sub',
    linkedin_name: 'Member',
    display_name: 'Member',
    completion: { isReady: false, percent: 20, missingRequiredFields: ['headline_user'] },
    profile_state: 'draft',
    visibility_status: 'hidden',
    selected_skills: []
  }
});
const directoryCardText = renderDirectoryCardText({
  persistenceEnabled: true,
  profileSnapshot: {
    profile_id: 1,
    display_name: 'Member',
    headline_user: 'Founder',
    company_user: 'Example',
    city_user: 'Dubai',
    industry_user: 'Technology',
    selected_skills: ['Product'],
    about_user: 'Building products',
    visibility_status: 'listed',
    contact_mode: 'intro_request',
    profile_state: 'active'
  }
});
const inviteCaption = renderInlineInviteCaption({ inviteState: { inlineInviteLink: 'https://t.me/introdeckbot?start=ref_test' } });

const activeSurfaces = {
  'index.html': read('index.html'),
  'privacy/index.html': read('privacy/index.html'),
  'terms/index.html': read('terms/index.html'),
  'Telegram home': normalize(homeText),
  'Telegram help': normalize(helpText),
  'Telegram directory': normalize(directoryText),
  'Telegram profile editor': normalize(profileMenuText),
  'Telegram directory card': normalize(directoryCardText),
  'Telegram invite caption': normalize(inviteCaption),
  'BotFather copy': read('doc/80_STEP054_BOTFATHER_PROFILE_COPY.md')
};

const required = {
  'index.html': [
    'Professional discovery. Contact by permission.',
    'LinkedIn-connected account',
    'Member-provided profile',
    'Active, listed profile cards are visible to bot users',
    'It does not verify member-entered roles, companies, skills, or expertise.'
  ],
  'terms/index.html': [
    'LinkedIn sign-in connects an account identity',
    'Those signals do not verify a member-entered title, role, seniority, skills, experience, expertise',
    'Listed profile cards may be browsed by bot users'
  ],
  'privacy/index.html': [
    'Active, listed profile cards may be browsed by bot users',
    'Member-entered professional fields are not verified by LinkedIn or Intro Deck'
  ],
  'Telegram home': ['Listed professional profiles. Contact by permission.'],
  'Telegram help': [
    'connect a LinkedIn account',
    'member-provided professional card',
    'continue privately only after approval'
  ],
  'Telegram directory': [
    '🌐 Directory',
    'Listed profile cards are visible to bot users',
    'Private contact details stay hidden'
  ],
  'Telegram profile editor': ['LinkedIn does not verify the professional fields you enter on your card.'],
  'Telegram directory card': ['Profile details: member-provided'],
  'Telegram invite caption': [
    'Professional discovery and contact by permission in Telegram.',
    'LinkedIn-connected accounts. Private contact after approval.'
  ],
  'BotFather copy': [
    'LinkedIn connects account identity',
    'professional profile fields are provided by members',
    'not verified by LinkedIn or Intro Deck'
  ]
};

for (const [surface, snippets] of Object.entries(required)) {
  for (const snippet of snippets) {
    if (!activeSurfaces[surface].includes(snippet)) {
      throw new Error(`${surface} missing STEP054 positioning truth: ${snippet}`);
    }
  }
}

const forbidden = [
  /linkedin[- ]verified/i,
  /verified identity/i,
  /verify identity/i,
  /trusted profiles/i,
  /trusted professionals/i,
  /warm intro/i,
  /warm access/i,
  /warm professional/i,
  /private professional directory/i,
  /private directory/i,
  /private discovery/i,
  /trust layer/i,
  /connect your linkedin identity/i,
  /linkedin is used as the identity layer/i
];

const marketingAndTelegramSurfaces = Object.entries(activeSurfaces)
  .filter(([surface]) => !['privacy/index.html', 'terms/index.html'].includes(surface));

for (const [surface, text] of marketingAndTelegramSurfaces) {
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`${surface} contains forbidden STEP054 claim: ${pattern}`);
    }
  }
}

for (const legalSurface of ['privacy/index.html', 'terms/index.html']) {
  if (!activeSurfaces[legalSurface].includes('member-provided') && !activeSurfaces[legalSurface].includes('member-entered')) {
    throw new Error(`${legalSurface} must preserve member-provided claims boundary`);
  }
}

if (!/^STEP\d+[A-Z]?\d*$/.test(CURRENT_SOURCE_STEP)) {
  throw new Error(`Invalid release marker while preserving STEP054 positioning truth: ${CURRENT_SOURCE_STEP}`);
}

console.log(`OK: STEP054 positioning and discovery truth contract preserved in ${CURRENT_SOURCE_STEP}`);
