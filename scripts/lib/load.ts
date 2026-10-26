// Loads and validates everything under content/ without Astro, using the same schemas as the site.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { z } from 'astro/zod';
import { REPO_ROOT } from '../../site/src/lib/paths';
import {
  caseStudySchema,
  conceptSchema,
  decideSchema,
  examSchema,
  objectivesSchema,
  questionFileSchema,
  type Concept,
  type Exam,
  type Objectives,
  type Question,
} from '../../site/src/lib/schemas';

export const CONTENT_DIR = join(REPO_ROOT, 'content');

export interface Problem {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

export interface Loaded<T> {
  file: string; // repo-relative
  data: T;
  body: string;
}

export interface ContentSet {
  concepts: Loaded<Concept>[];
  decide: Loaded<z.infer<typeof decideSchema>>[];
  caseStudies: Loaded<z.infer<typeof caseStudySchema>>[];
  exams: Loaded<Exam>[];
  objectives: Loaded<Objectives>[];
  questions: (Question & { exam: string; file: string })[];
  problems: Problem[];
}

export const rel = (abs: string) => relative(REPO_ROOT, abs);

export function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(text: string): { frontmatter: unknown; body: string } {
  const m = FRONTMATTER.exec(text);
  if (!m) return { frontmatter: undefined, body: text };
  return { frontmatter: parseYaml(m[1]), body: text.slice(m[0].length) };
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

function loadAll<S extends z.ZodType>(files: string[], schema: S, problems: Problem[], kind: 'mdx' | 'yaml'): Loaded<z.infer<S>>[] {
  const out: Loaded<z.infer<S>>[] = [];
  for (const abs of files) {
    const file = rel(abs);
    let raw: unknown;
    let body = '';
    try {
      const text = readFileSync(abs, 'utf8');
      if (kind === 'mdx') ({ frontmatter: raw, body } = splitFrontmatter(text));
      else raw = parseYaml(text);
    } catch (err) {
      problems.push({ level: 'error', file, message: `cannot parse: ${(err as Error).message}` });
      continue;
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const message of formatIssues(parsed.error)) problems.push({ level: 'error', file, message });
      continue;
    }
    out.push({ file, data: parsed.data, body });
  }
  return out;
}

export function loadContent(): ContentSet {
  const problems: Problem[] = [];
  const examsDir = join(CONTENT_DIR, 'exams');
  const examFolders = existsSync(examsDir) ? readdirSync(examsDir).filter((d) => statSync(join(examsDir, d)).isDirectory()) : [];

  const questionFiles = loadAll(
    examFolders.flatMap((d) => walk(join(examsDir, d, 'questions'), '.yaml')),
    questionFileSchema,
    problems,
    'yaml',
  );

  return {
    concepts: loadAll(walk(join(CONTENT_DIR, 'concepts'), '.mdx'), conceptSchema, problems, 'mdx'),
    decide: loadAll(walk(join(CONTENT_DIR, 'decide'), '.mdx'), decideSchema, problems, 'mdx'),
    caseStudies: loadAll(walk(join(CONTENT_DIR, 'case-studies'), '.mdx'), caseStudySchema, problems, 'mdx'),
    exams: loadAll(examFolders.map((d) => join(examsDir, d, 'exam.yaml')).filter(existsSync), examSchema, problems, 'yaml'),
    objectives: loadAll(examFolders.map((d) => join(examsDir, d, 'objectives.yaml')).filter(existsSync), objectivesSchema, problems, 'yaml'),
    questions: questionFiles.flatMap((f) => f.data.questions.map((q) => ({ ...q, exam: f.data.exam, file: f.file }))),
    problems,
  };
}

/** "content/exams/dva-c03/questions/lambda.yaml" -> "dva-c03" */
export const examFolderOf = (file: string) => file.split('/')[2];
export const stem = (file: string) => basename(file).replace(/\.[^.]+$/, '');
export const parentDir = (file: string) => basename(dirname(file));
