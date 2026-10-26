export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
  why: string;
}

export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple';
  stem: string;
  options: QuizOption[];
  explanation: string;
  services: string[];
  exam_domains: string[];
  difficulty: string;
  sources: { title: string; url: string }[];
}

export const correctIds = (q: QuizQuestion) => q.options.filter((o) => o.correct).map((o) => o.id);

export function isCorrect(q: QuizQuestion, picked: string[]): boolean {
  const want = correctIds(q);
  return picked.length === want.length && want.every((id) => picked.includes(id));
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
