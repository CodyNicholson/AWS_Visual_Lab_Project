import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  caseStudySchema,
  conceptSchema,
  decideSchema,
  examSchema,
  objectivesSchema,
  questionFileSchema,
} from './lib/schemas';

// All authored content lives in ../content so it is reviewed like code, separate from site code.
const examDir = (entry: string) => entry.split('/')[0];

export const collections = {
  concepts: defineCollection({
    loader: glob({ pattern: '**/*.mdx', base: '../content/concepts' }),
    schema: conceptSchema,
  }),
  decide: defineCollection({
    loader: glob({ pattern: '*.mdx', base: '../content/decide' }),
    schema: decideSchema,
  }),
  caseStudies: defineCollection({
    loader: glob({ pattern: '*.mdx', base: '../content/case-studies' }),
    schema: caseStudySchema,
  }),
  exams: defineCollection({
    loader: glob({ pattern: '*/exam.yaml', base: '../content/exams', generateId: ({ entry }) => examDir(entry) }),
    schema: examSchema,
  }),
  objectives: defineCollection({
    loader: glob({ pattern: '*/objectives.yaml', base: '../content/exams', generateId: ({ entry }) => examDir(entry) }),
    schema: objectivesSchema,
  }),
  questions: defineCollection({
    loader: glob({
      pattern: '*/questions/*.yaml',
      base: '../content/exams',
      generateId: ({ entry }) => entry.replace(/\.yaml$/, '').replace('/questions/', '/'),
    }),
    schema: questionFileSchema,
  }),
};
