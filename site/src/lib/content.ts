import { getCollection, type CollectionEntry } from 'astro:content';
import type { Question } from './schemas';

export type ConceptEntry = CollectionEntry<'concepts'>;
export type ExamQuestion = Question & { exam: string };

export const examSlug = (code: string) => code.toLowerCase();
export const conceptHref = (entry: ConceptEntry) => `/concepts/${entry.id}/`;

export async function getConcepts(): Promise<ConceptEntry[]> {
  return (await getCollection('concepts')).sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export async function getConceptByService(service: string): Promise<ConceptEntry | undefined> {
  return (await getCollection('concepts')).find((c) => c.data.service === service);
}

export async function getQuestions(exam?: string): Promise<ExamQuestion[]> {
  const files = await getCollection('questions');
  return files
    .filter((f) => !exam || f.data.exam === exam)
    .flatMap((f) => f.data.questions.map((q) => ({ ...q, exam: f.data.exam })))
    .sort((a, b) => a.id.localeCompare(b.id));
}
