import { parseAndValidateGeneratedDraft } from './newsDraftGenerationContract.js';

function clean(value, max = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sourceFact(source) {
  return clean(source?.source_description || source?.description || source?.source_content_excerpt || source?.contentExcerpt, 700)
    .replace(/[\"“”«»]/g, '')
    .trim();
}

function exactEvidenceSnippet(sourceEvidence) {
  const lines = String(sourceEvidence || '').split('\n');
  for (const prefix of ['Description: ', 'Content excerpt: ', 'Title: ']) {
    const line = lines.find((item) => item.startsWith(prefix) && item.slice(prefix.length).trim().length >= 3);
    if (line) return line.slice(prefix.length).trim();
  }
  return String(sourceEvidence || '').trim().slice(0, 300);
}


function buildPost({ source, postLanguage, tone }) {
  const sourceUrl = source?.source_url || source?.url;
  const title = clean(source?.source_title || source?.title, 300);
  const fact = sourceFact(source);

  if (postLanguage === 'ru') {
    const toneLead = tone === 'analytical'
      ? 'Что здесь важно отделить от интерпретации:'
      : tone === 'concise'
        ? 'Коротко по источнику:'
        : 'Главное из источника:';
    return [
      title,
      '',
      toneLead,
      fact || 'Источник сообщает об этом обновлении; перед выводами стоит проверить детали по исходной публикации.',
      '',
      'Мой взгляд: это подходящая тема для профессионального обсуждения, но выводы должны опираться только на подтверждённые данные из первоисточника. Поэтому я отделяю факт публикации от собственной интерпретации и оставляю ссылку для проверки.',
      '',
      'Источник:',
      sourceUrl
    ].join('\n');
  }

  const toneLead = tone === 'analytical'
    ? 'What matters to separate from interpretation:'
    : tone === 'concise'
      ? 'Source summary:'
      : 'Key point from the source:';
  return [
    title,
    '',
    toneLead,
    fact || 'The source reports this update; the original publication should be reviewed before drawing broader conclusions.',
    '',
    'My take: this is a useful topic for professional discussion, but conclusions should stay anchored to the evidence in the source. I am separating the reported fact from my interpretation and leaving the original link for verification.',
    '',
    'Source:',
    sourceUrl
  ].join('\n');
}

export function generateTemplateNewsDraft({
  source,
  sourceEvidence,
  profile,
  postLanguage,
  tone
}) {
  const startedAt = Date.now();
  const sourceUrl = source?.source_url || source?.url;
  const title = clean(source?.source_title || source?.title, 300);
  const fact = sourceFact(source);
  const postText = buildPost({ source, postLanguage, tone });
  const supportingText = exactEvidenceSnippet(sourceEvidence) || title;
  const payload = JSON.stringify({
    post_text: postText,
    evidence_claims: [{
      claim: fact ? 'The draft summary is anchored to the supplied source evidence.' : 'The draft identifies the supplied source topic.',
      supporting_text: supportingText
    }],
    interpretation_disclosure: postLanguage === 'ru'
      ? 'Интерпретация явно отделена от фактов и основана только на указанном источнике.'
      : 'The interpretation is explicitly separated from facts and based only on the cited source.'
  });
  const validated = parseAndValidateGeneratedDraft({
    outputText: payload,
    sourceEvidence,
    profile,
    sourceUrl,
    errorFactory: (code) => new Error(`template_${code}`)
  });
  return {
    ...validated,
    providerResponseId: null,
    providerRequestId: null,
    model: 'introdeck-template-v1',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    durationMs: Date.now() - startedAt
  };
}
