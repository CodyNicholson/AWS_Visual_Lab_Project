// Frontmatter and data schemas, shared by the Astro content collections and scripts/check-content.ts.
import { z } from 'astro/zod';
import { KB_DOMAIN_SLUGS } from '../data/domains';

export const examCode = z.string().regex(/^[A-Z]{3}-C\d{2}$/, 'exam code like DVA-C03');
export const examDomainId = z.string().regex(/^[A-Z]{3}-C\d{2}-D\d$/, 'exam domain like DVA-C03-D1');
export const taskId = z.string().regex(/^[A-Z]{3}-C\d{2}-\d+\.\d+$/, 'task statement like DVA-C03-2.3');
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case slug');

export const sourceSchema = z.object({ title: z.string(), url: z.url() });

export const mistakeSchema = z.object({
  mistake: z.string(),
  symptom: z.string(),
  why: z.string(),
  fix: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  // Literal error text a reader might paste into search, e.g. "Task timed out after 3.00 seconds".
  errors: z.array(z.string()).default([]),
  source: sourceSchema,
});

export const limitSchema = z.object({
  name: z.string(),
  value: z.string(),
  note: z.string().optional(),
  source: z.url(),
});

export const conceptSchema = z.object({
  title: z.string(),
  service: slug,
  summary: z.string().max(200),
  domain: z.enum(KB_DOMAIN_SLUGS),
  exams: z.array(examCode).min(1),
  exam_domains: z.array(examDomainId).default([]),
  tasks: z.array(taskId).default([]),
  difficulty: z.enum(['foundational', 'associate', 'professional']),
  last_verified: z.coerce.date(),
  sources: z.array(sourceSchema).min(1),
  related: z.array(slug).default([]),
  compare_with: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  limits: z.array(limitSchema).default([]),
  mistakes: z.array(mistakeSchema).default([]),
});

const optionSchema = z.object({
  id: z.string().regex(/^[a-z]$/),
  text: z.string(),
  correct: z.boolean().default(false),
  why: z.string(),
});

export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*-\d{3}$/, 'question id like lambda-001'),
    type: z.enum(['single', 'multiple']),
    stem: z.string(),
    options: z.array(optionSchema).min(4),
    explanation: z.string(),
    services: z.array(slug).min(1),
    exam_domains: z.array(examDomainId).min(1),
    tasks: z.array(taskId).default([]),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((q, ctx) => {
    // Mirrors the AWS response types: multiple choice has 1 correct of 4;
    // multiple response has 2+ correct of 5+.
    const correct = q.options.filter((o) => o.correct).length;
    if (q.type === 'single' && correct !== 1) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: single-answer question needs exactly 1 correct option, has ${correct}` });
    }
    if (q.type === 'multiple' && (correct < 2 || q.options.length < 5)) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: multiple-response question needs 2+ correct of 5+ options` });
    }
    const ids = q.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: duplicate option ids` });
    }
  });

export const questionFileSchema = z.object({
  exam: examCode,
  questions: z.array(questionSchema).min(1),
});

export const examSchema = z.object({
  code: examCode,
  name: z.string(),
  level: z.enum(['foundational', 'associate', 'professional', 'specialty']),
  status: z.enum(['upcoming', 'current', 'retiring', 'retired']),
  summary: z.string(),
  format: z.object({
    duration_minutes: z.number().int().positive(),
    questions_total: z.number().int().positive(),
    questions_scored: z.number().int().positive(),
    passing_score: z.number().int().positive(),
    score_scale: z.tuple([z.number().int(), z.number().int()]),
    question_types: z.array(z.string()),
  }),
  dates: z.array(z.object({ label: z.string(), date: z.coerce.date() })).default([]),
  // Pages of the official exam guide; the weekly freshness job diffs these.
  guide_urls: z.array(z.url()).default([]),
  verified: z.object({ on: z.coerce.date(), against: z.array(sourceSchema).min(1), notes: z.string().optional() }),
});

export const objectivesSchema = z.object({
  exam: examCode,
  status: z.enum(['provisional', 'official']),
  status_note: z.string().optional(),
  domains: z.array(
    z.object({
      id: examDomainId,
      number: z.number().int().positive(),
      name: z.string(),
      weight: z.number().positive().max(100),
      tasks: z.array(z.object({ id: taskId, title: z.string(), skills: z.array(z.string()).default([]) })).default([]),
    }),
  ),
  sources: z.array(sourceSchema).min(1),
});

export const caseStudySchema = z.object({
  title: z.string(),
  summary: z.string(),
  services: z.array(slug).min(1),
  exams: z.array(examCode).default([]),
  exam_domains: z.array(examDomainId).default([]),
  last_verified: z.coerce.date(),
  sources: z.array(sourceSchema).default([]),
  code_path: z.string().optional(),
});

export const decideSchema = z.object({
  title: z.string(),
  summary: z.string(),
  options: z.array(slug).min(2),
  exam_domains: z.array(examDomainId).default([]),
  last_verified: z.coerce.date(),
  sources: z.array(sourceSchema).min(1),
});

export type Concept = z.infer<typeof conceptSchema>;
export type Mistake = z.infer<typeof mistakeSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Exam = z.infer<typeof examSchema>;
export type Objectives = z.infer<typeof objectivesSchema>;
