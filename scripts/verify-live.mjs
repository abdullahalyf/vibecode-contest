import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.SMART_ESCAPE_URL || 'https://smart-escape-practice-production.up.railway.app';
const files = ['index.html', 'favicon.svg', 'src/app.js', 'src/i18n.js', 'data/building.json', 'puku1/engine.js', 'puku2/map.js', 'puku2/styles.css'];
const sha256 = data => createHash('sha256').update(data).digest('hex');
const verified = [];
for (const path of files) {
  const response = await fetch(new URL(path, base + '/'), { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const expected = sha256(await readFile(`dist/${path}`));
  const actual = sha256(Buffer.from(await response.arrayBuffer()));
  if (actual !== expected) throw new Error(`${path}: live contents do not match local build`);
  verified.push({ path, sha256: actual }); console.log(`MATCH ${path}`);
}
const privatePaths = ['README.md', 'package.json', 'scripts/serve.mjs', '.git/config', 'puku1/engine.test.js'];
for (const path of privatePaths) {
  const response = await fetch(new URL(path, base + '/'), { signal: AbortSignal.timeout(20000) });
  if (response.status !== 404) throw new Error(`Unexpected public file ${path}: HTTP ${response.status}`);
}
await writeFile('docs/DEPLOYMENT_VERIFICATION.json', JSON.stringify({ url: base, verifiedAt: new Date().toISOString(), files: verified, privateFilesAbsent: privatePaths }, null, 2));
console.log(`Verified ${verified.length} matching public assets; ${privatePaths.length} development-only paths unavailable.`);
