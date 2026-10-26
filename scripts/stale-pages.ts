// Lists pages whose last_verified date is more than 90 days old, as Markdown (for the weekly freshness issue).
import { ageInDays, isoDate, MAX_AGE_DAYS } from '../site/src/lib/freshness';
import { loadContent } from './lib/load';

const content = loadContent();
const stale = [...content.concepts, ...content.caseStudies, ...content.decide]
  .map((p) => ({ file: p.file, title: p.data.title, verified: p.data.last_verified, age: ageInDays(p.data.last_verified) }))
  .filter((p) => p.age > MAX_AGE_DAYS)
  .sort((a, b) => b.age - a.age);

if (stale.length === 0) {
  console.log(`No pages older than ${MAX_AGE_DAYS} days.`);
} else {
  console.log(`| Page | Last verified | Age (days) |\n| --- | --- | --- |`);
  for (const p of stale) console.log(`| ${p.title} (\`${p.file}\`) | ${isoDate(p.verified)} | ${p.age} |`);
}
