// Weekly exam-guide diff (plan: "Freshness tracking"). For each exam with guide_urls in exam.yaml,
// fetches the guide pages, stores a normalized text snapshot in content/exams/<code>/guide-snapshot.md,
// and reports which lines changed. In GitHub Actions it sets the step outputs changed and snapshot_updated.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR, loadContent } from './lib/load';

function toText(body: string, url: string): string {
  // docs.aws.amazon.com also serves pages as Markdown (.md); prefer those URLs in exam.yaml.
  const text = url.endsWith('.md')
    ? body
    : body
        .replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
  return text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const content = loadContent();
const changes: string[] = [];
let snapshotsUpdated = false;

for (const { data: exam } of content.exams) {
  if (exam.guide_urls.length === 0) {
    console.log(`${exam.code}: no guide_urls in exam.yaml, skipping`);
    continue;
  }
  const parts: string[] = [];
  for (const url of exam.guide_urls) {
    const res = await fetch(url, { headers: { 'user-agent': 'aws-dev-kb-freshness-check' } });
    if (!res.ok) throw new Error(`${exam.code}: ${url} returned ${res.status}`);
    parts.push(`<!-- ${url} -->\n${toText(await res.text(), url)}`);
  }
  const snapshot = parts.join('\n\n') + '\n';
  const file = join(CONTENT_DIR, 'exams', exam.code.toLowerCase(), 'guide-snapshot.md');
  const previous = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (previous === snapshot) {
    console.log(`${exam.code}: unchanged`);
    continue;
  }
  writeFileSync(file, snapshot);
  snapshotsUpdated = true;
  if (previous === null) {
    console.log(`${exam.code}: first snapshot saved`);
    continue;
  }
  const before = new Set(previous.split('\n'));
  const after = new Set(snapshot.split('\n'));
  const added = [...after].filter((l) => !before.has(l));
  const removed = [...before].filter((l) => !after.has(l));
  changes.push(
    `### ${exam.code}\n\n${added.length} lines added, ${removed.length} removed.\n\n` +
      '```diff\n' + [...removed.map((l) => `- ${l}`), ...added.map((l) => `+ ${l}`)].slice(0, 200).join('\n') + '\n```\n',
  );
}

const report = changes.join('\n');
if (report) console.log(report);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changes.length > 0}\nsnapshot_updated=${snapshotsUpdated}\n`);
}
if (report) writeFileSync('exam-guide-diff.md', report);
