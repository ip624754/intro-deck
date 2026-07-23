import {
  AI_NEWS_DRAFT_SCHEMA,
  buildNewsDraftInput,
  buildNewsDraftInstructions,
  parseAndValidateGeneratedDraft
} from './newsDraftGenerationContract.js';

export class GroqDraftError extends Error {
  constructor(message, { status = null, code = null, requestId = null, retryable = false, durationMs = null } = {}) {
    super(message);
    this.name = 'GroqDraftError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
    this.durationMs = Number.isFinite(Number(durationMs)) ? Number(durationMs) : null;
  }
}

function extractMessageText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
}

const MAX_GROQ_RESPONSE_BYTES = 1_000_000;

function deadlineError(code, startedAt, requestId = null) {
  return new GroqDraftError(`groq_${code}`, {
    code,
    requestId,
    retryable: code === 'body_timeout',
    durationMs: Date.now() - startedAt
  });
}

async function withDeadline(promise, remainingMs, makeError) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(makeError()), Math.max(1, remainingMs));
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedResponseText(response, { deadlineAt, startedAt, requestId }) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_GROQ_RESPONSE_BYTES) {
    throw deadlineError('response_too_large', startedAt, requestId);
  }
  const reader = response?.body?.getReader?.();
  if (!reader) {
    const text = await withDeadline(
      response.text(),
      deadlineAt - Date.now(),
      () => deadlineError('body_timeout', startedAt, requestId)
    );
    if (Buffer.byteLength(text, 'utf8') > MAX_GROQ_RESPONSE_BYTES) {
      throw deadlineError('response_too_large', startedAt, requestId);
    }
    return text;
  }

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await withDeadline(
        reader.read(),
        deadlineAt - Date.now(),
        () => deadlineError('body_timeout', startedAt, requestId)
      );
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.byteLength;
      if (total > MAX_GROQ_RESPONSE_BYTES) {
        throw deadlineError('response_too_large', startedAt, requestId);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    try { await reader.cancel(error); } catch {}
    throw error;
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

export async function generateGroqNewsDraft({
  apiKey,
  baseUrl = 'https://api.groq.com/openai/v1',
  model = 'openai/gpt-oss-20b',
  timeoutMs = 30000,
  source,
  sourceEvidence,
  profile,
  postLanguage,
  tone,
  audienceKey = 'professional_network',
  customAudience = null,
  angleKey = 'expert_take',
  fetchImpl = fetch
}) {
  const sourceUrl = source?.source_url || source?.url;
  const instructions = buildNewsDraftInstructions({ sourceUrl, postLanguage, tone, audienceKey, customAudience, angleKey });
  const input = buildNewsDraftInput({ source, sourceEvidence, profile, audienceKey, customAudience, angleKey });

  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let payload = null;
  let requestId = null;
  try {
    response = await fetchImpl(new URL('chat/completions', `${String(baseUrl).replace(/\/$/, '')}/`), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: input }
        ],
        temperature: 0.2,
        max_completion_tokens: 1800,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'intro_deck_news_draft',
            strict: true,
            schema: AI_NEWS_DRAFT_SCHEMA
          }
        }
      }),
      signal: controller.signal
    });
    requestId = response.headers.get('x-request-id') || response.headers.get('x-groq-request-id') || null;
    const text = await readBoundedResponseText(response, { deadlineAt, startedAt, requestId });
    try { payload = JSON.parse(text); } catch {
      throw new GroqDraftError('groq_invalid_json', {
        code: 'invalid_json',
        requestId,
        durationMs: Date.now() - startedAt
      });
    }
  } catch (error) {
    if (error instanceof GroqDraftError) throw error;
    throw new GroqDraftError(error?.name === 'AbortError' ? 'groq_timeout' : 'groq_network_error', {
      code: error?.name === 'AbortError' ? 'timeout' : 'network_error',
      requestId,
      retryable: true,
      durationMs: Date.now() - startedAt
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new GroqDraftError(
      String(payload?.error?.message || `groq_http_${response.status}`).slice(0, 400),
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
    outputText: extractMessageText(payload),
    sourceEvidence,
    profile,
    sourceUrl,
    errorFactory: (code) => new GroqDraftError(`groq_${code}`, {
      requestId,
      durationMs: Date.now() - startedAt
    })
  });

  const usagePayload = payload?.usage || {};
  const usage = {
    inputTokens: Math.max(0, Number(usagePayload.prompt_tokens || 0) || 0),
    outputTokens: Math.max(0, Number(usagePayload.completion_tokens || 0) || 0),
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
