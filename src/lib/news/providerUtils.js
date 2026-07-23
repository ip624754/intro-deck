import { normalizeSourceUrl } from '../ai/newsDraftContract.js';

export class NewsSourceProviderError extends Error {
  constructor(message, {
    provider,
    status = null,
    code = null,
    requestId = null,
    durationMs = null,
    retryable = false
  } = {}) {
    super(message);
    this.name = 'NewsSourceProviderError';
    this.provider = provider || null;
    this.status = Number.isFinite(Number(status)) ? Number(status) : null;
    this.code = code || null;
    this.requestId = requestId || null;
    this.durationMs = Number.isFinite(Number(durationMs)) ? Number(durationMs) : null;
    this.retryable = Boolean(retryable);
  }
}

function allowedHostname(hostname, allowedHostnames) {
  const normalized = String(hostname || '').toLowerCase();
  return (allowedHostnames || []).some((allowed) => normalized === String(allowed).toLowerCase());
}

export function assertTrustedProviderUrl(value, { allowedHostnames, provider }) {
  const normalized = normalizeSourceUrl(value);
  const url = new URL(normalized);
  if (url.protocol !== 'https:' || !allowedHostname(url.hostname, allowedHostnames)) {
    throw new NewsSourceProviderError('provider_url_not_allowlisted', {
      provider,
      code: 'provider_url_not_allowlisted'
    });
  }
  return url;
}

export async function fetchTrustedProviderResponse(urlValue, {
  provider,
  allowedHostnames,
  timeoutMs = 8000,
  fetchImpl = fetch,
  headers = {},
  maxBytes = 1_500_000
} = {}) {
  const url = assertTrustedProviderUrl(urlValue, { allowedHostnames, provider });
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal
    });
  } catch (error) {
    throw new NewsSourceProviderError(error?.name === 'AbortError' ? 'provider_timeout' : 'provider_network_error', {
      provider,
      code: error?.name === 'AbortError' ? 'timeout' : 'network_error',
      durationMs: Date.now() - startedAt,
      retryable: true
    });
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - startedAt;
  if (response.status >= 300 && response.status < 400) {
    throw new NewsSourceProviderError('provider_redirect_forbidden', {
      provider,
      status: response.status,
      code: 'redirect_forbidden',
      requestId: response.headers.get('x-request-id'),
      durationMs
    });
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new NewsSourceProviderError('provider_response_too_large', {
      provider,
      status: response.status,
      code: 'response_too_large',
      requestId: response.headers.get('x-request-id'),
      durationMs
    });
  }
  if (!response.ok) {
    throw new NewsSourceProviderError(`provider_http_${response.status}`, {
      provider,
      status: response.status,
      code: `http_${response.status}`,
      requestId: response.headers.get('x-request-id'),
      durationMs,
      retryable: response.status === 429 || response.status >= 500
    });
  }
  return { response, durationMs, requestId: response.headers.get('x-request-id') || null, maxBytes };
}

function bodyReadError(message, { provider, code, startedAt, retryable = false }) {
  return new NewsSourceProviderError(message, {
    provider,
    code,
    durationMs: Date.now() - startedAt,
    retryable
  });
}

async function withDeadline(promise, timeoutMs, onTimeout) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readBoundedText(response, maxBytes = 1_500_000, {
  timeoutMs = 8000,
  provider = null
} = {}) {
  const startedAt = Date.now();
  const reader = response?.body?.getReader?.();
  if (!reader) {
    const text = await withDeadline(
      response.text(),
      timeoutMs,
      () => bodyReadError('provider_body_timeout', { provider, code: 'body_timeout', startedAt, retryable: true })
    );
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw bodyReadError('provider_response_too_large', { provider, code: 'response_too_large', startedAt });
    }
    return text;
  }

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const elapsed = Date.now() - startedAt;
      const remainingMs = Math.max(1, timeoutMs - elapsed);
      const { done, value } = await withDeadline(
        reader.read(),
        remainingMs,
        () => bodyReadError('provider_body_timeout', { provider, code: 'body_timeout', startedAt, retryable: true })
      );
      if (done) break;
      const chunk = Buffer.from(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        throw bodyReadError('provider_response_too_large', { provider, code: 'response_too_large', startedAt });
      }
      chunks.push(chunk);
    }
  } catch (error) {
    try { await reader.cancel(error); } catch {}
    throw error;
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8');
}

export async function readBoundedJson(response, maxBytes = 1_500_000, options = {}) {
  const text = await readBoundedText(response, maxBytes, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new NewsSourceProviderError('provider_invalid_json', {
      provider: options.provider || null,
      code: 'invalid_json'
    });
  }
}
