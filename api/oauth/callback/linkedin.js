import crypto from 'node:crypto';
import { getLinkedInConfig, getLinkedInShareConfig, getLinkedInVerificationConfig, getTelegramConfig } from '../../../src/config/env.js';
import {
  exchangeCodeForToken,
  fetchOidcDiscovery,
  fetchUserInfo,
  validateIdToken,
  verifySignedState
} from '../../../src/lib/linkedin/oidc.js';
import { buildVerificationSnapshotSummary, syncVerifiedOnLinkedIn } from '../../../src/lib/linkedin/verified.js';
import { describeLinkedInVerificationSyncReason } from '../../../src/lib/linkedin/trust.js';
import {
  buildConnectedSummary,
  buildIdentityImportSummary,
  buildManualProfileFieldsReminder,
  buildPersistenceSummary,
  pickLinkedInIdentityClaims
} from '../../../src/lib/linkedin/profile.js';
import { persistLinkedInIdentity } from '../../../src/lib/storage/linkedinIdentityStore.js';
import { publishLinkedInShareForOAuthCallback } from '../../../src/lib/storage/linkedinShareStore.js';
import { sendTelegramMessage } from '../../../src/lib/telegram/botApi.js';
import { memberReasonText } from '../../../src/lib/telegram/memberCopy.js';
import { loadInterfaceLanguageForNotification } from '../../../src/lib/storage/languagePreferenceStore.js';
import { escapeOAuthHtml as escapeHtml, oauthText, renderLinkedInOAuthHtml } from '../../../src/lib/linkedin/oauthLanguage.js';

function renderHtml({ interfaceLanguage = 'en', title, body }) {
  return renderLinkedInOAuthHtml({ interfaceLanguage, title, body });
}

function describeError(error) {
  if (!error) {
    return { name: 'UnknownError', message: 'Unknown error' };
  }

  const summary = {
    name: error.name || 'Error',
    message: error.message || String(error)
  };

  if (error.code) {
    summary.code = error.code;
  }
  if (error.status) {
    summary.status = error.status;
  }
  if (error.cause?.message) {
    summary.cause = error.cause.message;
  }

  return summary;
}

function buildLinkedInShareResultMessage(result, interfaceLanguage = 'en') {
  const russian = interfaceLanguage === 'ru';
  const isNewsDraft = result?.intent?.source_kind === 'ai_news_draft';
  const lines = [russian
    ? (isNewsDraft ? '🧠 AI/news-черновик в LinkedIn' : '📣 Публикация профиля в LinkedIn')
    : (isNewsDraft ? '🧠 AI/news draft on LinkedIn' : '📣 Share profile on LinkedIn'), ''];
  if (result?.published) {
    lines.push(russian ? '✅ Опубликовано в вашем LinkedIn ровно один раз.' : '✅ Published once to your LinkedIn account.');
    lines.push(`• Post ID: ${result.provider?.postId || result.intent?.provider_post_id || (russian ? 'сохранён' : 'recorded')}`);
    lines.push(russian
      ? '• OAuth access token использован только для этого запроса и не сохранён Intro Deck.'
      : '• The OAuth access token was used for this request and was not stored by Intro Deck.');
    return lines.join('\n');
  }
  if (result?.alreadyPublished) {
    lines.push(russian
      ? 'ℹ️ Эта подтверждённая публикация уже выполнена. Дубликат не создавался.'
      : 'ℹ️ This approved share was already published. No duplicate post was created.');
    if (result.intent?.provider_post_id) lines.push(`• Post ID: ${result.intent.provider_post_id}`);
    return lines.join('\n');
  }
  if (result?.inProgress) {
    lines.push(russian
      ? '⏳ Публикация уже выполняется. Не подтверждайте тот же пост повторно.'
      : '⏳ Publishing is already in progress. Do not approve the same share again.');
    return lines.join('\n');
  }
  if (result?.outcomeUnknown || result?.reason === 'share_outcome_unknown') {
    if (result?.provider?.postId) {
      lines.push(russian
        ? '⚠️ LinkedIn вернул Post ID, но Intro Deck не смог завершить локальную фиксацию результата.'
        : '⚠️ LinkedIn returned a post ID, but Intro Deck could not finalize the local publication receipt.');
      lines.push(`• Provider post ID: ${result.provider.postId}`);
    } else {
      lines.push(russian
        ? '⚠️ LinkedIn не вернул однозначный результат публикации.'
        : '⚠️ LinkedIn did not return a conclusive publication result.');
    }
    lines.push(russian
      ? '• Автоматический повтор заблокирован, чтобы не создать дубликат.'
      : '• Automatic retry is blocked to prevent a duplicate post.');
    lines.push(russian
      ? '• Проверьте ленту LinkedIn перед созданием новой публикации.'
      : '• Check your LinkedIn feed before creating another share.');
    if (result.error?.requestId) lines.push(`• LinkedIn request ID: ${result.error.requestId}`);
    return lines.join('\n');
  }
  lines.push(russian ? '❌ Пост LinkedIn не опубликован.' : '❌ The LinkedIn post was not published.');
  lines.push(`• ${russian ? 'LinkedIn отклонил запрос публикации.' : memberReasonText(result?.reason, 'LinkedIn rejected the publication request.')}`);
  if (result?.error?.status) lines.push(`• HTTP status: ${result.error.status}`);
  if (result?.error?.requestId) lines.push(`• LinkedIn request ID: ${result.error.requestId}`);
  lines.push(russian
    ? (isNewsDraft ? '• AI/news-черновик остаётся доступен для проверки после подтверждённой ошибки.' : '• Профиль Intro Deck не изменён.')
    : (isNewsDraft ? '• Your AI/news draft remains available for review when the outcome is confirmed failed.' : '• Your Intro Deck profile remains unchanged.'));
  return lines.join('\n');
}

async function notifyLinkedInShareResult({ telegramUserId, result, interfaceLanguage = 'en' }) {
  const { botToken } = getTelegramConfig();
  const russian = interfaceLanguage === 'ru';
  const isNewsDraft = result?.intent?.source_kind === 'ai_news_draft';
  await sendTelegramMessage({
    botToken,
    chatId: telegramUserId,
    text: buildLinkedInShareResultMessage(result, interfaceLanguage),
    replyMarkup: {
      inline_keyboard: [
        [{ text: russian ? (isNewsDraft ? '🗞 Поиск историй' : '👁 Предпросмотр профиля') : (isNewsDraft ? '🗞 Story finder' : '👁 Profile preview'), callback_data: isNewsDraft ? 'news:home' : 'p:prev' }],
        [{ text: russian ? '🏠 Главная' : '🏠 Home', callback_data: 'home:root' }]
      ]
    }
  });
}

function renderLinkedInShareResultPage(result, interfaceLanguage = 'en') {
  const russian = interfaceLanguage === 'ru';
  const isNewsDraft = result?.intent?.source_kind === 'ai_news_draft';
  if (result?.published || result?.alreadyPublished) {
    const postId = result.provider?.postId || result.intent?.provider_post_id || null;
    return renderHtml({
      interfaceLanguage,
      title: oauthText(interfaceLanguage, 'LinkedIn post published', 'Пост LinkedIn опубликован'),
      body: `<h1>${oauthText(interfaceLanguage, 'LinkedIn post published', 'Пост LinkedIn опубликован')}</h1><p>${russian ? (isNewsDraft ? 'Подтверждённый AI/news-черновик с источниками' : 'Подтверждённая публикация профиля Intro Deck') : (isNewsDraft ? 'Your approved evidence-bound news draft' : 'Your approved Intro Deck profile share')} ${russian ? 'опубликован ровно один раз.' : 'was published once.'}</p>${postId ? `<p class="meta">Post ID: <code>${escapeHtml(postId)}</code></p>` : ''}<p>${oauthText(interfaceLanguage, 'Return to Telegram to continue.', 'Вернитесь в Telegram, чтобы продолжить.')}</p>`
    });
  }
  if (result?.inProgress) {
    return renderHtml({
      interfaceLanguage,
      title: oauthText(interfaceLanguage, 'LinkedIn post is publishing', 'Пост LinkedIn публикуется'),
      body: oauthText(interfaceLanguage,
        '<h1>Publishing is already in progress</h1><p>Do not repeat the approval. Return to Telegram for the final receipt.</p>',
        '<h1>Публикация уже выполняется</h1><p>Не подтверждайте действие повторно. Вернитесь в Telegram за итоговым результатом.</p>')
    });
  }
  if (result?.outcomeUnknown || result?.reason === 'share_outcome_unknown') {
    const providerPostId = result?.provider?.postId || null;
    return renderHtml({
      interfaceLanguage,
      title: oauthText(interfaceLanguage, 'LinkedIn publication needs review', 'Публикацию LinkedIn нужно проверить'),
      body: `<h1>${oauthText(interfaceLanguage, 'Publication needs review', 'Публикацию нужно проверить')}</h1>${providerPostId ? `<p>${oauthText(interfaceLanguage, 'LinkedIn returned post ID', 'LinkedIn вернул Post ID')} <code>${escapeHtml(providerPostId)}</code>, ${oauthText(interfaceLanguage, 'but Intro Deck could not finalize the local receipt.', 'но Intro Deck не смог завершить локальную фиксацию результата.')}</p>` : `<p>${oauthText(interfaceLanguage, 'LinkedIn did not return a conclusive publication result.', 'LinkedIn не вернул однозначный результат публикации.')}</p>`}<p>${oauthText(interfaceLanguage, 'Automatic retry is blocked to prevent a duplicate post. Check your LinkedIn feed before trying again.', 'Автоматический повтор заблокирован, чтобы не создать дубликат. Проверьте ленту LinkedIn перед новой попыткой.')}</p>`
    });
  }
  return renderHtml({
    interfaceLanguage,
    title: oauthText(interfaceLanguage, 'LinkedIn post not published', 'Пост LinkedIn не опубликован'),
    body: `<h1>${oauthText(interfaceLanguage, 'LinkedIn post was not published', 'Пост LinkedIn не опубликован')}</h1><p>${escapeHtml(russian ? 'LinkedIn отклонил запрос публикации.' : memberReasonText(result?.reason, 'LinkedIn rejected the publication request.'))}</p><p>${oauthText(interfaceLanguage, 'Return to Telegram to review the result.', 'Вернитесь в Telegram, чтобы проверить результат.')}</p>`
  });
}

function safeVerificationTransferPayload(verificationSync) {
  if (!verificationSync?.requested) {
    return {
      requested: false,
      status: verificationSync?.status || 'not_requested',
      reason: verificationSync?.reason || 'linkedin_verified_not_requested',
      snapshot: null
    };
  }

  const snapshot = verificationSync.snapshot
    ? {
        apiMemberId: verificationSync.snapshot.apiMemberId,
        verificationCategories: verificationSync.snapshot.verificationCategories,
        identityVerified: Boolean(verificationSync.snapshot.identityVerified),
        workplaceVerified: Boolean(verificationSync.snapshot.workplaceVerified),
        verificationState: verificationSync.snapshot.verificationState,
        verificationUrlOffered: Boolean(verificationSync.snapshot.verificationUrlOffered),
        sourceTier: verificationSync.snapshot.sourceTier,
        identityApiVersion: verificationSync.snapshot.identityApiVersion,
        reportApiVersion: verificationSync.snapshot.reportApiVersion,
        profileLastRefreshedAt: verificationSync.snapshot.profileLastRefreshedAt || null,
        syncedAt: verificationSync.snapshot.syncedAt
      }
    : null;

  return {
    requested: true,
    status: verificationSync.status || 'unavailable',
    reason: verificationSync.reason || 'linkedin_verified_sync_unavailable',
    snapshot,
    diagnostics: verificationSync.diagnostics
      ? {
          verificationReportStrategy: verificationSync.diagnostics.verificationReportStrategy || null,
          requestId: verificationSync.diagnostics.requestId || null,
          fallbackAttempted: Boolean(verificationSync.diagnostics.fallbackAttempted),
          primaryStatus: verificationSync.diagnostics.primaryStatus || null,
          primaryCode: verificationSync.diagnostics.primaryCode || null,
          primaryRequestId: verificationSync.diagnostics.primaryRequestId || null
        }
      : null,
    error: verificationSync.error
      ? {
          status: verificationSync.error.status || null,
          code: verificationSync.error.code || null,
          endpoint: verificationSync.error.endpoint || null,
          requestId: verificationSync.error.requestId || null,
          attempt: verificationSync.error.attempt || null,
          compatibilityFallbackAttempted: Boolean(verificationSync.error.compatibilityFallbackAttempted),
          primaryStatus: verificationSync.error.primaryStatus || null,
          primaryCode: verificationSync.error.primaryCode || null,
          primaryRequestId: verificationSync.error.primaryRequestId || null
        }
      : null
  };
}

function safeVerificationUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !(url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com'))) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function buildRussianConnectedSummary(identity = {}) {
  const parts = [];
  if (identity.name) parts.push(`имя=${identity.name}`);
  if (identity.pictureUrl) parts.push('фото=импортировано');
  if (identity.locale) parts.push(`локаль=${identity.locale}`);
  if (identity.email) parts.push(`email=${identity.email}`);
  return parts.length ? parts.join(', ') : 'Базовая identity LinkedIn импортирована';
}

function buildRussianIdentityImportSummary(identity = {}) {
  const fields = [];
  if (identity.linkedinSub) fields.push('привязка identity');
  if (identity.name) fields.push('имя');
  if (identity.givenName) fields.push('имя отдельно');
  if (identity.familyName) fields.push('фамилия');
  if (identity.pictureUrl) fields.push('фото');
  if (identity.locale) fields.push('локаль');
  if (identity.email) fields.push('email');
  return fields.length
    ? `Базовый импорт LinkedIn: ${fields.join(', ')}`
    : 'Базовый импорт LinkedIn готов';
}

function buildRussianPersistenceSummary(persistResult) {
  return persistResult?.persisted
    ? 'Подключение LinkedIn сохранено.'
    : 'LinkedIn подключён, но сохранение профиля временно недоступно.';
}

function buildRussianManualProfileFieldsReminder() {
  return 'Заголовок, компания, город, отрасль, описание, навыки и публичная ссылка LinkedIn редактируются в Telegram.';
}

function buildRussianVerificationSnapshotSummary(snapshot) {
  if (!snapshot) return 'Снимок проверки недоступен';
  const categories = [];
  if (snapshot.identityVerified) categories.push('личность');
  if (snapshot.workplaceVerified) categories.push('место работы');
  return categories.length
    ? `Подтверждено LinkedIn: ${categories.join(' + ')}`
    : `Подтверждено LinkedIn: завершённых категорий нет (код состояния: ${snapshot.verificationState || 'unknown'})`;
}

function buildVerificationMessageLines({ verificationSync, persistResult, interfaceLanguage = 'en' }) {
  if (!verificationSync?.requested) return [];
  const russian = interfaceLanguage === 'ru';
  const lines = [russian ? '🛡 Проверка LinkedIn' : '🛡 Verified on LinkedIn'];
  if (verificationSync.status === 'success' && verificationSync.snapshot) {
    lines.push(`• ${russian ? buildRussianVerificationSnapshotSummary(verificationSync.snapshot) : buildVerificationSnapshotSummary(verificationSync.snapshot)}`);
    lines.push(`• ${russian ? 'Личность' : 'Identity'}: ${verificationSync.snapshot.identityVerified ? (russian ? 'подтверждена LinkedIn' : 'confirmed by LinkedIn') : (russian ? 'не подтверждена' : 'not present')}`);
    lines.push(`• ${russian ? 'Место работы' : 'Workplace'}: ${verificationSync.snapshot.workplaceVerified ? (russian ? 'подтверждено LinkedIn' : 'confirmed by LinkedIn') : (russian ? 'не подтверждено' : 'not present')}`);
    if (persistResult?.verificationPersistence?.persisted) {
      lines.push(russian ? '• Снимок категорий сохранён в Intro Deck.' : '• Category snapshot saved in Intro Deck.');
    } else if (persistResult?.verificationPersistence?.reason === 'migration_028_required') {
      lines.push(russian ? '• Не удалось сохранить детали доверия LinkedIn.' : '• LinkedIn trust details could not be saved right now.');
    }
  } else {
    lines.push(`• ${russian ? 'Синхронизация проверки LinkedIn недоступна.' : describeLinkedInVerificationSyncReason(verificationSync.reason, verificationSync.error)}`);
    if (verificationSync.error?.endpoint) lines.push(`• Failed API: ${verificationSync.error.endpoint}`);
    if (verificationSync.error?.compatibilityFallbackAttempted) lines.push(russian ? '• Повтор совместимости без verification criteria также завершился ошибкой.' : '• Compatibility retry without verification criteria also failed.');
    if (verificationSync.error?.requestId) lines.push(`• LinkedIn request ID: ${verificationSync.error.requestId}`);
    lines.push(russian ? '• Обычное подключение LinkedIn остаётся активным.' : '• Your normal LinkedIn connection remains active.');
  }
  lines.push(russian ? '• Development mode доступен только администраторам LinkedIn developer app.' : '• Development mode is limited to LinkedIn developer-app administrators.');
  lines.push(russian ? '• Должность, компания, навыки, bio и опыт по-прежнему заполняются пользователем.' : '• Role, company, skills, bio, and experience remain member-provided.');
  return lines;
}

function base64UrlJson(input) {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
}

function parseBase64UrlJson(token) {
  return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
}

function createSignature(payloadToken, secret) {
  return crypto.createHmac('sha256', secret).update(payloadToken).digest('base64url');
}

function buildSignedTransferToken({ payload, secret, ttlSeconds = 600 }) {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    kind: 'linkedin_transfer',
    iat: now,
    exp: now + ttlSeconds,
    nonce: crypto.randomBytes(12).toString('hex')
  };
  const payloadToken = base64UrlJson(tokenPayload);
  const signature = createSignature(payloadToken, secret);
  return `${payloadToken}.${signature}`;
}

function verifySignedTransferToken(token, secret) {
  if (!token || !token.includes('.')) {
    throw new Error('Missing or malformed transfer token');
  }

  const [payloadToken, signature] = token.split('.', 2);
  const expectedSignature = createSignature(payloadToken, secret);
  const provided = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('Invalid transfer token signature');
  }

  const payload = parseBase64UrlJson(payloadToken);
  const now = Math.floor(Date.now() / 1000);
  if (payload.kind !== 'linkedin_transfer') {
    throw new Error('Invalid transfer token kind');
  }
  if (!payload.exp || payload.exp < now) {
    throw new Error('Expired transfer token');
  }

  return payload;
}

function buildTransferConfirmationBody({ transferUrl, identity, previousTelegramUsername, interfaceLanguage = 'en' }) {
  const russian = interfaceLanguage === 'ru';
  const currentName = escapeHtml(identity?.name || (russian ? 'этот аккаунт LinkedIn' : 'this LinkedIn account'));
  const previousOwner = previousTelegramUsername ? `@${escapeHtml(previousTelegramUsername)}` : (russian ? 'другому Telegram-аккаунту' : 'another Telegram account');
  return `
    <h1>${russian ? 'Перенести подключение LinkedIn?' : 'Move LinkedIn connection?'}</h1>
    <p><strong>${currentName}</strong> ${russian ? `уже подключён к ${previousOwner}.` : `is already connected to ${previousOwner}.`}</p>
    <p>${russian ? 'Вы можете перенести подключение сюда. Предыдущий Telegram-аккаунт будет отключён, а его публичная карточка скрыта.' : 'You can move this LinkedIn connection here. The previous Telegram account will be disconnected, and any public listing on that account will be hidden.'}</p>
    <div class="actions">
      <a class="button button-primary" href="${escapeHtml(transferUrl)}">${russian ? 'Перенести подключение сюда' : 'Move connection here'}</a>
      <a class="button button-secondary" href="/privacy/">${russian ? 'Отмена' : 'Cancel'}</a>
    </div>
    <p class="meta">${russian ? 'Одна и та же LinkedIn identity может быть подключена только к одному Telegram-аккаунту.' : 'Only one Telegram account can hold the same LinkedIn identity at a time.'}</p>
  `;
}

function buildTelegramConnectionMessage({ identity, persistResult, verificationSync, interfaceLanguage = 'en' }) {
  const russian = interfaceLanguage === 'ru';
  const successText = persistResult?.transferred
    ? (russian ? '✅ Подключение LinkedIn перенесено на этот Telegram-аккаунт.' : '✅ LinkedIn connection moved to this Telegram account.')
    : (russian ? '✅ LinkedIn подключён.' : '✅ LinkedIn connected.');
  const lines = [successText, ''];
  lines.push(russian ? '🔗 Импорт из LinkedIn' : '🔗 LinkedIn import');
  lines.push(`• ${russian ? buildRussianConnectedSummary(identity) : (buildConnectedSummary(identity) || 'Basic LinkedIn identity imported')}`);
  lines.push(`• ${russian ? buildRussianIdentityImportSummary(identity) : buildIdentityImportSummary(identity)}`);
  lines.push('');
  lines.push(russian ? '💾 Сохранено в Intro Deck' : '💾 Saved in Intro Deck');
  lines.push(`• ${russian ? buildRussianPersistenceSummary(persistResult) : buildPersistenceSummary(persistResult)}`);
  lines.push(`• ${persistResult?.profileSeed?.displayNameSeeded
    ? (russian ? 'Имя карточки заполнено из LinkedIn, потому что поле было пустым.' : 'Display name was seeded because your card name was still empty.')
    : (russian ? 'Существующие поля карточки сохранены без изменений.' : 'Existing manual card fields were kept as-is.')}`);
  lines.push('');
  lines.push(russian ? '✍️ Можно изменить в Telegram' : '✍️ Still editable in Telegram');
  lines.push(`• ${russian ? buildRussianManualProfileFieldsReminder() : buildManualProfileFieldsReminder()}`);
  const verificationLines = buildVerificationMessageLines({ verificationSync, persistResult, interfaceLanguage });
  if (verificationLines.length) { lines.push(''); lines.push(...verificationLines); }
  lines.push('');
  lines.push(russian ? '➡️ Дальше' : '➡️ Next');
  lines.push(persistResult?.transferred
    ? (russian ? '• Предыдущий Telegram-аккаунт отключён, его публичная карточка скрыта.' : '• The previous Telegram account was disconnected, and its public listing was hidden.')
    : (russian ? '• Откройте редактор профиля в Telegram, проверьте и завершите карточку.' : '• Open the profile editor in Telegram to review and finish your card.'));
  return lines.join('\n');
}

async function notifyTelegramConnectionResult({ statePayload, identity, persistResult, verificationSync }) {
  const { botToken } = getTelegramConfig();
  const interfaceLanguage = statePayload.interfaceLanguage || 'en';
  const russian = interfaceLanguage === 'ru';
  const rows = [];
  const verificationUrl = safeVerificationUrl(verificationSync?.verificationUrl);
  if (verificationUrl) rows.push([{ text: russian ? '🛡 Завершить проверку LinkedIn' : '🛡 Complete LinkedIn verification', url: verificationUrl }]);
  rows.push([{ text: russian ? '🧩 Завершить профиль' : '🧩 Complete profile', callback_data: 'p:menu' }, { text: russian ? '🏠 Главная' : '🏠 Home', callback_data: 'home:root' }]);
  await sendTelegramMessage({
    botToken,
    chatId: statePayload.telegramUserId,
    text: buildTelegramConnectionMessage({ identity, persistResult, verificationSync, interfaceLanguage }),
    replyMarkup: { inline_keyboard: rows }
  });
}

function buildPreviousOwnerMessage(interfaceLanguage = 'en') {
  return interfaceLanguage === 'ru'
    ? ['⚠️ Подключение LinkedIn перенесено', '', 'Ваше подключение LinkedIn перенесено на другой Telegram-аккаунт.', 'Публичная карточка этого Telegram-аккаунта скрыта.'].join('\n')
    : ['⚠️ LinkedIn connection moved', '', 'Your LinkedIn connection was moved to another Telegram account.', 'Your directory listing on this Telegram account was hidden.'].join('\n');
}

async function notifyPreviousOwnerIfTransferred({ persistResult }) {
  if (!persistResult?.transferred || !persistResult?.previousOwner?.telegramUserId) return;
  const { botToken } = getTelegramConfig();
  const interfaceLanguage = await loadInterfaceLanguageForNotification(persistResult.previousOwner.telegramUserId);
  await sendTelegramMessage({
    botToken,
    chatId: persistResult.previousOwner.telegramUserId,
    text: buildPreviousOwnerMessage(interfaceLanguage),
    replyMarkup: { inline_keyboard: [[{ text: interfaceLanguage === 'ru' ? '🏠 Главная' : '🏠 Home', callback_data: 'home:root' }]] }
  });
}

function renderPersistenceSuccessPage({ identity, persistResult, verificationSync, interfaceLanguage = 'en' }) {
  const { botUsername } = getTelegramConfig();
  const russian = interfaceLanguage === 'ru';
  const title = persistResult?.transferred
    ? (russian ? 'Подключение LinkedIn перенесено' : 'LinkedIn connection moved')
    : (russian ? 'LinkedIn подключён' : 'LinkedIn connected');
  const linkedInItems = [
    identity?.name ? `${russian ? 'Имя' : 'Name'}: ${identity.name}` : null,
    identity?.givenName ? `${russian ? 'Имя' : 'Given name'}: ${identity.givenName}` : null,
    identity?.familyName ? `${russian ? 'Фамилия' : 'Family name'}: ${identity.familyName}` : null,
    identity?.pictureUrl ? (russian ? 'Фото: импортировано' : 'Photo: imported') : null,
    identity?.locale ? `Locale: ${identity.locale}` : null,
    identity?.email ? `Email: ${identity.email}` : null
  ].filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const savedItems = [
    russian ? 'Identity binding: сохранён' : 'Identity binding: saved',
    Array.isArray(persistResult?.identityImportedFields) ? `${russian ? 'Импортировано полей' : 'Imported fields'}: ${persistResult.identityImportedFields.length}` : null,
    persistResult?.profileDraft?.profile_state ? `${russian ? 'Состояние профиля' : 'Profile state'}: ${persistResult.profileDraft.profile_state}` : null,
    persistResult?.profileDraft?.visibility_status ? `${russian ? 'Видимость' : 'Visibility'}: ${persistResult.profileDraft.visibility_status}` : null,
    persistResult?.profileSeed?.displayNameSeeded ? (russian ? 'Имя карточки: заполнено из LinkedIn' : 'Display name: seeded from LinkedIn') : (russian ? 'Ручные поля карточки: сохранены' : 'Manual card fields: kept as-is')
  ].filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const editableItems = (russian
    ? ['Заголовок', 'Компания', 'Город', 'Отрасль', 'О себе', 'Навыки', 'Публичная ссылка LinkedIn']
    : ['Headline', 'Company', 'City', 'Industry', 'About', 'Skills', 'Public LinkedIn URL'])
    .map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const nextItems = [
    persistResult?.transferred
      ? (russian ? 'Предыдущий Telegram-аккаунт отключён и скрыт из каталога.' : 'The previous Telegram account was disconnected and hidden from the directory.')
      : (russian ? 'LinkedIn identity подключена. Проверьте и завершите карточку в Telegram.' : 'Your LinkedIn identity is connected. Review and finish your card in Telegram.'),
    russian ? 'Вернитесь в Telegram, когда будете готовы.' : 'Return to Telegram when you are ready.'
  ].map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const verificationLines = buildVerificationMessageLines({ verificationSync, persistResult, interfaceLanguage });
  const verificationItems = verificationLines.slice(1).map((item) => `<li>${escapeHtml(item.replace(/^•\s*/, ''))}</li>`).join('');
  const verificationUrl = safeVerificationUrl(verificationSync?.verificationUrl);
  const botUrl = botUsername ? `https://t.me/${encodeURIComponent(botUsername.replace(/^@+/, ''))}` : null;
  return renderHtml({
    interfaceLanguage,
    title,
    body: `
      <h1>${escapeHtml(title)}</h1>
      <h2>${russian ? 'Импорт из LinkedIn' : 'LinkedIn import'}</h2>
      <ul>${linkedInItems || `<li>${russian ? 'Базовая identity LinkedIn импортирована' : 'Basic LinkedIn identity imported'}</li>`}</ul>
      <h2>${russian ? 'Сохранено в Intro Deck' : 'Saved in Intro Deck'}</h2>
      <ul>${savedItems}</ul>
      <h2>${russian ? 'Можно изменить в Telegram' : 'Still editable in Telegram'}</h2>
      <ul>${editableItems}</ul>
      ${verificationSync?.requested ? `<h2>${russian ? 'Проверка LinkedIn' : 'Verified on LinkedIn'}</h2><ul>${verificationItems || `<li>${russian ? 'Синхронизация проверки недоступна.' : 'Verification sync was not available.'}</li>`}</ul>` : ''}
      <h2>${russian ? 'Дальше' : 'Next'}</h2>
      <ul>${nextItems}</ul>
      <div class="actions">
        ${verificationUrl ? `<a class="button button-primary" href="${escapeHtml(verificationUrl)}">${russian ? 'Завершить проверку LinkedIn' : 'Complete LinkedIn verification'}</a>` : ''}
        ${botUrl ? `<a class="button ${verificationUrl ? 'button-secondary' : 'button-primary'}" href="${escapeHtml(botUrl)}">${russian ? 'Открыть' : 'Open'} @${escapeHtml(botUsername.replace(/^@+/, ''))}</a>` : ''}
        <a class="button button-secondary" href="/privacy/">${russian ? 'Конфиденциальность' : 'Privacy'}</a>
      </div>`
  });
}

async function finalizePersistence({
  statePayload,
  identity,
  rawTokenPayload,
  rawUserInfo,
  verificationSync,
  transferMode
}) {
  const persistResult = await persistLinkedInIdentity({
    telegramUserId: statePayload.telegramUserId,
    telegramUsername: statePayload.telegramUsername || null,
    identity,
    rawTokenPayload,
    rawUserInfo,
    verificationSnapshot: verificationSync?.snapshot || null,
    verificationSync: safeVerificationTransferPayload(verificationSync),
    transferMode
  });

  return persistResult;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send(renderHtml({
      title: 'Method not allowed',
      body: '<h1>Method not allowed</h1>'
    }));
  }

  const url = new URL(req.url, 'http://localhost');
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const transferToken = url.searchParams.get('transfer_token');

  let stage = 'config';
  let statePayload = null;

  try {
    const linkedinConfig = getLinkedInConfig();

    if (error) {
      let interfaceLanguage = 'en';
      if (state) {
        try {
          interfaceLanguage = verifySignedState(state, linkedinConfig.stateSecret).interfaceLanguage || 'en';
        } catch {
          interfaceLanguage = 'en';
        }
      }
      return res.status(400).send(renderHtml({
        interfaceLanguage,
        title: oauthText(interfaceLanguage, 'LinkedIn sign-in canceled', 'Вход через LinkedIn отменён'),
        body: `<h1>${oauthText(interfaceLanguage, 'LinkedIn sign-in was canceled', 'Вход через LinkedIn отменён')}</h1><p><code>${escapeHtml(error)}</code></p>`
      }));
    }

    if (transferToken) {
      stage = 'verify_transfer_token';
      const transferPayload = verifySignedTransferToken(transferToken, linkedinConfig.stateSecret);
      statePayload = {
        telegramUserId: transferPayload.telegramUserId,
        telegramUsername: transferPayload.telegramUsername || null,
        returnTo: transferPayload.returnTo || '/menu',
        interfaceLanguage: transferPayload.interfaceLanguage || 'en',
        postLanguage: transferPayload.postLanguage || 'en'
      };

      stage = 'confirm_transfer';
      const persistResult = await finalizePersistence({
        statePayload,
        identity: transferPayload.identity,
        rawTokenPayload: null,
        rawUserInfo: null,
        verificationSync: transferPayload.verificationSync || { requested: false, status: 'not_requested', snapshot: null },
        transferMode: 'confirm'
      });

      try {
        stage = 'notify_telegram';
        await notifyTelegramConnectionResult({ statePayload, identity: transferPayload.identity, persistResult, verificationSync: transferPayload.verificationSync });
      } catch (notifyError) {
        console.warn('[linkedin callback] telegram notify skipped', {
          stage: 'notify_telegram',
          telegramUserId: statePayload.telegramUserId,
          error: describeError(notifyError)
        });
      }

      try {
        stage = 'notify_previous_owner';
        await notifyPreviousOwnerIfTransferred({ persistResult });
      } catch (notifyPreviousError) {
        console.warn('[linkedin callback] previous owner notify skipped', {
          stage: 'notify_previous_owner',
          telegramUserId: persistResult?.previousOwner?.telegramUserId || null,
          error: describeError(notifyPreviousError)
        });
      }

      return res.status(200).send(renderPersistenceSuccessPage({
        identity: transferPayload.identity,
        persistResult,
        verificationSync: transferPayload.verificationSync,
        interfaceLanguage: statePayload.interfaceLanguage
      }));
    }

    if (!code || !state) {
      return res.status(400).send(renderHtml({
        title: 'Missing callback parameters',
        body: '<h1>Missing callback parameters</h1><p>Expected both <code>code</code> and <code>state</code>.</p>'
      }));
    }

    stage = 'verify_state';
    statePayload = verifySignedState(state, linkedinConfig.stateSecret);

    stage = 'fetch_discovery';
    const discovery = await fetchOidcDiscovery(linkedinConfig.oidcDiscoveryUrl);

    stage = 'exchange_token';
    const tokenPayload = await exchangeCodeForToken({
      discovery,
      clientId: linkedinConfig.clientId,
      clientSecret: linkedinConfig.clientSecret,
      redirectUri: linkedinConfig.redirectUri,
      code
    });

    let idTokenClaims = {};
    if (tokenPayload.id_token) {
      stage = 'validate_id_token';
      idTokenClaims = await validateIdToken({
        idToken: tokenPayload.id_token,
        discovery,
        clientId: linkedinConfig.clientId
      });
    }

    let userInfo = {};
    if (tokenPayload.access_token) {
      stage = 'fetch_userinfo';
      userInfo = await fetchUserInfo({
        discovery,
        accessToken: tokenPayload.access_token
      });
    }

    stage = 'extract_identity';
    const identity = pickLinkedInIdentityClaims({ idTokenClaims, userInfo });

    if (statePayload.shareRequested || statePayload.purpose === 'share_profile') {
      stage = 'publish_linkedin_profile_share';
      const shareConfig = getLinkedInShareConfig();
      let shareResult;
      if (
        !shareConfig.enabled
        || shareConfig.configurationValid === false
        || !statePayload.shareIntentToken
        || statePayload.purpose !== 'share_profile'
      ) {
        shareResult = {
          published: false,
          reason: 'linkedin_share_runtime_config_changed'
        };
      } else {
        shareResult = await publishLinkedInShareForOAuthCallback({
          publicToken: statePayload.shareIntentToken,
          telegramUserId: statePayload.telegramUserId,
          linkedinSub: identity.linkedinSub,
          accessToken: tokenPayload.access_token,
          shareConfig
        });
      }

      try {
        stage = 'notify_linkedin_share_result';
        await notifyLinkedInShareResult({
          telegramUserId: statePayload.telegramUserId,
          result: shareResult,
          interfaceLanguage: statePayload.interfaceLanguage || 'en'
        });
      } catch (notifyError) {
        console.warn('[linkedin share callback] telegram notify skipped', {
          telegramUserId: statePayload.telegramUserId,
          error: describeError(notifyError)
        });
      }

      const statusCode = shareResult?.published || shareResult?.alreadyPublished ? 200 : 409;
      return res.status(statusCode).send(renderLinkedInShareResultPage(shareResult, statePayload.interfaceLanguage || 'en'));
    }

    let verificationSync = {
      requested: false,
      status: 'not_requested',
      reason: 'linkedin_verified_not_requested',
      snapshot: null,
      verificationUrl: null
    };
    if (statePayload.verificationRequested) {
      stage = 'fetch_linkedin_verification';
      const verificationConfig = getLinkedInVerificationConfig();
      if (!verificationConfig.enabled || verificationConfig.mode !== statePayload.verificationMode) {
        verificationSync = {
          requested: true,
          status: 'unavailable',
          reason: 'linkedin_verified_runtime_mode_changed',
          snapshot: null,
          verificationUrl: null
        };
      } else {
        verificationSync = await syncVerifiedOnLinkedIn({
          accessToken: tokenPayload.access_token,
          verificationConfig
        });
      }
    }

    stage = 'persist_identity';
    const persistResult = await finalizePersistence({
      statePayload,
      identity,
      rawTokenPayload: tokenPayload,
      rawUserInfo: userInfo,
      verificationSync,
      transferMode: 'detect'
    });

    if (persistResult?.transferRequired) {
      stage = 'render_transfer_confirm';
      const token = buildSignedTransferToken({
        secret: linkedinConfig.stateSecret,
        payload: {
          telegramUserId: statePayload.telegramUserId,
          telegramUsername: statePayload.telegramUsername || null,
          returnTo: statePayload.returnTo || '/menu',
          interfaceLanguage: statePayload.interfaceLanguage || 'en',
          postLanguage: statePayload.postLanguage || 'en',
          identity,
          verificationSync: safeVerificationTransferPayload(verificationSync),
          previousUserId: persistResult.conflict.previousUserId,
          previousTelegramUserId: persistResult.conflict.previousTelegramUserId,
          previousTelegramUsername: persistResult.conflict.previousTelegramUsername
        }
      });
      const transferUrl = new URL(req.url, 'http://localhost');
      transferUrl.search = '';
      transferUrl.searchParams.set('transfer_token', token);

      const interfaceLanguage = statePayload.interfaceLanguage || 'en';
      return res.status(409).send(renderHtml({
        interfaceLanguage,
        title: oauthText(interfaceLanguage, 'LinkedIn already connected', 'LinkedIn уже подключён'),
        body: buildTransferConfirmationBody({
          transferUrl: transferUrl.pathname + transferUrl.search,
          identity,
          previousTelegramUsername: persistResult.conflict.previousTelegramUsername,
          interfaceLanguage
        })
      }));
    }

    try {
      stage = 'notify_telegram';
      await notifyTelegramConnectionResult({ statePayload, identity, persistResult, verificationSync });
    } catch (notifyError) {
      console.warn('[linkedin callback] telegram notify skipped', {
        stage: 'notify_telegram',
        telegramUserId: statePayload.telegramUserId,
        error: describeError(notifyError)
      });
    }

    return res.status(200).send(renderPersistenceSuccessPage({
      identity,
      persistResult,
      verificationSync,
      interfaceLanguage: statePayload.interfaceLanguage || 'en'
    }));
  } catch (callbackError) {
    console.error('[linkedin callback] failed', {
      stage,
      telegramUserId: statePayload?.telegramUserId || null,
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasTransferToken: Boolean(transferToken),
      error: describeError(callbackError)
    });

    const interfaceLanguage = statePayload?.interfaceLanguage || 'en';
    return res.status(500).send(renderHtml({
      interfaceLanguage,
      title: oauthText(interfaceLanguage, 'LinkedIn callback failed', 'Callback LinkedIn завершился ошибкой'),
      body: `
        <h1>${oauthText(interfaceLanguage, 'LinkedIn callback failed', 'Callback LinkedIn завершился ошибкой')}</h1>
        <p>${oauthText(interfaceLanguage, 'Please return to Telegram and try the connection again.', 'Вернитесь в Telegram и повторите подключение.')}</p>
        <p class="meta">${oauthText(interfaceLanguage, 'Failure stage', 'Этап ошибки')}: <code>${escapeHtml(stage)}</code>. ${oauthText(interfaceLanguage, 'Check the server logs for the detailed reason.', 'Подробная причина доступна в server logs.')}</p>
      `
    }));
  }
}
