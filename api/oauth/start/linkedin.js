import { getLinkedInConfig, getLinkedInShareConfig, getLinkedInVerificationConfig, isOperatorTelegramUser } from '../../../src/config/env.js';
import { buildAuthorizeUrl, buildSignedState, fetchOidcDiscovery, verifySignedLinkedInLaunchTicket } from '../../../src/lib/linkedin/oidc.js';
import { markLinkedInShareAuthorizationForTelegramUser } from '../../../src/lib/storage/linkedinShareStore.js';
import { loadUserLanguagePreferences } from '../../../src/lib/storage/languagePreferenceStore.js';
import { memberReasonText } from '../../../src/lib/telegram/memberCopy.js';
import { escapeOAuthHtml, oauthText, renderLinkedInOAuthHtml } from '../../../src/lib/linkedin/oauthLanguage.js';

function renderHtml({ interfaceLanguage = 'en', title, body }) {
  return renderLinkedInOAuthHtml({ interfaceLanguage, title, body });
}

async function loadStoredLanguages(telegramUserId) {
  const preferences = await loadUserLanguagePreferences({ telegramUserId, touch: false }).catch(() => null);
  return {
    interfaceLanguage: preferences?.interfaceLanguage || 'en',
    postLanguage: preferences?.defaultPostLanguage || 'en'
  };
}

function localizedReason(reason, fallback, interfaceLanguage) {
  const english = memberReasonText(reason, fallback);
  if (interfaceLanguage !== 'ru') return english;
  const map = {
    linkedin_share_intent_expired: 'Срок действия этого подтверждения публикации истёк.',
    linkedin_share_intent_missing: 'Подтверждение публикации не найдено.',
    linkedin_share_intent_not_owned: 'Это подтверждение публикации принадлежит другому пользователю.',
    linkedin_share_intent_cancelled: 'Публикация была отменена.',
    linkedin_share_intent_already_published: 'Этот пост уже опубликован.',
    linkedin_share_intent_in_progress: 'Публикация уже выполняется.'
  };
  return map[reason] || 'Не удалось авторизовать предпросмотр публикации.';
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
  const telegramUserId = url.searchParams.get('tg_id');
  const returnTo = url.searchParams.get('ret') || '/menu';
  const redirect = url.searchParams.get('redirect') !== '0';
  const rawPurpose = url.searchParams.get('purpose');
  const purpose = ['verification_refresh', 'share_profile'].includes(rawPurpose) ? rawPurpose : 'connect';
  const launchTicket = url.searchParams.get('ticket');

  if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
    return res.status(400).send(renderHtml({
      title: 'Invalid Telegram user',
      body: '<h1>Invalid Telegram user</h1><p>The sign-in link is missing a valid Telegram user id.</p>'
    }));
  }

  const storedLanguages = await loadStoredLanguages(telegramUserId);
  let interfaceLanguage = storedLanguages.interfaceLanguage;
  let postLanguage = storedLanguages.postLanguage;

  try {
    const { clientId, redirectUri, stateSecret, stateTtlSeconds, oidcDiscoveryUrl, scopes } = getLinkedInConfig();
    const verificationConfig = getLinkedInVerificationConfig();
    const shareConfig = getLinkedInShareConfig();
    const verificationEligible = verificationConfig.enabled && verificationConfig.configurationValid !== false && (
      verificationConfig.mode === 'lite'
      || (verificationConfig.mode === 'development' && isOperatorTelegramUser(telegramUserId))
    );
    let verificationRequested = false;
    let shareRequested = false;
    let shareIntentToken = null;

    if (purpose === 'verification_refresh') {
      let ticketPayload;
      try {
        ticketPayload = verifySignedLinkedInLaunchTicket(launchTicket, stateSecret);
      } catch {
        return res.status(403).send(renderHtml({
          interfaceLanguage,
          title: oauthText(interfaceLanguage, 'LinkedIn verification link expired', 'Ссылка проверки LinkedIn устарела'),
          body: oauthText(interfaceLanguage,
            '<h1>Verification link expired</h1><p>Return to your Intro Deck profile and open a fresh verification link.</p>',
            '<h1>Ссылка проверки устарела</h1><p>Вернитесь в профиль Intro Deck и откройте новую ссылку проверки.</p>')
        }));
      }
      interfaceLanguage = ticketPayload.interfaceLanguage || interfaceLanguage;
      postLanguage = ticketPayload.postLanguage || postLanguage;
      if (ticketPayload.telegramUserId !== String(telegramUserId) || ticketPayload.purpose !== purpose) {
        return res.status(403).send(renderHtml({
          interfaceLanguage,
          title: oauthText(interfaceLanguage, 'LinkedIn verification link rejected', 'Ссылка проверки LinkedIn отклонена'),
          body: oauthText(interfaceLanguage,
            '<h1>Verification link rejected</h1><p>Return to your Intro Deck profile and open a fresh verification link.</p>',
            '<h1>Ссылка проверки отклонена</h1><p>Вернитесь в профиль Intro Deck и откройте новую ссылку проверки.</p>')
        }));
      }
      verificationRequested = verificationEligible;
    }

    if (purpose === 'verification_refresh' && !verificationRequested) {
      const body = verificationConfig.configurationValid === false
        ? oauthText(interfaceLanguage,
            '<h1>Verification configuration needs attention</h1><p>The optional Verified on LinkedIn integration is temporarily disabled. The normal LinkedIn connection remains available.</p>',
            '<h1>Настройка проверки требует внимания</h1><p>Дополнительная интеграция Verified on LinkedIn временно отключена. Обычное подключение LinkedIn остаётся доступным.</p>')
        : verificationConfig.mode === 'development'
          ? oauthText(interfaceLanguage,
              '<h1>Verification testing is limited</h1><p>Development access is available only to configured Intro Deck operator accounts that are also LinkedIn developer-app administrators.</p>',
              '<h1>Тестирование проверки ограничено</h1><p>Development-доступ открыт только настроенным операторам Intro Deck, которые также являются администраторами LinkedIn developer app.</p>')
          : oauthText(interfaceLanguage,
              '<h1>Verification is not enabled</h1><p>Verified on LinkedIn is not enabled for this environment.</p>',
              '<h1>Проверка не включена</h1><p>Verified on LinkedIn не включён для этого окружения.</p>');
      return res.status(403).send(renderHtml({
        interfaceLanguage,
        title: oauthText(interfaceLanguage, 'LinkedIn verification unavailable', 'Проверка LinkedIn недоступна'),
        body
      }));
    }

    if (purpose === 'share_profile') {
      let ticketPayload;
      try {
        ticketPayload = verifySignedLinkedInLaunchTicket(launchTicket, stateSecret);
      } catch {
        return res.status(403).send(renderHtml({
          interfaceLanguage,
          title: oauthText(interfaceLanguage, 'LinkedIn share link expired', 'Ссылка публикации LinkedIn устарела'),
          body: oauthText(interfaceLanguage,
            '<h1>Share link expired</h1><p>Return to Telegram and create a fresh LinkedIn share preview.</p>',
            '<h1>Ссылка публикации устарела</h1><p>Вернитесь в Telegram и создайте новый предпросмотр публикации LinkedIn.</p>')
        }));
      }
      interfaceLanguage = ticketPayload.interfaceLanguage || interfaceLanguage;
      postLanguage = ticketPayload.postLanguage || postLanguage;
      shareIntentToken = ticketPayload.shareIntentToken || null;
      if (
        ticketPayload.telegramUserId !== String(telegramUserId)
        || ticketPayload.purpose !== purpose
        || !shareIntentToken
        || !/^[0-9a-f-]{36}$/i.test(shareIntentToken)
      ) {
        return res.status(403).send(renderHtml({
          interfaceLanguage,
          title: oauthText(interfaceLanguage, 'LinkedIn share link rejected', 'Ссылка публикации LinkedIn отклонена'),
          body: oauthText(interfaceLanguage,
            '<h1>Share link rejected</h1><p>Return to Telegram and create a fresh LinkedIn share preview.</p>',
            '<h1>Ссылка публикации отклонена</h1><p>Вернитесь в Telegram и создайте новый предпросмотр публикации LinkedIn.</p>')
        }));
      }

      if (!shareConfig.enabled || shareConfig.configurationValid === false) {
        return res.status(403).send(renderHtml({
          interfaceLanguage,
          title: oauthText(interfaceLanguage, 'LinkedIn sharing unavailable', 'Публикация в LinkedIn недоступна'),
          body: oauthText(interfaceLanguage,
            '<h1>LinkedIn sharing is unavailable</h1><p>The optional Share on LinkedIn integration is not enabled correctly. Your profile remains unchanged.</p>',
            '<h1>Публикация в LinkedIn недоступна</h1><p>Дополнительная интеграция публикации настроена некорректно. Ваш профиль не изменён.</p>')
        }));
      }

      const authorization = await markLinkedInShareAuthorizationForTelegramUser({
        publicToken: shareIntentToken,
        telegramUserId
      });
      if (!authorization.persistenceEnabled || !authorization.ok) {
        return res.status(409).send(renderHtml({
          interfaceLanguage,
          title: oauthText(interfaceLanguage, 'LinkedIn share no longer available', 'Публикация LinkedIn больше недоступна'),
          body: `<h1>${oauthText(interfaceLanguage, 'Share no longer available', 'Публикация больше недоступна')}</h1><p>${escapeOAuthHtml(localizedReason(authorization.reason, 'The share preview could not be authorized.', interfaceLanguage))}</p><p>${oauthText(interfaceLanguage, 'Return to Telegram and create a fresh preview.', 'Вернитесь в Telegram и создайте новый предпросмотр.')}</p>`
        }));
      }
      if (authorization.alreadyPublished) {
        return res.status(200).send(renderHtml({
          interfaceLanguage,
          title: oauthText(interfaceLanguage, 'Already published', 'Уже опубликовано'),
          body: oauthText(interfaceLanguage,
            '<h1>This LinkedIn share was already published</h1><p>Return to Telegram to review the receipt.</p>',
            '<h1>Эта публикация LinkedIn уже выполнена</h1><p>Вернитесь в Telegram, чтобы открыть подтверждение.</p>')
        }));
      }
      shareRequested = true;
    }

    const requestedScopes = [...new Set([
      ...scopes,
      ...(verificationRequested ? verificationConfig.scopes : []),
      ...(shareRequested ? shareConfig.scopes : [])
    ])];
    const discovery = await fetchOidcDiscovery(oidcDiscoveryUrl);
    const state = buildSignedState({
      telegramUserId,
      returnTo,
      purpose,
      verificationRequested,
      verificationMode: verificationRequested ? verificationConfig.mode : 'off',
      shareRequested,
      shareIntentToken,
      interfaceLanguage,
      postLanguage,
      ttlSeconds: stateTtlSeconds,
      secret: stateSecret
    });

    const authorizeUrl = buildAuthorizeUrl({
      discovery,
      clientId,
      redirectUri,
      scopes: requestedScopes,
      state
    });

    if (redirect) {
      res.statusCode = 302;
      res.setHeader('Location', authorizeUrl);
      return res.end();
    }

    return res.status(200).json({ ok: true, authorize_url: authorizeUrl });
  } catch (error) {
    console.error('[linkedin start] failed', error);
    return res.status(500).send(renderHtml({
      interfaceLanguage,
      title: oauthText(interfaceLanguage, 'LinkedIn sign-in unavailable', 'Вход через LinkedIn недоступен'),
      body: oauthText(interfaceLanguage,
        '<h1>LinkedIn sign-in is unavailable</h1><p>Please try again in a moment.</p>',
        '<h1>Вход через LinkedIn недоступен</h1><p>Попробуйте снова через несколько секунд.</p>')
    }));
  }
}
