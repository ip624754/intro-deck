import assert from 'node:assert/strict';
import fs from 'node:fs';
import { estimateFixedRequestCostMicrousd, estimateOpenAiCostMicrousd } from '../src/lib/ai/newsCost.js';
import { generateOpenAiNewsDraft } from '../src/lib/ai/openaiNewsDraft.js';
import { fetchNewsDataLatest } from '../src/lib/news/newsdata.js';
import { STEP061A_SCENARIOS, evaluateLiveAcceptance } from './step061a/liveAcceptanceLib.js';

function responseJson(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

assert.equal(estimateFixedRequestCostMicrousd(0.0025), 2500);
assert.equal(estimateOpenAiCostMicrousd({
  inputTokens: 1000,
  outputTokens: 500,
  inputUsdPerMillion: 2,
  outputUsdPerMillion: 8
}), 6000);

const sourceUrl = 'https://example.com/current-ai-news';
const sourceEvidence = [
  'Title: Current AI News',
  `URL: ${sourceUrl}`,
  'Source: Example',
  'Published: 2026-07-20T00:00:00.000Z',
  'Description: Example company released a new AI workflow for small businesses.',
  'Content excerpt: The workflow is available to small businesses and includes review controls.'
].join('\n');

const generated = await generateOpenAiNewsDraft({
  apiKey: 'test-key',
  model: 'test-model',
  source: { source_url: sourceUrl, source_title: 'Current AI News' },
  sourceEvidence,
  profile: { display_name: 'Test Member', headline_user: 'Founder', skills: [] },
  postLanguage: 'en',
  tone: 'professional',
  fetchImpl: async () => responseJson({
    id: 'resp_test',
    model: 'test-model',
    usage: { input_tokens: 120, output_tokens: 80, total_tokens: 200 },
    output_text: JSON.stringify({
      post_text: `Example company released a new AI workflow for small businesses.\n\nMy take: review controls matter when teams adopt automation.\n\n${sourceUrl}`,
      evidence_claims: [{
        claim: 'Example company released a new AI workflow for small businesses.',
        supporting_text: 'Example company released a new AI workflow for small businesses.'
      }],
      interpretation_disclosure: 'The analysis is the member perspective based on the cited source.'
    })
  }, { headers: { 'x-request-id': 'req_openai_test' } })
});
assert.deepEqual(generated.usage, { inputTokens: 120, outputTokens: 80, totalTokens: 200 });
assert.equal(generated.providerRequestId, 'req_openai_test');
assert.ok(generated.durationMs >= 0);

const news = await fetchNewsDataLatest({
  apiKey: 'test-key',
  query: 'AI',
  maxSourceAgeHours: 999999,
  fetchImpl: async () => responseJson({
    status: 'success',
    results: [{
      article_id: 'article-1',
      title: 'Current AI News',
      link: sourceUrl,
      pubDate: '2026-07-20 00:00:00',
      description: 'Example description',
      source_name: 'Example'
    }]
  }, { headers: { 'x-request-id': 'req_news_test' } })
});
assert.equal(news.articles.length, 1);
assert.equal(news.requestId, 'req_news_test');
assert.equal(news.rawResultCount, 1);
assert.ok(news.durationMs >= 0);

const passedScenarios = STEP061A_SCENARIOS.map((scenario) => ({
  id: scenario.id,
  status: 'PASS',
  evidence: ['test evidence']
}));
assert.equal(evaluateLiveAcceptance({ preflightVerdict: 'PASS', scenarios: passedScenarios }).verdict, 'GO');
const requiredNotRun = passedScenarios.map((scenario) => scenario.id === 'openai_draft_generated' ? { ...scenario, status: 'NOT_RUN', evidence: [] } : scenario);
assert.equal(evaluateLiveAcceptance({ preflightVerdict: 'PASS', scenarios: requiredNotRun }).verdict, 'NO_GO');
const optionalNotRun = passedScenarios.map((scenario) => scenario.id === 'limited_pro_member_flow' ? { ...scenario, status: 'NOT_RUN', evidence: [] } : scenario);
assert.equal(evaluateLiveAcceptance({ preflightVerdict: 'PASS', scenarios: optionalNotRun }).verdict, 'GO_WITH_RISKS');

const migration = fs.readFileSync(new URL('../migrations/032_ai_news_live_acceptance_telemetry.sql', import.meta.url), 'utf8');
assert.match(migration, /ai_news_provider_usage_events/);
assert.match(migration, /openai_input_tokens/);
assert.match(migration, /estimated_generation_cost_microusd/);
assert.match(migration, /requires migrations 030 and 031/);

const store = fs.readFileSync(new URL('../src/lib/storage/aiNewsStore.js', import.meta.url), 'utf8');
assert.match(store, /insertAiNewsProviderUsageEvent/);
assert.match(store, /migration_032_required/);
assert.match(store, /estimateTokenCostMicrousd/);

const preflight = fs.readFileSync(new URL('./step061a/productionPreflight.js', import.meta.url), 'utf8');
assert.match(preflight, /begin read only/i);
assert.match(preflight, /providerCallsExecuted: false/);
assert.match(preflight, /uq_ai_news_drafts_preset_run/);
assert.doesNotMatch(preflight, /latest_draft_token|latest_share_token/);
assert.doesNotMatch(preflight, /insert into|update ai_news|delete from/i);

const env = fs.readFileSync(new URL('../src/config/env.js', import.meta.url), 'utf8');
assert.match(env, /AI_NEWS_ROLLOUT_STAGE/);
assert.match(env, /operator_acceptance/);
assert.match(env, /OPENAI_INPUT_COST_USD_PER_1M/);

const health = fs.readFileSync(new URL('../api/health.js', import.meta.url), 'utf8');
assert.match(health, /process\.versions\.node/);

const evidenceVerifier = fs.readFileSync(new URL('./step061a/productionEvidence.js', import.meta.url), 'utf8');
assert.match(evidenceVerifier, /deployedNode20/);

console.log('OK: STEP061A AI/news live acceptance and rollout hardening contract');
