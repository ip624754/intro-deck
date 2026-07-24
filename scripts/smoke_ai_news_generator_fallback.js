import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getAiNewsDraftConfig,
  getLinkedInShareConfig
} from '../src/config/env.js';
import { buildSourceEvidence } from '../src/lib/ai/newsDraftContract.js';
import { generateTemplateNewsDraft } from '../src/lib/ai/templateNewsDraft.js';
import { generateGroqNewsDraft, GroqDraftError } from '../src/lib/ai/groqNewsDraft.js';
import healthHandler from '../api/health.js';
import { CURRENT_SOURCE_STEP } from '../src/config/release.js';
import {
  renderAiNewsHubKeyboard,
  renderAiNewsHubText,
  renderAiNewsSourcesKeyboard,
  renderAiNewsSourcesText
} from '../src/lib/telegram/aiNewsRender.js';

const ENV_KEYS = [
  'AI_NEWS_DRAFT_MODE', 'AI_NEWS_GENERATOR_MODE', 'AI_NEWS_SOURCE_MODE',
  'AI_NEWS_ENABLED_PROVIDERS', 'AI_NEWS_SCHEDULE_MODE', 'CRON_SECRET',
  'NEWSDATA_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'GROQ_BASE_URL',
  'GROQ_DRAFT_MODEL', 'LINKEDIN_SHARE_MODE'
];
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function resetEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.AI_NEWS_DRAFT_MODE = 'operator';
  process.env.AI_NEWS_SOURCE_MODE = 'multi_source';
  process.env.AI_NEWS_ENABLED_PROVIDERS = 'rss';
  process.env.AI_NEWS_SCHEDULE_MODE = 'live';
  process.env.CRONT_SECRET = '';
  process.env.CRON_SECRET = 'test-cron-secret';
}

try {
  resetEnv();
  process.env.AI_NEWS_GENERATOR_MODE = 'off';
  let config = getAiNewsDraftConfig({ strict: true });
  assert.equal(config.configurationValid, true);
  assert.equal(config.generator.mode, 'off');
  assert.equal(config.generator.browseOnly, true);
  assert.equal(config.schedule.requestedMode, 'live');
  assert.equal(config.schedule.mode, 'off');
  assert.equal(config.schedule.enabled, false);
  assert.equal(config.schedule.disabledReason, 'ai_news_generator_disabled');
  assert.equal(getLinkedInShareConfig({ strict: true }).mode, 'off');
  const healthResponse = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await healthHandler({}, healthResponse);
  assert.equal(healthResponse.statusCode, 200);
  assert.equal(healthResponse.body.step, CURRENT_SOURCE_STEP);
  assert.equal(healthResponse.body.aiNewsDraft.generatorMode, 'off');
  assert.equal(healthResponse.body.aiNewsDraft.browseOnly, true);
  assert.equal(healthResponse.body.aiNewsDraft.schedule.mode, 'off');
  assert.equal(healthResponse.body.aiNewsDraft.schedule.disabledReason, 'ai_news_generator_disabled');

  resetEnv();
  process.env.AI_NEWS_GENERATOR_MODE = 'template';
  config = getAiNewsDraftConfig({ strict: true });
  assert.equal(config.generator.mode, 'template');
  assert.equal(config.schedule.enabled, true);

  resetEnv();
  process.env.AI_NEWS_GENERATOR_MODE = 'groq';
  assert.throws(() => getAiNewsDraftConfig({ strict: true }), /GROQ_API_KEY/);
  process.env.GROQ_API_KEY = 'gsk_test_only';
  config = getAiNewsDraftConfig({ strict: true });
  assert.equal(config.groq.baseUrl, 'https://api.groq.com/openai/v1');
  assert.equal(config.groq.model, 'openai/gpt-oss-20b');
  process.env.GROQ_BASE_URL = 'https://example.com/openai/v1';
  assert.throws(() => getAiNewsDraftConfig({ strict: true }), /hostname is not allowlisted/);

  resetEnv();
  process.env.AI_NEWS_GENERATOR_MODE = 'openai';
  assert.throws(() => getAiNewsDraftConfig({ strict: true }), /OPENAI_API_KEY/);

  const source = {
    source_title: 'New open-source AI model released for developers',
    source_description: 'The release introduces a compact model designed for fast inference and structured outputs in developer applications.',
    source_url: 'https://example.com/news/model',
    source_name: 'Example Research',
    published_at: '2026-07-23T10:00:00.000Z'
  };
  const sourceEvidence = buildSourceEvidence(source);
  for (const postLanguage of ['ru', 'en']) {
    const generated = generateTemplateNewsDraft({
      source,
      sourceEvidence,
      profile: { display_name: 'Test Founder' },
      postLanguage,
      tone: 'concise'
    });
    assert.equal(generated.model, 'introdeck-template-v1');
    assert.equal(generated.usage.totalTokens, 0);
    assert.ok(generated.postText.endsWith(source.source_url));
    assert.ok(generated.evidenceClaims.length >= 1);
  }

  let captured = null;
  const groqPayload = {
    id: 'chatcmpl-test',
    model: 'openai/gpt-oss-20b',
    choices: [{ message: { content: JSON.stringify({
      post_text: [
        source.source_title,
        '',
        'Key point from the source:',
        source.source_description,
        '',
        'My take: this release is worth watching because it focuses on practical developer use. This perspective is based only on the supplied source, and the original link is included for verification before any broader conclusion is drawn.',
        '',
        'Source:',
        source.source_url
      ].join('\n'),
      evidence_claims: [{
        claim: 'The source describes a compact model for developer applications.',
        supporting_text: source.source_description
      }],
      interpretation_disclosure: 'The analysis is the member perspective based only on the cited source.'
    }) } }],
    usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 }
  };
  const fetchImpl = async (url, options) => {
    captured = { url: String(url), options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify(groqPayload), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-groq-test' }
    });
  };
  const groq = await generateGroqNewsDraft({
    apiKey: 'gsk_test_only',
    source,
    sourceEvidence,
    profile: { display_name: 'Test Founder' },
    postLanguage: 'en',
    tone: 'professional',
    fetchImpl
  });
  assert.equal(captured.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured.body.response_format.type, 'json_schema');
  assert.equal(captured.body.response_format.json_schema.strict, true);
  assert.equal(Object.hasOwn(captured.body, 'store'), false);
  assert.equal(groq.providerRequestId, 'req-groq-test');
  assert.equal(groq.usage.totalTokens, 200);

  await assert.rejects(
    () => generateGroqNewsDraft({
      apiKey: 'bad', source, sourceEvidence, profile: {}, postLanguage: 'en', tone: 'concise',
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'Invalid API Key', code: 'invalid_api_key' } }), {
        status: 401,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-bad-key' }
      })
    }),
    (error) => error instanceof GroqDraftError && error.status === 401 && error.code === 'invalid_api_key'
  );


  await assert.rejects(
    () => generateGroqNewsDraft({
      apiKey: 'test', source, sourceEvidence, profile: {}, postLanguage: 'en', tone: 'concise',
      fetchImpl: async () => new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } })
    }),
    (error) => error instanceof GroqDraftError && error.code === 'invalid_json'
  );

  await assert.rejects(
    () => generateGroqNewsDraft({
      apiKey: 'test', source, sourceEvidence, profile: {}, postLanguage: 'en', tone: 'concise',
      fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-length': '1000001' } })
    }),
    (error) => error instanceof GroqDraftError && error.code === 'response_too_large'
  );

  await assert.rejects(
    () => generateGroqNewsDraft({
      apiKey: 'test', source, sourceEvidence, profile: {}, postLanguage: 'en', tone: 'concise', timeoutMs: 20,
      fetchImpl: async () => new Response(new ReadableStream({ start() {} }), { status: 200 })
    }),
    (error) => error instanceof GroqDraftError && error.code === 'body_timeout'
  );

  const state = {
    eligible: true,
    config: {
      generator: { mode: 'off', browseOnly: true },
      schedule: { enabled: false },
      rolloutStage: 'operator_acceptance',
      source: { mode: 'multi_source' },
      presetLimit: 3
    },
    preferences: { preset_key: 'ai_technology', post_language: 'ru', tone: 'concise' },
    presets: [],
    presetUsage: { used: 0, limit: 3 },
    presetPersistenceReady: true
  };
  assert.match(renderAiNewsHubText({ state }), /source browser/);
  assert.ok(renderAiNewsHubKeyboard({ state }).inline_keyboard.flat().some((button) => button.callback_data === 'news:find'));

  const result = {
    query: 'AI', sourceMode: 'multi_source', generatorMode: 'off', draftGenerationAvailable: false,
    articles: [{ ...source, public_token: '11111111-1111-4111-8111-111111111111', provider: 'rss', source_is_primary: true, source_authority_score: 95, expires_at: '2026-07-23T11:00:00.000Z' }]
  };
  assert.match(renderAiNewsSourcesText({ result }), /Browse-only mode/);
  const buttons = renderAiNewsSourcesKeyboard({ result }).inline_keyboard.flat();
  assert.equal(buttons.some((button) => String(button.callback_data || '').startsWith('news:generate:')), false);
  assert.ok(buttons.some((button) => button.url === source.source_url));

  const migration = fs.readFileSync(new URL('../migrations/034_ai_news_generator_provider_neutrality.sql', import.meta.url), 'utf8');
  assert.match(migration, /'openai', 'groq', 'template'/);
  const shareStore = fs.readFileSync(new URL('../src/lib/storage/linkedinShareStore.js', import.meta.url), 'utf8');
  assert.doesNotMatch(shareStore, /groqNewsDraft|templateNewsDraft|newsDraftGenerator/);

  console.log('PASS STEP063A-H1 browse-only, template, Groq, migration, and publishing-boundary smoke');
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete process.env.CRONT_SECRET;
}
