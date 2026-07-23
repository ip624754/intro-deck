import {
  AI_NEWS_DRAFT_SCHEMA,
  buildNewsDraftInput,
  buildNewsDraftInstructions,
  parseAndValidateGeneratedDraft
} from './newsDraftGenerationContract.js';

export class OpenAiDraftError extends Error {
  constructor(message, { status = null, code = null, requestId = null, retryable = false, durationMs = null } = {}) {
    super(message);
    this.name = 'OpenAiDraftError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
    this.durationMs = Number.isFinite(Number(durationMs)) ? Number(durationMs) : null;
  }
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text.trim();
    }
  }
  return null;
}

export async function generateOpenAiNewsDraft({
  apiKey,
  baseUrl = 'https://api.openai.com',
  model,
  timeoutMs = 30000,
  source,
  sourceEvidence,
  profile,
  postLanguage,
  tone,
  fetchImpl = fetch
}) {
  const sourceUrl = source?.source_url || source?.url;
  const instructions = buildNewsDraftInstructions({ sourceUrl, postLanguage, tone });
  const input = buildNewsDraftInput({ source, sourceEvidence, profile });

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(new URL('/v1/responses', String(baseUrl).replace(/\/$/, '')), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions,
        input,
        max_output_tokens: 1800,
        text: {
          format: {
            type: 'json_schema',
            name: 'intro_deck_news_draft',
            strict: true,
            schema: AI_NEWS_DRAFT_SCHEMA
          },
          verbosity: 'low'
        }
      }),
      signal: controller.signal
    });
  } catch (error) {
    throw new OpenAiDraftError(error?.name === 'AbortError' ? 'openai_timeout' : 'openai_network_error', {
      retryable: true,
      durationMs: Date.now() - startedAt
    });
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  const requestId = response.headers.get('x-request-id') || null;
  if (!response.ok) {
    throw new OpenAiDraftError(
      String(payload?.error?.message || `openai_http_${response.status}`).slice(0, 400),
      {
        status: response.status,
        code: payload?.error?.code || payload?.error?.type || null,
        requestId,
        retryable: response.status === 429 || response.status >= 500,
        durationMs: Date.now() - startedAt
      }
    );
  }

  const validated = parseAndValidateGeneratedDraft({
    outputText: extractOutputText(payload),
    sourceEvidence,
    profile,
    sourceUrl,
    errorFactory: (code) => new OpenAiDraftError(`openai_${code}`, {
      requestId,
      durationMs: Date.now() - startedAt
    })
  });

  const usagePayload = payload?.usage || {};
  const usage = {
    inputTokens: Math.max(0, Number(usagePayload.input_tokens || 0) || 0),
    outputTokens: Math.max(0, Number(usagePayload.output_tokens || 0) || 0),
    totalTokens: Math.max(0, Number(usagePayload.total_tokens || 0) || 0)
  };

  return {
    ...validated,
    providerResponseId: payload?.id || null,
    providerRequestId: requestId,
    model: payload?.model || model,
    usage,
    durationMs: Date.now() - startedAt
  };
}
