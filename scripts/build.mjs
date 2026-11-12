import { cp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { checkSite } from './check-site.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
const source = await readFile(path.join(root, 'src/index.html'), 'utf8');
const dictionary = JSON.parse(await readFile(path.join(root, 'src/locales/zh-CN.json'), 'utf8'));
const i18n = (await readFile(path.join(root, 'src/i18n.js'), 'utf8')).replace('/*__ZH_DICTIONARY__*/ {}', JSON.stringify(dictionary));
const context = vm.createContext({});
vm.runInContext(i18n, context);
const translate = context.LARE_I18N.translate;

// Protect formulas, citations and scripts; translate prose and accessible labels.
function chinese(html) {
  return html.replace(/<(script|style|pre|code|math)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/gi, token => {
    if (/^<(script|style|pre|code|math)\b/i.test(token)) return token;
    if (token.startsWith('<')) {
      return token.replace(/\b(alt|title|aria-label|aria-valuetext|data-caption|content)="([^"]*)"/g, (_, attr, text) => `${attr}="${translate(text).replace(/"/g, '&quot;')}"`);
    }
    return translate(token);
  });
}
const relative = (file, target) => {
  const result = path.posix.relative(path.posix.dirname(file), target);
  return result.startsWith('.') ? result : `./${result}`;
};
function page(html, file, language, kind = 'article') {
  const article = language === 'en' ? 'en/blog/lare/index.html' : 'blog/lare/index.html';
  const blog = language === 'en' ? 'en/blog/index.html' : 'blog/index.html';
  const zh = kind === 'article' ? 'blog/lare/index.html' : 'blog/index.html';
  const en = kind === 'article' ? 'en/blog/lare/index.html' : 'en/blog/index.html';
  html = html.replace(/\b(src|href|data-zoom)="\.\/([^"#]+)"/g, (_, attr, target) => `${attr}="${relative(file, target)}"`)
    .replaceAll('__BLOG_URL__', relative(file, blog)).replaceAll('__ARTICLE_URL__', relative(file, article))
    .replaceAll('__ABOUT_URL__', language === 'en' ? 'https://training.farm/en/about/' : 'https://training.farm/about/')
    .replaceAll('__ZH_URL__', relative(file, zh)).replaceAll('__EN_URL__', relative(file, en))
    .replace('<html lang="en"', `<html lang="${language === 'zh' ? 'zh-CN' : 'en'}"`)
    .replace(`data-language="${language}"`, `data-language="${language}" aria-current="page"`)
    .replace('</head>', `  <link rel="alternate" hreflang="zh-CN" href="${relative(file, zh)}">\n  <link rel="alternate" hreflang="en" href="${relative(file, en)}">\n</head>`)
    .replace(/<span class="section-number">0(\d)<\/span>/g, '<span class="section-number">$1</span>');
  return language === 'zh' ? chinese(html) : html;
}

const header = source.match(/<header class="site-header[\s\S]*?<\/header>/)[0];
const footer = source.match(/<footer class="site-footer[\s\S]*?<\/footer>/)[0];
const articleTitle = source.match(/<title>(.*?)<\/title>/)[1];
const articleSubtitle = source.match(/<p class="article-subtitle">(.*?)<\/p>/)[1];
const head = source.slice(0, source.indexOf('<body>')).replace(/<script src="\.\/(?:app|animations|history|studies|data\/training-history)\.js" defer><\/script>\s*/g, '').replace(/<title>.*?<\/title>/, '<title>Blog · Training Farm</title>');
const index = `${head}<body>${header}
<main id="main" class="blog-index"><div class="index-heading"><p class="eyebrow">TRAINING FARM</p><h1>Blog</h1><p>Methods, experiments, and lessons from training models.</p></div>
<div class="index-label"><span>Articles</span><span>01</span></div><ol class="post-list"><li><a class="post-link" href="__ARTICLE_URL__"><span class="post-date"><time datetime="2026-10">October 2026</time><span class="post-category">PRETRAINING</span></span><div class="post-description"><h2>${articleTitle}</h2><p>${articleSubtitle}</p></div><span aria-hidden="true">↗</span></a></li></ol></main>${footer}</body></html>`;
const pages = [
  ['index.html', 'zh', source, 'article'],
  ['blog/lare/index.html', 'zh', source, 'article'],
  ['en/blog/lare/index.html', 'en', source, 'article'],
  ['blog/index.html', 'zh', index, 'index'],
  ['en/blog/index.html', 'en', index, 'index'],
];

await rm(destination, { recursive:true, force:true });
await mkdir(destination, { recursive:true });
await cp(path.join(root, 'public'), destination, { recursive:true });
for (const file of await readdir(path.join(root, 'src'))) {
  if (file === 'index.html' || file === 'i18n.js' || file === 'locales') continue;
  await cp(path.join(root, 'src', file), path.join(destination, file), { recursive:true });
}
await writeFile(path.join(destination, 'i18n.js'), i18n);
for (const [file, language, template, kind] of pages) {
  const html = page(template, file, language, kind);
  if (/__(?:BLOG|ARTICLE|ABOUT|ZH|EN)_URL__/.test(html)) throw new Error(`Unresolved route in ${file}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate HTML IDs in ${file}`);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.includes(anchor)) throw new Error(`Missing anchor: ${file}#${anchor}`);
  }
  await mkdir(path.dirname(path.join(destination, file)), { recursive:true });
  await writeFile(path.join(destination, file), html);
}
await writeFile(path.join(destination, '.nojekyll'), '');
const report = await checkSite(destination);
console.log(`Built bilingual LARE blog → ${destination}`);
console.log('Chinese: /blog/lare/ · English: /en/blog/lare/');
console.log(`Verified ${report.pages} pages and ${report.references} references, including CSS fonts and destination anchors, at domain root and under a subdirectory.`);
