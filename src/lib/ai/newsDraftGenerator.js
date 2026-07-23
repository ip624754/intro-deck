import { generateGroqNewsDraft, GroqDraftError } from './groqNewsDraft.js';
import { generateOpenAiNewsDraft, OpenAiDraftError } from './openaiNewsDraft.js';
import { generateTemplateNewsDraft } from './templateNewsDraft.js';

export class NewsDraftGeneratorDisabledError extends Error {
  constructor() {
    super('ai_news_generator_disabled');
    this.name = 'NewsDraftGeneratorDisabledError';
    this.code = 'ai_news_generator_disabled';
    this.provider = 'none';
    this.retryable = false;
  }
}

export function isProviderDraftError(error) {
  return error instanceof OpenAiDraftError || error instanceof GroqDraftError;
}

export async function generateNewsDraft({ config, ...input }) {
  const mode = config?.generator?.mode || 'openai';
  if (mode === 'off') throw new NewsDraftGeneratorDisabledError();
  if (mode === 'template') {
    return { provider: 'template', generated: generateTemplateNewsDraft(input) };
  }
  if (mode === 'groq') {
    return {
      provider: 'groq',
      generated: await generateGroqNewsDraft({
        ...input,
        apiKey: config.groq.apiKey,
        baseUrl: config.groq.baseUrl,
        model: config.groq.model,
        timeoutMs: config.groq.timeoutMs
      })
    };
  }
  return {
    provider: 'openai',
    generated: await generateOpenAiNewsDraft({
      ...input,
      apiKey: config.openai.apiKey,
      baseUrl: config.openai.baseUrl,
      model: config.openai.model,
      timeoutMs: config.openai.timeoutMs
    })
  };
}
