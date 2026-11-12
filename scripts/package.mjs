import { mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkSite } from './check-site.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await import('./build.mjs');
const directory = path.join(root, 'dist');
const releases = path.join(root, 'releases');
await mkdir(releases, { recursive: true });
// Browser verification belongs to a specific archive; discard it on repackaging.
await rm(path.join(releases, 'publishing-verification.json'), { force: true });
const archive = path.join(releases, 'lare-site.zip');
await rm(archive, { force: true });
try {
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: directory, stdio: 'pipe' });
} catch (error) {
  if (error.code === 'ENOENT') throw new Error('Packaging requires the zip command. The verified dist/ directory can also be uploaded directly.');
  throw error;
}
const report = await checkSite(directory);
await writeFile(path.join(releases, 'site-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Static site package → ${archive}`);
console.log('Upload the archive contents, with index.html at the publishing root. No source checkout, raw logs or Node.js server is needed by the hosted site.');
