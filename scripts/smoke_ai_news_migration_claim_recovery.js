import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import { releaseAiNewsSourceSearchClaim } from '../src/db/aiNewsRepo.js';
import { renderAiNewsSearchFailureText } from '../src/lib/telegram/aiNewsRender.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

assert.equal(['STEP063B-H2', 'STEP064A', 'STEP064B1', 'STEP064B2'].includes(CURRENT_SOURCE_STEP), true);

const migration035 = read('migrations/035_ai_news_audience_aware_discovery.sql');
const migration036 = read('migrations/036_ai_news_audience_contract_repair.sql');
for (const migration of [migration035, migration036]) {
  assert.match(migration, /^--[\s\S]*\nBEGIN;/m);
  assert.match(migration, /COMMIT;/);
  assert.ok(
    migration.indexOf('DROP CONSTRAINT IF EXISTS ai_news_preferences_preset_key_check')
      < migration.indexOf("UPDATE ai_news_preferences SET preset_key='business_markets'"),
    'legacy preference constraint must be removed before legacy value rewrite'
  );
  assert.ok(
    migration.indexOf('DROP CONSTRAINT IF EXISTS ai_news_presets_preset_key_check')
      < migration.indexOf("UPDATE ai_news_presets SET preset_key='business_markets'"),
    'legacy preset constraint must be removed before legacy value rewrite'
  );
  assert.match(migration, /audience_query/);
  assert.match(migration, /business_markets/);
}
assert.match(migration036, /partial migration 035/i);
assert.match(migration036, /WHERE preset_key NOT IN/);

const schemaCompat = read('src/db/schemaCompat.js');
assert.match(schemaCompat, /aiNewsAudienceContractReady/);
assert.match(schemaCompat, /ai_news_input_sessions_has_audience_contract/i);
assert.match(schemaCompat, /pg_get_constraintdef\(c\.oid\) ilike '%for_you%'/i);
assert.match(schemaCompat, /pg_get_constraintdef\(c\.oid\) ilike '%audience_query%'/i);

const store = read('src/lib/storage/aiNewsStore.js');
assert.match(store, /releasePreparedSearchClaimBestEffort/);
assert.match(store, /searchInternalErrorCode/);
assert.match(store, /phase = 'source_persistence'/);
assert.match(store, /searchClaimConsumed: !released\.released/);
assert.match(store, /aiNewsAudienceContractReady/);
assert.match(store, /migration_036_required/);

const dbQueries = [];
const client = {
  query: async (sql, params) => {
    dbQueries.push({ sql, params });
    if (params?.[1] === 'newer-claim') return { rows: [] };
    return {
      rows: [{
        search_count_in_window: 0,
        search_window_started_at: null,
        last_search_started_at: null
      }]
    };
  }
};
const released = await releaseAiNewsSourceSearchClaim(client, {
  userId: 77,
  claimStartedAt: '2026-07-24T00:00:00.000Z',
  dailyLimit: 10
});
assert.equal(released.released, true);
assert.match(dbQueries[0].sql, /last_search_started_at=\$2::timestamptz/);
const notReleased = await releaseAiNewsSourceSearchClaim(client, {
  userId: 77,
  claimStartedAt: 'newer-claim',
  dailyLimit: 10
});
assert.equal(notReleased.released, false);
assert.equal(notReleased.reason, 'claim_no_longer_current');

const restoredText = renderAiNewsSearchFailureText({
  result: {
    reason: 'ai_news_search_internal_error',
    errorCode: 'search_source_persistence_internal_error',
    searchClaimReleased: true,
    searchClaimConsumed: false,
    searchUsage: { used: 1, limit: 10, remaining: 9 }
  }
});
assert.match(restoredText, /Search allowance: restored/i);
assert.doesNotMatch(restoredText, /search_source_persistence_internal_error/);

const noClaimText = renderAiNewsSearchFailureText({
  result: {
    reason: 'ai_news_search_internal_error',
    errorCode: 'search_preparation_internal_error',
    searchClaimConsumed: false
  }
});
assert.match(noClaimText, /Search allowance: unchanged/i);

console.log('STEP063B-H1R1 migration ordering and exact claim recovery smoke: PASS');
