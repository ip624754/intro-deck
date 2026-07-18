import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const siteCss = fs.readFileSync(path.join(root, 'site.css'), 'utf8');
const privacyHtml = fs.readFileSync(path.join(root, 'privacy', 'index.html'), 'utf8');
const termsHtml = fs.readFileSync(path.join(root, 'terms', 'index.html'), 'utf8');

const requiredIndexSnippets = [
  'Skip to content',
  'href="#why-better"',
  'Professional discovery. Contact by permission.',
  'See how it works',
  'LinkedIn connects account identity. Professional claims are member-provided.'
];

for (const snippet of requiredIndexSnippets) {
  if (!indexHtml.includes(snippet)) {
    throw new Error(`Landing polish missing required snippet: ${snippet}`);
  }
}

const requiredCssSnippets = [
  '.skip-link',
  '.hero-trustline',
  '.legal-intro',
  '.hero-prime-device',
  '.legal-summary',
  '.footer-copy'
];

for (const snippet of requiredCssSnippets) {
  if (!siteCss.includes(snippet)) {
    throw new Error(`site.css missing polish selector: ${snippet}`);
  }
}

for (const [name, html] of [['privacy', privacyHtml], ['terms', termsHtml]]) {
  if (!html.includes('Quick summary')) {
    throw new Error(`${name} legal page missing quick summary block`);
  }
  if (!html.includes('Back to homepage')) {
    throw new Error(`${name} legal page missing back-to-home action`);
  }
}

console.log('landing polish contract smoke passed');
