// The content pipeline: the nine-block template checker, the question-writing policy, the 90-day
// freshness rule, the weekly exam-guide diff and the CI workflow. check-content.ts and
// exam-guide-diff.ts are Node scripts that run on import, so the rules they apply are ported here
// (the test suite compares the ported constants with the scripts); freshness.ts is imported as is.
import { Demo, clampInt, oneOf } from './lab.js';
import { CONCEPTS, DVA, LAMBDA, MAX_AGE_DAYS, PLANNED_SERVICES, QUESTIONS, SOURCES, WORKFLOWS, ageInDays, correctIds, isStale, isoDate } from '../kb/repo.js';

// ---- Nine-block template --------------------------------------------------------------------

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
export const MISTAKES_MIN = 5;
export const MISTAKES_MAX = 8;
export const CHECK_YOURSELF_MIN = 3;

export function headingsOf(body) {
  let fenced = false;
  const out = [];
  for (const line of body.split('\n')) {
    if (line.trimStart().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) out.push(line.slice(3).trim());
  }
  return out;
}

/** The concept-page rules from scripts/check-content.ts that don't need the file system. Same messages. */
export function checkConcept({ file, data, body }) {
  const problems = [];
  const error = (message) => problems.push({ level: 'error', file, message });
  const warn = (message) => problems.push({ level: 'warning', file, message });
  const planned = PLANNED_SERVICES.get(data.service);
  const stem = file.split('/').pop().replace(/\.mdx$/, '');
  const parent = file.split('/').slice(-2, -1)[0];
  if (stem !== data.service) error(`file name should be ${data.service}.mdx`);
  if (parent !== data.domain) error(`file should be in content/concepts/${data.domain}/`);
  if (!planned) error(`service "${data.service}" isn't in site/src/data/domains.ts`);
  else if (planned.domain !== data.domain) error(`domains.ts puts ${data.service} in ${planned.domain}, not ${data.domain}`);
  const headings = headingsOf(body);
  if (headings.join('|') !== TEMPLATE_HEADINGS.join('|')) {
    error(`H2 sections must be, in order: ${TEMPLATE_HEADINGS.join(' > ')}. Found: ${headings.join(' > ') || '(none)'}`);
  }
  for (const component of ['LimitsTable', 'MistakesTable', 'CheckYourself', 'GoDeeper']) {
    if (!new RegExp(`<${component}\\s+service="${data.service}"`).test(body)) error(`missing <${component} service="${data.service}" />`);
  }
  if (!body.includes('<CodeTabs')) error('missing <CodeTabs> with the Python and TypeScript samples');
  if (!/```mermaid/.test(body)) warn('"How it works" has no mermaid diagram');
  const mistakes = data.mistakes?.length || 0;
  if (mistakes < MISTAKES_MIN || mistakes > MISTAKES_MAX) error(`has ${mistakes} common mistakes; the template asks for ${MISTAKES_MIN}-${MISTAKES_MAX}`);
  if (!data.limits?.length) error('no key limits listed');
  const qs = QUESTIONS.filter((q) => q.services.includes(data.service)).length;
  if (qs < CHECK_YOURSELF_MIN) error(`only ${qs} practice questions tag service "${data.service}"; Check yourself needs ${CHECK_YOURSELF_MIN}+`);
  for (const r of data.related || []) if (!PLANNED_SERVICES.has(r)) error(`related service "${r}" isn't in domains.ts`);
  return problems;
}

export const TEMPLATE_VARIANTS = ['the real lambda.mdx', 'two sections swapped', 'a section missing', 'only 4 common mistakes', 'service not in domains.ts'];

export function mutate(variant, page = LAMBDA) {
  const { data, body, file } = page;
  const swap = (a, b) => body.replace(`## ${a}`, '## __A__').replace(`## ${b}`, `## ${a}`).replace('## __A__', `## ${b}`);
  switch (variant) {
    case TEMPLATE_VARIANTS[1]:
      return { file, data, body: swap('Code', 'How it works') };
    case TEMPLATE_VARIANTS[2]:
      return { file, data, body: body.replace(/## Security and cost notes[\s\S]*?(?=## Check yourself)/, '') };
    case TEMPLATE_VARIANTS[3]:
      return { file, body, data: { ...data, mistakes: data.mistakes.slice(0, 4) } };
    case TEMPLATE_VARIANTS[4]:
      return { file: file.replace('lambda.mdx', 'lambdas.mdx'), body, data: { ...data, service: 'lambdas' } };
    default:
      return page;
  }
}

export function template(inputs, { broken = null } = {}) {
  const d = new Demo('page-template');
  const variant = broken || oneOf(inputs.variant, TEMPLATE_VARIANTS);
  const page = mutate(variant);
  d.cmd(`npm run check:content  (rules ported from scripts/check-content.ts) on ${variant === TEMPLATE_VARIANTS[0] ? page.file : `${page.file} with ${variant}`}`);
  const problems = checkConcept(page);
  problems.forEach((p) => d.cmd(`${p.level.padEnd(7)} ${p.file}: ${p.message}`));
  const errors = problems.filter((p) => p.level === 'error');
  d.cmd(`Checked 1 concept page: ${errors.length} errors, ${problems.length - errors.length} warnings.  (exit ${errors.length ? 1 : 0})`);
  const headings = headingsOf(page.body);
  if (variant === TEMPLATE_VARIANTS[0]) {
    d.check('The Lambda exemplar passes the template check', errors.length === 0, `${headings.length} H2 sections in order, ${page.data.mistakes.length} mistakes, ${page.data.limits.length} limits`);
    d.check('Every live concept page passes', CONCEPTS.every((c) => checkConcept(c).filter((p) => p.level === 'error').length === 0), `${CONCEPTS.length} page(s)`);
  } else {
    d.check(`The checker catches "${variant}" and fails CI`, errors.length > 0, errors[0]?.message);
  }
  return d.result({ variant, headings, problems, expected: TEMPLATE_HEADINGS, mistakes: page.data.mistakes?.length || 0 });
}

// ---- Question-writing policy ----------------------------------------------------------------

const LETTER_REF = /\b(option|answer|choice)\s+[A-Ea-e]\b|\(([a-e])\)\s/;
const HOW_MANY = /\b(TWO|THREE|FOUR|two|three|four)\b/;

export function questionProblems(q) {
  const out = [];
  const correct = correctIds(q).length;
  if (q.type === 'single' && (q.options.length !== 4 || correct !== 1)) out.push(`single choice needs 1 correct of 4 (has ${correct} of ${q.options.length})`);
  if (q.type === 'multiple' && (q.options.length < 5 || correct < 2)) out.push(`multiple response needs 2+ correct of 5+ (has ${correct} of ${q.options.length})`);
  if (q.type === 'multiple' && !HOW_MANY.test(q.stem)) out.push('multiple response must say how many to choose');
  q.options.forEach((o) => {
    if (!o.why) out.push(`option "${o.text.slice(0, 30)}…" has no why`);
    if (o.why && LETTER_REF.test(o.why)) out.push(`option why refers to an option letter: "${o.why.match(LETTER_REF)[0].trim()}"`);
  });
  if (LETTER_REF.test(q.explanation || '')) out.push(`explanation refers to an option letter: "${q.explanation.match(LETTER_REF)[0].trim()}"`);
  if (!q.sources?.length) out.push('no sources: every question links the AWS doc it is based on');
  return out;
}

/** A deliberately bad question, written for this demo; it is not from the question bank. */
export const BAD_QUESTION = {
  id: 'lambda-bad',
  type: 'multiple',
  stem: 'Which options reduce Lambda cold starts?',
  options: [
    { id: 'a', text: 'Provisioned concurrency', correct: true, why: 'Pre-initializes environments.' },
    { id: 'b', text: 'Reserved concurrency', correct: false, why: 'Unlike option A, this does not pre-initialize anything.' },
    { id: 'c', text: 'A longer timeout', correct: false, why: '' },
    { id: 'd', text: 'Smaller deployment package', correct: true, why: 'Less code to load during Init.' },
  ],
  explanation: 'Option A is the main fix.',
  sources: [],
};

export function shuffleShowsLetterProblem(q = BAD_QUESTION) {
  const reordered = [q.options[2], q.options[0], q.options[3], q.options[1]].map((o, i) => ({ ...o, id: 'abcd'[i] }));
  return { before: q.options.map((o) => `${o.id.toUpperCase()}. ${o.text}`), after: reordered.map((o) => `${o.id.toUpperCase()}. ${o.text}`), optionAAfter: reordered[0].text };
}

export function questionPolicy(inputs, { bad = false } = {}) {
  const d = new Demo('question-policy');
  const target = bad ? [BAD_QUESTION] : QUESTIONS;
  d.cmd(bad ? 'check a badly written question against docs/question-policy.md' : `check ${QUESTIONS.length} questions in content/exams/*/questions/*.yaml against docs/question-policy.md`);
  const report = target.map((q) => ({ id: q.id, type: q.type, problems: questionProblems(q) }));
  report.forEach((r) => d.cmd(`${r.problems.length ? '✗' : '✓'} ${r.id} (${r.type})${r.problems.length ? `: ${r.problems.join('; ')}` : ''}`));
  if (bad) {
    const shuffle = shuffleShowsLetterProblem();
    d.cmd(`after shuffling, "Option A" is "${shuffle.optionAAfter}", not "Provisioned concurrency"`);
    d.check('The policy check flags every rule this question breaks', report[0].problems.length >= 4, `${report[0].problems.length} problems`);
    d.check('Letter references break once options are shuffled', shuffle.optionAAfter !== 'Provisioned concurrency', `"Option A" now means "${shuffle.optionAAfter}"`);
  } else {
    d.check('Every question in the bank follows the policy', report.every((r) => r.problems.length === 0), `${report.filter((r) => !r.problems.length).length}/${report.length}`);
    const ids = QUESTIONS.map((q) => q.id);
    d.check('Question ids are unique and start with their file name', new Set(ids).size === ids.length && QUESTIONS.every((q) => q.id.startsWith(`${q.file.split('/').pop().replace('.yaml', '')}-`)), ids.join(', '));
  }
  return d.result({ report, bad, shuffle: bad ? shuffleShowsLetterProblem() : null });
}

// ---- Freshness ------------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

export function freshness(inputs, { futureDate = false } = {}) {
  const d = new Demo('freshness');
  const ahead = clampInt(inputs.daysAhead, 0, 400, 0);
  const now = new Date(Date.now() + ahead * DAY);
  d.cmd(`today + ${ahead} days = ${isoDate(now)}; MAX_AGE_DAYS = ${MAX_AGE_DAYS} (site/src/lib/freshness.ts)`);
  const pages = CONCEPTS.map((c) => {
    const verified = new Date(futureDate ? isoDate(new Date(Date.now() + 10 * DAY)) : c.data.last_verified);
    const age = ageInDays(verified, now);
    return { title: c.data.title, file: c.file, verified: isoDate(verified), age, stale: isStale(verified, now), daysLeft: MAX_AGE_DAYS - age };
  });
  pages.forEach((p) => d.cmd(`${p.file}: last verified ${p.verified}, ${p.age} days old → ${p.age < 0 ? 'error: in the future' : p.stale ? 'Needs review badge + weekly issue' : `fresh (${p.daysLeft} days left)`}`));
  const base = new Date('2026-01-01T00:00:00Z');
  d.check('Day 90 is still fresh; day 91 needs review', !isStale(base, new Date(base.getTime() + 90 * DAY)) && isStale(base, new Date(base.getTime() + 91 * DAY)), 'isStale() from freshness.ts');
  if (futureDate) {
    const p = pages[0];
    d.cmd(`error   ${p.file}: last_verified ${p.verified} is in the future`);
    d.check('A last_verified date in the future is a content error', p.age < 0, `age ${p.age} days`);
  } else {
    const cron = WORKFLOWS.freshness.on.schedule?.[0]?.cron;
    d.check('The weekly freshness job lists stale pages in a tracking issue', cron === '0 7 * * 1', `cron "${cron}" (Mondays 07:00 UTC)`);
  }
  return d.result({ pages, now: isoDate(now), ahead, max: MAX_AGE_DAYS, futureDate });
}

// ---- Exam-guide diff -----------------------------------------------------------------------

/** Port of toText() in scripts/exam-guide-diff.ts: strip markup, collapse whitespace, drop blank lines. */
export function toText(body, url) {
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

export function diffLines(previous, snapshot) {
  const before = new Set(previous.split('\n'));
  const after = new Set(snapshot.split('\n'));
  return { added: [...after].filter((l) => !before.has(l)), removed: [...before].filter((l) => !after.has(l)) };
}

// Example guide pages for the demo (placeholders, not real task statements)
const PAGE_V1 = `<html><nav>Docs menu</nav><h2>Domain 2: Security (26% of scored content)</h2>
<ul><li>Task 2.1: (example task statement)</li>
<li>Task 2.2: (example task statement)</li></ul><footer>© AWS</footer></html>`;
export const GUIDE_SCENARIOS = {
  'a task statement added': PAGE_V1.replace('</ul>', '<li>Task 2.3: (new example task statement)</li></ul>'),
  'a domain weight changed': PAGE_V1.replace('26%', '28%'),
  'only markup and whitespace changed': PAGE_V1.replace(/<li>/g, '<li class="awsdocs">\n   ').replace('<h2>', '<h2 id="d2">'),
};

export function examDiff(inputs, { raw = false } = {}) {
  const d = new Demo('exam-guide-diff');
  const scenario = raw ? 'only markup and whitespace changed' : oneOf(inputs.scenario, Object.keys(GUIDE_SCENARIOS));
  const url = 'https://docs.aws.amazon.com/aws-certification/latest/example-guide.html';
  d.cmd(`exam.yaml guide_urls for DVA-C03: ${DVA.guide_urls.length ? DVA.guide_urls.join(', ') : '[] → "DVA-C03: no guide_urls in exam.yaml, skipping" (until the guide publishes)'}`);
  d.cmd(`example: fetch ${url}; compare with content/exams/<code>/guide-snapshot.md`);
  const before = raw ? PAGE_V1 : toText(PAGE_V1, url);
  const after = raw ? GUIDE_SCENARIOS[scenario] : toText(GUIDE_SCENARIOS[scenario], url);
  const diff = diffLines(before, after);
  d.cmd(`${diff.added.length} lines added, ${diff.removed.length} removed${raw ? ' (raw HTML, not normalised)' : ''}`);
  diff.removed.forEach((l) => d.cmd(`- ${l}`));
  diff.added.forEach((l) => d.cmd(`+ ${l}`));
  if (raw) {
    const clean = diffLines(toText(PAGE_V1, url), toText(GUIDE_SCENARIOS[scenario], url));
    d.check('Diffing raw HTML reports changes that are only markup', diff.added.length + diff.removed.length > 0, `${diff.added.length + diff.removed.length} noisy lines`);
    d.check('toText() normalisation removes the noise', clean.added.length + clean.removed.length === 0, '0 lines changed → no pull request');
  } else if (scenario === 'only markup and whitespace changed') {
    d.check('A markup-only change opens no pull request', diff.added.length + diff.removed.length === 0, 'snapshot unchanged');
  } else {
    d.check('A content change is detected and opens a pull request', diff.added.length > 0, diff.added.join(' | '));
    d.check('Navigation and footer are ignored', !after.includes('Docs menu') && !after.includes('© AWS'), 'nav/footer stripped');
  }
  return d.result({ scenario, before, after, diff, raw });
}

// ---- CI ---------------------------------------------------------------------------------------

export function ciJobs() {
  return Object.entries(WORKFLOWS.ci.jobs).map(([id, job]) => ({
    id,
    name: job.name || id,
    needs: [job.needs || []].flat(),
    steps: (job.steps || []).map((s) => s.run || s.uses || s.name).filter(Boolean),
  }));
}

export function runCi(failing) {
  const jobs = ciJobs();
  const status = {};
  const waves = [];
  let pending = [...jobs];
  while (pending.length) {
    const ready = pending.filter((j) => j.needs.every((n) => status[n]));
    if (!ready.length) break;
    waves.push(ready.map((j) => j.id));
    for (const j of ready) {
      if (j.needs.some((n) => status[n] !== 'success')) status[j.id] = 'skipped';
      else status[j.id] = j.id === failing ? 'failure' : 'success';
    }
    pending = pending.filter((j) => !ready.includes(j));
  }
  return { jobs, status, waves };
}

export const KEY_IN_WORKFLOW = `      - uses: aws-actions/configure-aws-credentials@v6
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}`;

export function scanWorkflow(text) {
  return [...text.matchAll(/secrets\.(AWS_[A-Z_]+)/g)].map((m) => m[1]);
}

export function ci(inputs, { storedKeys = false } = {}) {
  const d = new Demo('ci-pipeline');
  const jobs = ciJobs();
  const failing = oneOf(inputs.failJob, ['none', ...jobs.map((j) => j.id)]);
  const run = runCi(failing);
  d.cmd(`.github/workflows/ci.yml: ${jobs.length} jobs, permissions ${JSON.stringify(WORKFLOWS.ci.permissions)}, cancel-in-progress ${WORKFLOWS.ci.concurrency['cancel-in-progress']}`);
  run.waves.forEach((w, i) => d.cmd(`wave ${i + 1}: ${w.map((id) => `${id} → ${run.status[id]}`).join(', ')}`));
  const deployIf = WORKFLOWS.deploy.jobs.deploy.if;
  d.cmd(`deploy.yml runs on push to main if ${deployIf}; samples-live.yml if ${WORKFLOWS.samplesLive.jobs.live.if}`);

  if (storedKeys) {
    const found = scanWorkflow(KEY_IN_WORKFLOW);
    d.cmd(`scan a workflow that uses stored keys → secrets.${found.join(', secrets.')}`);
    d.check('Long-lived AWS keys stored as GitHub secrets are flagged', found.length === 2, found.join(', '));
    const repoKeys = Object.values(SOURCES).filter((s) => typeof s === 'string').flatMap(scanWorkflow);
    d.check('The repo’s workflows use OIDC roles instead', repoKeys.length === 0 && WORKFLOWS.deploy.permissions['id-token'] === 'write', 'id-token: write + role-to-assume');
  } else {
    d.check('CI only gets a read-only token', WORKFLOWS.ci.permissions.contents === 'read' && Object.keys(WORKFLOWS.ci.permissions).length === 1, JSON.stringify(WORKFLOWS.ci.permissions));
    d.check('The site build waits for the content checks', jobs.find((j) => j.id === 'site').needs.includes('content'), 'site needs content');
    if (failing !== 'none') {
      const skipped = Object.entries(run.status).filter(([, s]) => s === 'skipped').map(([id]) => id);
      d.check(`A failing ${failing} job fails the run${skipped.length ? ' and skips what depends on it' : ''}`, run.status[failing] === 'failure', skipped.length ? `skipped: ${skipped.join(', ')}` : 'no dependents');
    }
    d.check('A deploy in progress is never cancelled', WORKFLOWS.deploy.concurrency['cancel-in-progress'] === false, 'deploy.yml concurrency');
  }
  return d.result({ ...run, failing, deployIf, storedKeys, keyWorkflow: storedKeys ? KEY_IN_WORKFLOW : null });
}

