import { normalizeInterfaceLanguage } from '../i18n/language.js';

export function oauthText(interfaceLanguage, english, russian) {
  return normalizeInterfaceLanguage(interfaceLanguage) === 'ru' ? russian : english;
}

export function escapeOAuthHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderLinkedInOAuthHtml({ interfaceLanguage = 'en', title, body }) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeOAuthHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px auto; max-width: 720px; padding: 0 16px; line-height: 1.5; }
      .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
      .meta { color: #6b7280; font-size: 14px; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
      .button { display: inline-block; text-decoration: none; border-radius: 10px; padding: 12px 16px; font-weight: 600; }
      .button-primary { background: #111827; color: #ffffff; }
      .button-secondary { background: #f3f4f6; color: #111827; }
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;
}
