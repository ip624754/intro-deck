import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  renderAiNewsSearchFailureKeyboard,
  renderAiNewsSearchFailureText,
  renderAiNewsSearchProgressKeyboard,
  renderAiNewsSearchProgressText,
  renderAiNewsSourcesKeyboard
} from '../src/lib/telegram/aiNewsRender.js';
import {
  resolveTelegramMessageReference,
  safeEditMessageByReference
} from '../src/lib/telegram/safeEditOrReply.js';
import { releaseAiNewsSourceSearchClaim } from '../src/db/aiNewsRepo.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

assert.equal(['STEP063B-H2', 'STEP064A', 'STEP064B1', 'STEP064B2', 'STEP064B3', 'STEP064B4A', 'STEP064B4B', 'STEP064B4C', 'STEP064B4C1', 'STEP064B4D1', 'STEP064B4D1A', 'STEP064B4D2', 'STEP064B4D2A', 'STEP065A1', 'STEP065A2'].includes(CURRENT_SOURCE_STEP), true);

const state = {
  preferences: {
    preset_key: 'for_you',
    audience_key: 'product_engineering',
    angle_key: 'practical_lessons'
  },
  config: {
    source: {
      enabledProviders: ['rss', 'hacker_news', 'github_releases', 'newsdata']
    }
  }
};
const progressText = renderAiNewsSearchProgressText({ state });
assert.match(progressText, /Finding stories/);
assert.match(progressText, /Checking official sources, releases, discussions, and news reports/);
assert.doesNotMatch(progressText, /Search status: searching/);
assert.doesNotMatch(progressText, /trusted source providers/i);
assert.equal(renderAiNewsSearchProgressKeyboard().inline_keyboard[0][0].callback_data, 'news:searching');

const failedResult = {
  found: false,
  reason: 'ai_news_all_providers_failed',
  searchClaimReleased: true,
  searchUsage: { used: 2, limit: 10, remaining: 8 },
  errorCode: 'source_discovery_unhandled_failure'
};
const failureText = renderAiNewsSearchFailureText({ result: failedResult });
assert.match(failureText, /Search could not be completed/);
assert.match(failureText, /allowance: restored/i);
assert.match(failureText, /No draft or LinkedIn post was created/);
const failureButtons = renderAiNewsSearchFailureKeyboard({ result: failedResult }).inline_keyboard.flat();
assert.ok(failureButtons.some((button) => button.callback_data === 'news:find'));
assert.ok(failureButtons.some((button) => button.callback_data === 'news:home'));

const noReleaseButtons = renderAiNewsSearchFailureKeyboard({
  result: { searchClaimReleased: false, searchUsage: { remaining: 8, limit: 10 } }
}).inline_keyboard.flat();
assert.equal(noReleaseButtons.some((button) => button.callback_data === 'news:find'), false);

const sourcesButtons = renderAiNewsSourcesKeyboard({
  result: {
    draftGenerationAvailable: false,
    searchUsage: { remaining: 8, limit: 10 },
    searchCooldown: { active: true, retryAfterSeconds: 60 },
    articles: [{
      public_token: '11111111-1111-4111-8111-111111111111',
      source_url: 'https://example.com/article'
    }]
  }
}).inline_keyboard.flat();
assert.equal(sourcesButtons.some((button) => button.callback_data === 'news:find'), false);

const editCalls = [];
const replyCalls = [];
const ctx = {
  callbackQuery: { message: { chat: { id: 42 }, message_id: 7 } },
  api: {
    editMessageText: async (...args) => {
      editCalls.push(args);
      return { chat: { id: args[0] }, message_id: args[1], text: args[2] };
    }
  },
  reply: async (...args) => {
    replyCalls.push(args);
    return { chat: { id: 42 }, message_id: 8, text: args[0] };
  }
};
const reference = resolveTelegramMessageReference(ctx, { chat: { id: 42 }, message_id: 99 });
assert.deepEqual(reference, { chatId: 42, messageId: 99 });
const edited = await safeEditMessageByReference(ctx, reference, 'final results', { reply_markup: { inline_keyboard: [] } });
assert.equal(edited.edited, true);
assert.equal(editCalls.length, 1);
assert.deepEqual(editCalls[0].slice(0, 3), [42, 99, 'final results']);
assert.equal(replyCalls.length, 0);

const fallbackCtx = {
  callbackQuery: { message: { chat: { id: 42 }, message_id: 7 } },
  api: { editMessageText: async () => { throw new Error('Bad Request: message cannot be edited'); } },
  reply: async (text) => ({ chat: { id: 42 }, message_id: 101, text })
};
const fallback = await safeEditMessageByReference(fallbackCtx, { chatId: 42, messageId: 100 }, 'persistent failure');
assert.equal(fallback.replied, true);
assert.deepEqual(fallback.reference, { chatId: 42, messageId: 101 });

const dbQueries = [];
const fakeClient = {
  query: async (sql, params) => {
    dbQueries.push({ sql, params });
    return {
      rows: [{
        search_count_in_window: 2,
        search_window_started_at: new Date(Date.now() - 60_000).toISOString(),
        last_search_started_at: null
      }]
    };
  }
};
const released = await releaseAiNewsSourceSearchClaim(fakeClient, {
  userId: 123,
  claimStartedAt: '2026-07-24T00:00:00.000Z',
  dailyLimit: 10
});
assert.equal(released.released, true);
assert.equal(released.remaining, 8);
assert.match(dbQueries[0].sql, /last_search_started_at=\$2::timestamptz/);
assert.match(dbQueries[0].sql, /greatest\(search_count_in_window - 1, 0\)/i);

const composerSource = read('src/bot/composers/aiNewsComposer.js');
assert.match(composerSource, /activeAiNewsSearches/);
assert.match(composerSource, /safeEditMessageByReference\(ctx, progressReference/);
assert.match(composerSource, /renderAiNewsSearchProgressText/);
assert.match(composerSource, /renderAiNewsSearchFailureText/);
assert.doesNotMatch(composerSource, /Finding professionally relevant stories from trusted source providers/);

const storeSource = read('src/lib/storage/aiNewsStore.js');
assert.match(storeSource, /releaseAiNewsSourceSearchClaim/);
assert.match(storeSource, /searchClaimReleased/);
assert.match(storeSource, /searchInternalErrorCode/);
assert.match(storeSource, /releasePreparedSearchClaimBestEffort/);

console.log('STEP063B-H1R1 persistent search progress and callback recovery smoke: PASS');
