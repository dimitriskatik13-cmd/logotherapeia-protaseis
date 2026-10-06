// Ξαναγράφει τη λίστα ASSETS του sw.js: κάθε αρχείο που αναφέρει το index.html και ο
// κώδικας (με το ακριβές ?v=), τα δεδομένα, οι γραμματοσειρές, τα εικονίδια και όλες
// οι μικρές εικόνες των καρτών. Οι μεγάλες εικόνες αποθηκεύονται όταν ζητηθούν (ζουμ).
// Χρήση: node scripts/update-sw.mjs  (ή --check για έλεγχο χωρίς αλλαγή)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root, file), 'utf8');

export function collectAssets() {
  const refs = new Set(['./', 'index.html', 'manifest-v2.webmanifest', 'synoida-logo.webp', 'apple-touch-icon-v2.png']);
  const index = read('index.html');
  for (const m of index.matchAll(/(?:href|src)="(?:https:\/\/dimitriskatik13-cmd\.github\.io\/logotherapeia-protaseis\/)?([^"]+\.(?:css|js|png|webp|webmanifest)(?:\?v=[^"]+)?)"/g)) refs.add(m[1]);
  for (const file of readdirSync(resolve(root, 'src'))) {
    for (const m of read(`src/${file}`).matchAll(/['"]\.\/([a-z-]+\.js\?v=[^'"]+)['"]/g)) refs.add(`src/${m[1]}`);
    for (const m of read(`src/${file}`).matchAll(/['"](data\/[a-z-]+\.json\?v=[^'"]+)['"]/g)) refs.add(m[1]);
  }
  for (const file of readdirSync(resolve(root, 'assets/fonts'))) if (file.endsWith('.woff2')) refs.add(`assets/fonts/${file}`);
  for (const file of readdirSync(resolve(root, 'assets/pictures-320'))) if (file.endsWith('.webp')) refs.add(`assets/pictures-320/${file}`);
  return [...refs].sort();
}

export function missingFiles(assets) {
  return assets.filter(asset => asset !== './' && !existsSync(resolve(root, asset.split('?')[0])));
}

export function renderList(assets) {
  return 'const ASSETS = [\n' + assets.map(asset => `  '${asset}',`).join('\n') + '\n];';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assets = collectAssets(), missing = missingFiles(assets);
  if (missing.length) { console.error('Λείπουν αρχεία:', missing); process.exit(1); }
  const sw = read('sw.js'), next = sw.replace(/const ASSETS = \[[\s\S]*?\];/, renderList(assets));
  if (process.argv.includes('--check')) {
    if (next !== sw) { console.error('Το sw.js δεν είναι ενημερωμένο. Τρέξε: node scripts/update-sw.mjs'); process.exit(1); }
    console.log('sw.js ενημερωμένο:', assets.length, 'αρχεία');
  } else {
    writeFileSync(resolve(root, 'sw.js'), next);
    console.log('sw.js:', assets.length, 'αρχεία στη λίστα');
  }
}
