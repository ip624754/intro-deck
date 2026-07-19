import { getLinkedInConfig, getLinkedInVerificationConfig, isOperatorTelegramUser } from '../../../src/config/env.js';
import { buildAuthorizeUrl, buildSignedState, fetchOidcDiscovery, verifySignedLinkedInLaunchTicket } from '../../../src/lib/linkedin/oidc.js';

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHtml({ title, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px auto; max-width: 720px; padding: 0 16px; line-height: 1.5; }
      .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;
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
  const purpose = url.searchParams.get('purpose') === 'verification_refresh' ? 'verification_refresh' : 'connect';
  const launchTicket = url.searchParams.get('ticket');

  if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
    return res.status(400).send(renderHtml({
      title: 'Invalid Telegram user',
      body: '<h1>Invalid Telegram user</h1><p>The sign-in link is missing a valid Telegram user id.</p>'
    }));
  }

  try {
    const { clientId, redirectUri, stateSecret, stateTtlSeconds, oidcDiscoveryUrl, scopes } = getLinkedInConfig();
    const verificationConfig = getLinkedInVerificationConfig();
    const verificationEligible = verificationConfig.mode === 'lite'
      || (verificationConfig.mode === 'development' && isOperatorTelegramUser(telegramUserId));
    let verificationRequested = false;

    if (purpose === 'verification_refresh') {
      let ticketPayload;
      try {
        ticketPayload = verifySignedLinkedInLaunchTicket(launchTicket, stateSecret);
      } catch {
        return res.status(403).send(renderHtml({
          title: 'LinkedIn verification link expired',
          body: '<h1>Verification link expired</h1><p>Return to your Intro Deck profile and open a fresh verification link.</p>'
        }));
      }
      if (ticketPayload.telegramUserId !== String(telegramUserId) || ticketPayload.purpose !== purpose) {
        return res.status(403).send(renderHtml({
          title: 'LinkedIn verification link rejected',
          body: '<h1>Verification link rejected</h1><p>Return to your Intro Deck profile and open a fresh verification link.</p>'
        }));
      }
      verificationRequested = verificationEligible;
    }

    if (purpose === 'verification_refresh' && !verificationRequested) {
      return res.status(403).send(renderHtml({
        title: 'LinkedIn verification unavailable',
        body: verificationConfig.mode === 'development'
          ? '<h1>Verification testing is limited</h1><p>Development access is available only to configured Intro Deck operator accounts that are also LinkedIn developer-app administrators.</p>'
          : '<h1>Verification is not enabled</h1><p>Verified on LinkedIn is not enabled for this environment.</p>'
      }));
    }

    const requestedScopes = [...new Set([
      ...scopes,
      ...(verificationRequested ? verificationConfig.scopes : [])
    ])];
    const discovery = await fetchOidcDiscovery(oidcDiscoveryUrl);
    const state = buildSignedState({
      telegramUserId,
      returnTo,
      purpose,
      verificationRequested,
      verificationMode: verificationRequested ? verificationConfig.mode : 'off',
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
      title: 'LinkedIn sign-in unavailable',
      body: '<h1>LinkedIn sign-in is unavailable</h1><p>Please try again in a moment.</p>'
    }));
  }
}
