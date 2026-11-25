import { cp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import katex from 'katex';
import { checkSite } from './check-site.mjs';
import { populateArticle, readArticle } from './article.mjs';
import { chartConfig, seriesStyles } from './paper-chart-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
const seriesPath = path.join(root, 'public/figures/paper-series.json');
const paperSeries = JSON.parse(await readFile(seriesPath, 'utf8'));
const mixturePilots = ['math-rich-pilot', 'low-math-pilot'];
for (const name of ['april-pilot', 'domain-gradient-norm', ...mixturePilots]) {
  const file = path.join(root, 'public/figures', name + '.json');
  paperSeries[name] = JSON.parse(await readFile(file, 'utf8'));
}
const sharedSteps = paperSeries['math-rich-pilot'].panels[0].series[0].points.map(([step]) => step);
for (const name of mixturePilots) {
  const data = paperSeries[name];
  for (const { series } of data.panels) {
    for (const { key, points } of series) {
      if (points.length !== sharedSteps.length || points.some(([step], i) => step !== sharedSteps[i]) || data.xMax !== sharedSteps.at(-1)) {
        throw new Error(`Mixture comparisons must use the same observed checkpoints: ${name}/${key}`);
      }
    }
  }
}
for (const [plot, config] of Object.entries(chartConfig)) {
  const panels = paperSeries[plot]?.panels;
  if (!panels?.[config.firstPanel]) throw new Error(`Missing opening panel in ${plot}`);
  const tabs = config.contexts?.flatMap(context => context.panels).sort((a, b) => a - b);
  if (tabs && (tabs.length !== panels.length || tabs.some((number, i) => number !== i))) {
    throw new Error(`Incomplete chart tabs in ${plot}`);
  }
  for (const { series } of panels) {
    for (const { key, points } of series) {
      if (!seriesStyles[key] || !points?.length) throw new Error(`Missing style or trajectory for ${plot}/${key}`);
    }
  }
}
const source = await readFile(path.join(root, 'src/index.html'), 'utf8');
const articles = {
  zh: readArticle(await readFile(path.join(root, 'article/zh-CN.md'), 'utf8')),
  en: readArticle(await readFile(path.join(root, 'article/en.md'), 'utf8')),
};
if (articles.zh.sections.map(section => section.id).join() !== articles.en.sections.map(section => section.id).join()) {
  throw new Error('The two articles must use the same section IDs in the same order.');
}
const dictionary = JSON.parse(await readFile(path.join(root, 'src/locales/zh-CN.json'), 'utf8'));
const i18n = (await readFile(path.join(root, 'src/i18n.js'), 'utf8')).replace('/*__ZH_DICTIONARY__*/ {}', JSON.stringify(dictionary));
const context = vm.createContext({});
vm.runInContext(i18n, context);
const translate = context.LARE_I18N.translate;

// Translate the whole label first, then typeset its TeX in either language.
function renderPageText(html, language) {
  const entities = { '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"' };
  return html.replace(/<!--[\s\S]*?-->|<(script|style|pre|code|math)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/gi, token => {
    if (/^<!--|^<(script|style|pre|code|math)\b/i.test(token)) return token;
    if (token.startsWith('<')) {
      if (language !== 'zh') return token;
      return token.replace(/\b(alt|title|aria-label|aria-valuetext|data-caption|content)="([^"]*)"/g, (_, attr, text) => `${attr}="${translate(text).replace(/"/g, '&quot;')}"`);
    }
    const text = language === 'zh' ? translate(token) : token;
    return text.replace(/\\\(([\s\S]*?)\\\)([，。；：、？！）》】]*)|\\\[([\s\S]*?)\\\]/g, (_, inline, punctuation, block) => {
      const tex = (inline ?? block).replace(/&(?:amp|lt|gt|quot);/g, entity => entities[entity]);
      const formula = katex.renderToString(tex.trim(), { displayMode:block !== undefined, output:'htmlAndMathml', throwOnError:true });
      return punctuation ? '<span class="math-with-punctuation">' + formula + punctuation + '</span>' : formula;
    });
  });
}
const relative = (file, target) => {
  const result = path.posix.relative(path.posix.dirname(file), target);
  return result.startsWith('.') ? result : `./${result}`;
};
function page(html, file, language, kind = 'article') {
  html = populateArticle(html, articles[language], kind === 'article');
  html = html.replace(/<!-- chart-title:([\w-]+) -->/g, (_, plot) => chartConfig[plot].title[language]);
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
  return renderPageText(html, language);
}

const header = source.match(/<header class="site-header[\s\S]*?<\/header>/)[0];
const footer = source.match(/<footer class="site-footer[\s\S]*?<\/footer>/)[0];
const articleTitle = source.match(/<title>(.*?)<\/title>/)[1];
const articleSubtitle = source.match(/<p class="article-subtitle">(.*?)<\/p>/)[1];
const articleDate = source.match(/<time datetime="[^"]+">[^<]+<\/time>/)[0];
const head = source.slice(0, source.indexOf('<body>'))
  .replace(/<link rel="stylesheet" href="\.\/math\/katex.min.css">\s*/, '')
  .replace(/<link rel="stylesheet" href="\.\/(?:remix-frontier|lare-dynamics)\.css">\s*/g, '')
  .replace(/<script src="\.\/(?:app|animations|studies|paper-series|paper-playback|quadratic-frontier|remix-frontier|lare-dynamics)\.js" defer><\/script>\s*/g, '')
  .replace(/<title>.*?<\/title>/, '<title>Blog · Training Farm</title>');
const index = `${head}<body>${header}
<main id="main" class="blog-index"><div class="index-heading"><p class="eyebrow">TRAINING FARM</p><h1>Blog</h1><p>Methods, experiments, and lessons from training models.</p></div>
<div class="index-label"><span>Articles</span><span>01</span></div><ol class="post-list"><li><a class="post-link" href="__ARTICLE_URL__"><span class="post-date">${articleDate}<span class="post-category">PRETRAINING</span></span><div class="post-description"><h2>${articleTitle}</h2><p>${articleSubtitle}</p></div><span aria-hidden="true">↗</span></a></li></ol></main>${footer}</body></html>`;
const pages = [
  ['index.html', 'zh', source, 'article'],
  ['blog/lare/index.html', 'zh', source, 'article'],
  ['en/blog/lare/index.html', 'en', source, 'article'],
  ['blog/index.html', 'zh', index, 'index'],
  ['en/blog/index.html', 'en', index, 'index'],
];

await rm(destination, { recursive:true, force:true });
await mkdir(destination, { recursive:true });
const katexRoot = path.join(root, 'node_modules/katex');
const mathAssets = path.join(destination, 'math');
await mkdir(mathAssets);
await cp(path.join(katexRoot, 'dist/katex.min.css'), path.join(mathAssets, 'katex.min.css'));
await cp(path.join(katexRoot, 'dist/fonts'), path.join(mathAssets, 'fonts'), { recursive:true });
await cp(path.join(katexRoot, 'LICENSE'), path.join(mathAssets, 'LICENSE'));
// Keep the original log replay in the workspace for provenance.
const logReplay = path.join(root, 'public', 'data', 'training-history.js');
await cp(path.join(root, 'public'), destination, {
  recursive:true,
  filter:file => file !== logReplay && file !== seriesPath,
});
for (const file of await readdir(path.join(root, 'src'))) {
  if (['index.html', 'i18n.js', 'locales', 'history.js', 'history.css'].includes(file)) continue;
  await cp(path.join(root, 'src', file), path.join(destination, file), { recursive:true });
}
await writeFile(path.join(destination, 'i18n.js'), i18n);
// A classic script keeps both nested routes and directly opened HTML usable offline.
await writeFile(path.join(destination, 'paper-series.js'), [
  `window.LARE_PAPER_SERIES=${JSON.stringify(Object.fromEntries(Object.keys(chartConfig).map(key => [key, paperSeries[key]])))};`,
  `window.LARE_PAPER_CHARTS=${JSON.stringify(chartConfig)};`,
  `window.LARE_PAPER_STYLES=${JSON.stringify(seriesStyles)};`,
].join('\n'));
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
