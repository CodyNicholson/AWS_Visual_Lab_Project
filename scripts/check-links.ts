// Checks every internal link and asset reference in the built site, including #fragments.
// Run after a build: npm run check:links (defaults to site/dist)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { walk } from './lib/load';

const dist = resolve(process.argv[2] ?? 'site/dist');
if (!existsSync(dist)) {
  console.error(`${dist} not found; run the build first`);
  process.exit(1);
}

const pages = walk(dist, '.html');
const idCache = new Map<string, Set<string>>();
const idsOf = (file: string) => {
  if (!idCache.has(file)) idCache.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idCache.get(file)!;
};

function resolveTarget(path: string): string | null {
  const p = decodeURIComponent(path);
  for (const candidate of [join(dist, p), join(dist, p, 'index.html'), join(dist, `${p}.html`)]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

let broken = 0;
let checked = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const [, attr, url] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/pagefind/')) {
      // External links aren't checked here (flaky in CI); same-page fragments are.
      if (url.startsWith('#') && url.length > 1 && !idsOf(page).has(url.slice(1))) {
        console.log(`broken  ${relative(dist, page)}: ${attr}="${url}" (no such id on this page)`);
        broken++;
      }
      continue;
    }
    checked++;
    const [path, fragment] = url.split('#');
    const target = resolveTarget(path.split('?')[0]);
    if (!target) {
      console.log(`broken  ${relative(dist, page)}: ${attr}="${url}"`);
      broken++;
    } else if (fragment && target.endsWith('.html') && !idsOf(target).has(fragment)) {
      console.log(`broken  ${relative(dist, page)}: ${attr}="${url}" (no id "${fragment}" in ${relative(dist, target)})`);
      broken++;
    }
  }
}
console.log(`\nChecked ${checked} internal links across ${pages.length} pages: ${broken} broken.`);
process.exit(broken > 0 ? 1 : 0);
