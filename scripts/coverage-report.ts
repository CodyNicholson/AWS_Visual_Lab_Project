// Objective-map coverage per exam, as Markdown. Run: npm run coverage [-- --fail-on-gaps]
// With GITHUB_STEP_SUMMARY set (in CI), the report is also added to the job summary.
// --fail-on-gaps is the Phase 1 exit gate: every task statement has a page and 5+ questions.
import { appendFileSync } from 'node:fs';
import { computeCoverage, MIN_QUESTIONS_PER_TASK } from '../site/src/lib/coverage';
import { loadContent } from './lib/load';

const failOnGaps = process.argv.includes('--fail-on-gaps');
const content = loadContent();
const lines: string[] = [];
let gaps = 0;

for (const { data: objectives } of content.objectives) {
  const pages = content.concepts
    .filter((c) => c.data.exams.includes(objectives.exam))
    .map((c) => ({ id: c.data.service, exam_domains: c.data.exam_domains, tasks: c.data.tasks }));
  const questions = content.questions.filter((q) => q.exam === objectives.exam);
  const cov = computeCoverage(objectives, pages, questions);

  lines.push(`## ${objectives.exam} coverage (${objectives.status})`, '');
  lines.push(
    cov.percent === null
      ? '**Task statements not loaded yet**, so coverage is by domain only.'
      : `**${cov.percent}%**: ${cov.coveredTasks} of ${cov.taskCount} task statements have a page and ${MIN_QUESTIONS_PER_TASK}+ questions.`,
    '',
    '| Domain | Weight | Pages | Questions |',
    '| --- | --- | --- | --- |',
  );
  for (const d of cov.domains) lines.push(`| ${d.number}. ${d.name} | ${d.weight}% | ${d.pages.length} | ${d.questions.length} |`);
  const uncovered = cov.domains.flatMap((d) => d.tasks.filter((t) => !t.covered));
  if (uncovered.length) {
    lines.push('', '**Gaps**', '', '| Task | Pages | Questions |', '| --- | --- | --- |');
    for (const t of uncovered) lines.push(`| ${t.id} ${t.title} | ${t.pages.length} | ${t.questions.length} |`);
  }
  lines.push('');
  gaps += uncovered.length + (cov.percent === null ? 1 : 0);
}

const report = lines.join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
if (failOnGaps && gaps > 0) {
  console.error(`Coverage gate failed: ${gaps} gap(s).`);
  process.exit(1);
}
