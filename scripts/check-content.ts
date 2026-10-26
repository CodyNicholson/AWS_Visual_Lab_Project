// Automated content checks (plan: "Content pipeline", step 2). Run: npm run check:content [-- --strict]
//   - frontmatter and data match their schemas
//   - concept pages follow the nine-block template, with 5-8 sourced mistakes
//   - every exam domain and task ID exists in the exam's objectives.yaml
//   - every code sample a page shows exists and has a test next to it
//   - last_verified is no older than 90 days (warning; --strict makes it an error)
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { PLANNED_SERVICES } from '../site/src/data/domains';
import { ageInDays, isoDate, MAX_AGE_DAYS } from '../site/src/lib/freshness';
import { SAMPLES_DIR } from '../site/src/lib/paths';
import { examFolderOf, loadContent, parentDir, stem, type Problem } from './lib/load';

export const TEMPLATE_HEADINGS = [
  'When to use it / when not to',
  'How it works',
  'Code',
  'Key limits and defaults',
  'Common mistakes',
  'Security and cost notes',
  'Check yourself',
  'Go deeper',
];
const MISTAKES_MIN = 5;
const MISTAKES_MAX = 8;
const CHECK_YOURSELF_MIN = 3;

const strict = process.argv.includes('--strict');
const content = loadContent();
const problems: Problem[] = [...content.problems];
const error = (file: string, message: string) => problems.push({ level: 'error', file, message });
const warn = (file: string, message: string) => problems.push({ level: 'warning', file, message });

// ---- exams and objectives ------------------------------------------------------------
const objectivesByExam = new Map(content.objectives.map((o) => [o.data.exam, o.data]));
const examCodes = new Set(content.exams.map((e) => e.data.code));
const domainIds = new Set(content.objectives.flatMap((o) => o.data.domains.map((d) => d.id)));
const taskIds = new Set(content.objectives.flatMap((o) => o.data.domains.flatMap((d) => d.tasks.map((t) => t.id))));

for (const e of content.exams) {
  if (e.data.code.toLowerCase() !== examFolderOf(e.file)) error(e.file, `code ${e.data.code} doesn't match folder ${examFolderOf(e.file)}`);
  if (!objectivesByExam.has(e.data.code)) error(e.file, `no objectives.yaml for ${e.data.code}`);
}
for (const o of content.objectives) {
  if (o.data.exam.toLowerCase() !== examFolderOf(o.file)) error(o.file, `exam ${o.data.exam} doesn't match folder`);
  const total = o.data.domains.reduce((n, d) => n + d.weight, 0);
  if (total !== 100) error(o.file, `domain weights add up to ${total}, not 100`);
  for (const d of o.data.domains) {
    if (d.id !== `${o.data.exam}-D${d.number}`) error(o.file, `domain id ${d.id} should be ${o.data.exam}-D${d.number}`);
    for (const t of d.tasks) {
      if (!t.id.startsWith(`${o.data.exam}-${d.number}.`)) error(o.file, `task ${t.id} is listed under domain ${d.number}`);
    }
  }
  if (o.data.status === 'official' && o.data.domains.every((d) => d.tasks.length === 0)) {
    error(o.file, 'status is official but no task statements are listed');
  }
}

function checkTags(file: string, exams: string[], domains: string[], tasks: string[]) {
  for (const e of exams) if (!examCodes.has(e)) error(file, `unknown exam ${e}`);
  for (const d of domains) if (!domainIds.has(d)) error(file, `unknown exam domain ${d}`);
  for (const t of tasks) if (!taskIds.has(t)) error(file, `unknown task statement ${t}`);
  const codes = new Set(exams);
  for (const id of [...domains, ...tasks]) {
    const code = id.slice(0, 7);
    if (!codes.has(code)) error(file, `${id} is tagged but ${code} isn't in exams[]`);
  }
}

function checkFreshness(file: string, verified: Date) {
  const age = ageInDays(verified);
  if (age < 0) error(file, `last_verified ${isoDate(verified)} is in the future`);
  else if (age > MAX_AGE_DAYS) {
    (strict ? error : warn)(file, `last verified ${age} days ago (${isoDate(verified)}); pages need review every ${MAX_AGE_DAYS} days`);
  }
}

// ---- concept pages ------------------------------------------------------------------
const questionsByService = new Map<string, number>();
for (const q of content.questions) for (const s of q.services) questionsByService.set(s, (questionsByService.get(s) ?? 0) + 1);

const seenServices = new Map<string, string>();
for (const c of content.concepts) {
  const { file, data, body } = c;
  const planned = PLANNED_SERVICES.get(data.service);

  if (stem(file) !== data.service) error(file, `file name should be ${data.service}.mdx`);
  if (parentDir(file) !== data.domain) error(file, `file should be in content/concepts/${data.domain}/`);
  if (!planned) error(file, `service "${data.service}" isn't in site/src/data/domains.ts`);
  else if (planned.domain !== data.domain) error(file, `domains.ts puts ${data.service} in ${planned.domain}, not ${data.domain}`);
  if (seenServices.has(data.service)) error(file, `service "${data.service}" also used by ${seenServices.get(data.service)}`);
  seenServices.set(data.service, file);

  // Nine-block template: the header comes from frontmatter, the eight sections are H2s in order.
  const headings = headingsOf(body);
  if (headings.join('|') !== TEMPLATE_HEADINGS.join('|')) {
    error(file, `H2 sections must be, in order: ${TEMPLATE_HEADINGS.join(' > ')}. Found: ${headings.join(' > ') || '(none)'}`);
  }
  for (const component of ['LimitsTable', 'MistakesTable', 'CheckYourself', 'GoDeeper']) {
    if (!new RegExp(`<${component}\\s+service="${data.service}"`).test(body)) {
      error(file, `missing <${component} service="${data.service}" />`);
    }
  }
  if (!body.includes('<CodeTabs')) error(file, 'missing <CodeTabs> with the Python and TypeScript samples');
  if (!/```mermaid/.test(body)) warn(file, '"How it works" has no mermaid diagram');

  for (const path of samplePaths(body)) checkSample(file, path);

  if (data.mistakes.length < MISTAKES_MIN || data.mistakes.length > MISTAKES_MAX) {
    error(file, `has ${data.mistakes.length} common mistakes; the template asks for ${MISTAKES_MIN}-${MISTAKES_MAX}`);
  }
  if (data.limits.length === 0) error(file, 'no key limits listed');
  const qs = questionsByService.get(data.service) ?? 0;
  if (qs < CHECK_YOURSELF_MIN) error(file, `only ${qs} practice questions tag service "${data.service}"; Check yourself needs ${CHECK_YOURSELF_MIN}+`);

  for (const r of data.related) if (!PLANNED_SERVICES.has(r)) error(file, `related service "${r}" isn't in domains.ts`);
  checkTags(file, data.exams, data.exam_domains, data.tasks);
  checkFreshness(file, data.last_verified);
}

function headingsOf(body: string): string[] {
  let fenced = false;
  const out: string[] = [];
  for (const line of body.split('\n')) {
    if (line.trimStart().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) out.push(line.slice(3).trim());
  }
  return out;
}

function samplePaths(body: string): string[] {
  return [...body.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function checkSample(file: string, path: string) {
  const abs = join(SAMPLES_DIR, path);
  if (!existsSync(abs)) {
    error(file, `code sample samples/concepts/${path} doesn't exist`);
    return;
  }
  // Samples must be tested: foo.ts needs foo.test.ts beside it; Python needs tests/test_*.py in its project.
  if (abs.endsWith('.ts')) {
    if (!existsSync(abs.replace(/\.ts$/, '.test.ts'))) error(file, `samples/concepts/${path} has no ${basename(abs, '.ts')}.test.ts`);
  } else if (abs.endsWith('.py')) {
    const project = join(SAMPLES_DIR, path.split('/').slice(0, 2).join('/'));
    const testsDir = join(project, 'tests');
    const hasTests = existsSync(testsDir) && readdirSync(testsDir).some((f) => /^test_.*\.py$/.test(f));
    if (!hasTests) error(file, `samples/concepts/${dirname(path)} has no tests/test_*.py`);
  }
}

// ---- questions ----------------------------------------------------------------------
const seenQuestions = new Map<string, string>();
for (const q of content.questions) {
  if (seenQuestions.has(q.id)) error(q.file, `question id ${q.id} also used in ${seenQuestions.get(q.id)}`);
  seenQuestions.set(q.id, q.file);
  if (q.exam.toLowerCase() !== examFolderOf(q.file)) error(q.file, `exam ${q.exam} doesn't match folder`);
  if (!q.id.startsWith(`${stem(q.file)}-`)) error(q.file, `${q.id}: ids in ${stem(q.file)}.yaml start with "${stem(q.file)}-"`);
  for (const s of q.services) if (!PLANNED_SERVICES.has(s)) error(q.file, `${q.id}: unknown service "${s}"`);
  checkTags(q.file, [q.exam], q.exam_domains, q.tasks);
}

// ---- case studies and decision guides -------------------------------------------------
for (const s of content.caseStudies) {
  for (const svc of s.data.services) if (!PLANNED_SERVICES.has(svc)) error(s.file, `unknown service "${svc}"`);
  checkTags(s.file, s.data.exams, s.data.exam_domains, []);
  checkFreshness(s.file, s.data.last_verified);
}
for (const g of content.decide) {
  for (const svc of g.data.options) if (!PLANNED_SERVICES.has(svc)) error(g.file, `unknown service "${svc}"`);
  checkFreshness(g.file, g.data.last_verified);
}

// ---- report ---------------------------------------------------------------------------
const gha = process.env.GITHUB_ACTIONS === 'true';
for (const p of problems) {
  console.log(gha ? `::${p.level} file=${p.file}::${p.message}` : `${p.level.padEnd(7)} ${p.file}: ${p.message}`);
}
const errors = problems.filter((p) => p.level === 'error').length;
const warnings = problems.length - errors;
console.log(
  `\nChecked ${content.concepts.length} concept pages, ${content.questions.length} questions, ${content.exams.length} exams, ` +
    `${content.caseStudies.length} case studies, ${content.decide.length} decision guides: ${errors} errors, ${warnings} warnings.`,
);
process.exit(errors > 0 ? 1 : 0);
