import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const defaultDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const textExtensions = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.bib']);
const decodeEntities = value => value.replace(/&amp;/g, '&').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)));

// Validate the actual deployment directory, never fall back to project sources.
export async function checkSite(directory = defaultDirectory) {
  const root = path.resolve(directory);
  const files = new Map();
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const absolute = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Deployment contains a symbolic link: ${absolute}`);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        const name = path.relative(root, absolute).split(path.sep).join('/');
        const content = textExtensions.has(path.extname(name)) ? await readFile(absolute, 'utf8') : null;
        files.set(name, { content, size: (await stat(absolute)).size });
      }
    }
  }
  await walk(root);
  if (!files.has('index.html')) throw new Error('The deployment directory has no index.html.');

  const references = [];
  const anchors = new Map();
  const external = new Set();
  for (const [file, { content }] of files) {
    if (content === null) continue;
    const machineReference = content.match(/file:\/\/[^\s"'<>]*|https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|\[::1\])(?=[:/\s"']|$)[^\s"'<>]*|(?:^|[\s"'=])\/(?:Users|home|private|tmp)\/[^\s"'<>]*|[A-Za-z]:\\(?:Users|Documents)\\[^\s"'<>]*/m);
    if (machineReference) throw new Error(`Machine-specific reference in ${file}: ${machineReference[0].trim()}`);
    if (/__(?:BLOG|ARTICLE|ABOUT|ZH|EN)_URL__/.test(content)) throw new Error(`Unresolved template URL in ${file}`);
    if (/\.(?:html|svg)$/.test(file)) {
      const markup = content.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
      const ids = [...markup.matchAll(/\bid=["']([^"']+)["']/g)].map(match => decodeEntities(match[1]));
      if (new Set(ids).size !== ids.length) throw new Error(`Duplicate IDs in ${file}`);
      anchors.set(file, new Set(ids));
      for (const [, , double, single] of markup.matchAll(/\b(href|src|data-zoom|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        const target = decodeEntities(double ?? single);
        if (target) references.push({ file, target });
      }
    }
    if (/\.(?:css|svg|html)$/.test(file)) {
      for (const [, double, single, bare] of content.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/g)) {
        const target = decodeEntities(double ?? single ?? bare);
        if (target) references.push({ file, target });
      }
    }
  }

  const mounts = ['https://publish-check.invalid/', 'https://publish-check.invalid/project-preview/'];
  for (const origin of mounts) {
    const mount = new URL(origin);
    for (const { file, target } of references) {
      if (/^(?:mailto:|tel:|data:)/i.test(target)) continue;
      if (/^https?:\/\//i.test(target) || target.startsWith('//')) {
        external.add(new URL(target, mount).href.split('#')[0]);
        continue;
      }
      const url = new URL(target, new URL(file, mount));
      if (url.origin !== mount.origin || !url.pathname.startsWith(mount.pathname)) {
        throw new Error(`Link escapes deployment prefix ${mount.pathname}: ${file} → ${target}`);
      }
      let name = decodeURIComponent(url.pathname.slice(mount.pathname.length));
      if (!name || name.endsWith('/')) name += 'index.html';
      else if (!files.has(name) && files.has(`${name}/index.html`)) name += '/index.html';
      if (!files.has(name)) throw new Error(`Missing deployed asset: ${file} → ${target} (resolved to ${name})`);
      if (url.hash && anchors.has(name) && !anchors.get(name).has(decodeURIComponent(url.hash.slice(1)))) {
        throw new Error(`Missing destination anchor: ${file} → ${target}`);
      }
    }
  }
  return {
    files: files.size,
    pages: [...files.keys()].filter(file => file.endsWith('.html')).length,
    references: references.length,
    bytes: [...files.values()].reduce((sum, file) => sum + file.size, 0),
    mounts,
    externalLinks: [...external].sort(),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkSite(process.argv[2]);
  console.log(`Verified ${report.pages} pages, ${report.files} files and ${report.references} references at domain root and under /project-preview/.`);
  console.log('No machine-specific URLs, missing assets or broken internal anchors.');
  console.log(`External destinations (not requested by this offline check):\n${report.externalLinks.join('\n')}`);
}
