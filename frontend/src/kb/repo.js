// Everything the lab knows about the knowledge base comes from the repository itself, read at build
// time: concept pages, exam facts and questions from content/, code from samples/ and infra/, the
// CI workflows, and the site's own TypeScript helpers. Add a page or a question to content/ and the
// lab picks it up on the next build.
import { parse } from 'yaml';

export { KB_DOMAINS, PLANNED_SERVICES } from '../../../site/src/data/domains.ts';
export { MAX_AGE_DAYS, ageInDays, isStale, isoDate } from '../../../site/src/lib/freshness.ts';
export { MIN_PAGES_PER_TASK, MIN_QUESTIONS_PER_TASK, computeCoverage } from '../../../site/src/lib/coverage.ts';
export { correctIds, isCorrect } from '../../../site/src/islands/types.ts';

import handlerPy from '../../../samples/concepts/lambda/python/order_worker/handler.py?raw';
import handlerPyTest from '../../../samples/concepts/lambda/python/tests/test_lambda_order_worker.py?raw';
import orderWorkerTs from '../../../samples/concepts/lambda/typescript/order-worker.ts?raw';
import orderWorkerTsTest from '../../../samples/concepts/lambda/typescript/order-worker.test.ts?raw';
import orderWorkerStack from '../../../samples/concepts/lambda/cdk/order-worker-stack.ts?raw';
import orderWorkerStackTest from '../../../samples/concepts/lambda/cdk/order-worker-stack.test.ts?raw';
import siteStack from '../../../infra/lib/site-stack.ts?raw';
import oidcStack from '../../../infra/lib/github-oidc-stack.ts?raw';
import budgetStack from '../../../infra/lib/sandbox-budget-stack.ts?raw';
import infraApp from '../../../infra/bin/app.ts?raw';
import ciYml from '../../../.github/workflows/ci.yml?raw';
import deployYml from '../../../.github/workflows/deploy.yml?raw';
import freshnessYml from '../../../.github/workflows/freshness.yml?raw';
import samplesLiveYml from '../../../.github/workflows/samples-live.yml?raw';
import checkContentTs from '../../../scripts/check-content.ts?raw';
import examGuideDiffTs from '../../../scripts/exam-guide-diff.ts?raw';
import freshnessTs from '../../../site/src/lib/freshness.ts?raw';
import coverageTs from '../../../site/src/lib/coverage.ts?raw';

const raw = (files) => Object.entries(files).map(([path, text]) => ({ file: path.replace(/^(\.\.\/)+/, ''), text }));

const conceptFiles = raw(import.meta.glob('../../../content/concepts/**/*.mdx', { query: '?raw', import: 'default', eager: true }));
const examFiles = raw(import.meta.glob('../../../content/exams/*/exam.yaml', { query: '?raw', import: 'default', eager: true }));
const objectiveFiles = raw(import.meta.glob('../../../content/exams/*/objectives.yaml', { query: '?raw', import: 'default', eager: true }));
const caseStudyFiles = raw(import.meta.glob('../../../content/case-studies/*.mdx', { query: '?raw', import: 'default', eager: true }));
const decideFiles = raw(import.meta.glob('../../../content/decide/*.mdx', { query: '?raw', import: 'default', eager: true }));
const questionFiles = raw(import.meta.glob('../../../content/exams/*/questions/*.yaml', { query: '?raw', import: 'default', eager: true }));

/** Splits an MDX file into its YAML frontmatter and its body. */
export function splitFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: text };
  return { data: parse(match[1]) || {}, body: match[2] };
}

export const CONCEPTS = conceptFiles.map(({ file, text }) => ({ file, text, ...splitFrontmatter(text) }));
export const CASE_STUDY_PAGES = caseStudyFiles.map(({ file, text }) => ({ file, ...splitFrontmatter(text) }));
export const DECISION_PAGES = decideFiles.map(({ file, text }) => ({ file, ...splitFrontmatter(text) }));
export const EXAMS = examFiles.map(({ file, text }) => ({ file, data: parse(text) }));
// The site's zod schemas default missing lists to []; do the same here.
export const OBJECTIVES = objectiveFiles.map(({ file, text }) => {
  const data = parse(text);
  return { file, data: { ...data, domains: (data.domains || []).map((d) => ({ tasks: [], ...d })) } };
});
export const QUESTIONS = questionFiles.flatMap(({ file, text }) => {
  const doc = parse(text);
  return (doc.questions || []).map((q) => ({ tasks: [], ...q, exam: doc.exam, file }));
});

export const LAMBDA = CONCEPTS.find((c) => c.data.service === 'lambda');
export const DVA = EXAMS.find((e) => e.data.code === 'DVA-C03')?.data;
export const DVA_OBJECTIVES = OBJECTIVES.find((o) => o.data.exam === 'DVA-C03')?.data;

/** The H2 sections of an MDX body, skipping fenced code (same rule as scripts/check-content.ts). */
export function sectionsOf(body) {
  const sections = [];
  let fenced = false;
  let current = null;
  for (const line of body.split('\n')) {
    if (line.trimStart().startsWith('```')) fenced = !fenced;
    if (!fenced && line.startsWith('## ')) {
      current = { title: line.slice(3).trim(), lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
  }
  return sections.map((s) => ({ title: s.title, text: s.lines.join('\n').trim() }));
}

/** The first fenced block of a language in an MDX body, e.g. the least-privilege policy. */
export function fencedBlock(body, lang) {
  const match = body.match(new RegExp('```' + lang + '\\r?\\n([\\s\\S]*?)```'));
  return match ? match[1].trim() : null;
}

export const SOURCES = {
  handlerPy,
  handlerPyTest,
  orderWorkerTs,
  orderWorkerTsTest,
  orderWorkerStack,
  orderWorkerStackTest,
  siteStack,
  oidcStack,
  budgetStack,
  infraApp,
  ciYml,
  deployYml,
  freshnessYml,
  samplesLiveYml,
  checkContentTs,
  examGuideDiffTs,
  freshnessTs,
  coverageTs,
};

export const WORKFLOWS = {
  ci: parse(ciYml),
  deploy: parse(deployYml),
  freshness: parse(freshnessYml),
  samplesLive: parse(samplesLiveYml),
};

/** A trimmed excerpt of a source file: the lines from the first match of `from` to `to` (inclusive). */
export function excerpt(text, from, to) {
  const lines = text.split('\n');
  const start = Math.max(0, lines.findIndex((l) => l.includes(from)));
  let end = to ? lines.findIndex((l, i) => i > start && l.includes(to)) : lines.length - 1;
  if (end < 0) end = lines.length - 1;
  return lines.slice(start, end + 1).join('\n');
}
