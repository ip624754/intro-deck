import { audienceLabel, angleLabel, normalizeAngleKey } from './newsDiscoveryContract.js';
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

function perspectiveLead({ postLanguage, angleKey, audience }) {
  const angle = normalizeAngleKey(angleKey);
  const ru = {
    expert_take: `Мой взгляд для аудитории ${audience}: важнее всего отделить подтверждённый факт от профессиональной интерпретации.`,
    practical_lessons: `Мой взгляд для аудитории ${audience}: практическая ценность здесь — в выводах, которые можно проверить и применить без лишних обещаний.`,
    founder_perspective: `Мой взгляд как оператора для аудитории ${audience}: такой сигнал стоит оценивать через продуктовые последствия, ограничения и цену ошибки.`,
    explain_simply: `Мой взгляд для аудитории ${audience}: смысл новости стоит объяснять простыми словами, не смешивая факт и прогноз.`,
    contrarian_opinion: `Мой взгляд для аудитории ${audience}: помимо очевидной трактовки, полезно проверить альтернативный сценарий и его ограничения.`,
    industry_impact: `Мой взгляд для аудитории ${audience}: главный вопрос — как подтверждённое событие может повлиять на отрасль, без выдачи прогноза за факт.`,
    career_implications: `Мой взгляд для аудитории ${audience}: профессиональная ценность темы — в возможных последствиях для навыков и ролей, а не в громких прогнозах.`
  };
  const en = {
    expert_take: `My take for ${audience}: the priority is to separate the verified fact from professional interpretation.`,
    practical_lessons: `My take for ${audience}: the practical value is in lessons that can be checked and applied without overclaiming.`,
    founder_perspective: `My take as an operator for ${audience}: this signal should be assessed through product consequences, constraints, and the cost of error.`,
    explain_simply: `My take for ${audience}: the significance should be explained plainly without mixing facts and forecasts.`,
    contrarian_opinion: `My take for ${audience}: beyond the obvious interpretation, it is worth testing an alternative scenario and its limits.`,
    industry_impact: `My take for ${audience}: the key question is how the verified event may affect the industry without presenting a forecast as fact.`,
    career_implications: `My take for ${audience}: the professional value lies in possible implications for skills and roles, not in dramatic predictions.`
  };
  return postLanguage === 'ru' ? ru[angle] : en[angle];
}

function buildPost({ source, postLanguage, tone, audienceKey, customAudience, angleKey }) {
  const sourceUrl = source?.source_url || source?.url;
  const title = clean(source?.source_title || source?.title, 300);
  const fact = sourceFact(source);
  const audience = audienceLabel({ audienceKey, customAudience });
  const angle = angleLabel({ angleKey });

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
      perspectiveLead({ postLanguage, angleKey, audience }),
      `Редакционный ракурс: ${angle}. Выводы должны опираться только на подтверждённые данные из первоисточника.`,
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
    perspectiveLead({ postLanguage, angleKey, audience }),
    `Editorial angle: ${angle}. Conclusions should stay anchored to the evidence in the original source.`,
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
  tone,
  audienceKey = 'professional_network',
  customAudience = null,
  angleKey = 'expert_take'
}) {
  const startedAt = Date.now();
  const sourceUrl = source?.source_url || source?.url;
  const title = clean(source?.source_title || source?.title, 300);
  const fact = sourceFact(source);
  const postText = buildPost({ source, postLanguage, tone, audienceKey, customAudience, angleKey });
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
