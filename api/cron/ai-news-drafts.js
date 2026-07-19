import { getAiNewsDraftConfig } from '../../src/config/env.js';
import { secretsMatch } from '../../src/lib/crypto/secretCompare.js';
import { processDueAiNewsPresetRuns } from '../../src/lib/storage/aiNewsPresetStore.js';

function bearer(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || '';
  const [scheme, token] = String(raw).split(/\s+/, 2);
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function manualSecret(req) {
  return req?.headers?.['x-ai-news-cron-secret'] || req?.headers?.['X-Ai-News-Cron-Secret'] || null;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const config = getAiNewsDraftConfig();
  if (!config.schedule.enabled || config.schedule.configurationValid === false) {
    return res.status(503).json({
      ok: false,
      error: config.schedule.configurationError?.code || 'ai_news_schedule_disabled'
    });
  }

  const secret = config.schedule.cronSecret;
  const authenticated = Boolean(secret) && (
    secretsMatch(secret, bearer(req)) || secretsMatch(secret, manualSecret(req))
  );
  if (!authenticated) return res.status(401).json({ ok: false, error: 'invalid_ai_news_cron_auth' });

  try {
    const result = await processDueAiNewsPresetRuns();
    return res.status(result.ok ? 200 : 503).json(result);
  } catch (error) {
    console.error('[api/cron/ai-news-drafts] failed', error);
    return res.status(500).json({ ok: false, error: 'ai_news_schedule_processing_failed' });
  }
}
