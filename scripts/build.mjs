import { mkdir, cp, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
if (output !== resolve(root) + sep + 'dist') throw new Error('Unexpected build output path');
await rm(output, { recursive: true, force: true });
// Only runtime assets go online. Reports, test files, scripts and docs stay local.
for (const file of ['index.html', 'favicon.svg', 'src/app.js', 'src/i18n.js', 'data/building.json', 'puku1/engine.js', 'puku2/map.js', 'puku2/styles.css']) {
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, file), destination);
}
console.log('Static website built in dist/');
