// Objective-map coverage, computed on every build (hub page) and in scripts/coverage-report.ts.
// Phase 1 gate: every task statement has >= 1 concept page and >= 5 practice questions.
import type { Objectives } from './schemas';

export const MIN_PAGES_PER_TASK = 1;
export const MIN_QUESTIONS_PER_TASK = 5;

interface Tagged {
  id: string;
  exam_domains: string[];
  tasks: string[];
}

export interface TaskCoverage {
  id: string;
  title: string;
  pages: string[];
  questions: string[];
  covered: boolean;
}

export interface DomainCoverage {
  id: string;
  number: number;
  name: string;
  weight: number;
  pages: string[];
  questions: string[];
  tasks: TaskCoverage[];
}

export interface Coverage {
  domains: DomainCoverage[];
  taskCount: number;
  coveredTasks: number;
  /** null until the exam guide's task statements are loaded into objectives.yaml */
  percent: number | null;
}

export function computeCoverage(objectives: Objectives, pages: Tagged[], questions: Tagged[]): Coverage {
  const domains = objectives.domains.map((d) => {
    const tasks = d.tasks.map((t) => {
      const p = pages.filter((x) => x.tasks.includes(t.id)).map((x) => x.id);
      const q = questions.filter((x) => x.tasks.includes(t.id)).map((x) => x.id);
      return {
        id: t.id,
        title: t.title,
        pages: p,
        questions: q,
        covered: p.length >= MIN_PAGES_PER_TASK && q.length >= MIN_QUESTIONS_PER_TASK,
      };
    });
    const taskIds = new Set(d.tasks.map((t) => t.id));
    const inDomain = (x: Tagged) => x.exam_domains.includes(d.id) || x.tasks.some((t) => taskIds.has(t));
    return {
      id: d.id,
      number: d.number,
      name: d.name,
      weight: d.weight,
      pages: pages.filter(inDomain).map((x) => x.id),
      questions: questions.filter(inDomain).map((x) => x.id),
      tasks,
    };
  });
  const taskCount = domains.reduce((n, d) => n + d.tasks.length, 0);
  const coveredTasks = domains.reduce((n, d) => n + d.tasks.filter((t) => t.covered).length, 0);
  return { domains, taskCount, coveredTasks, percent: taskCount ? Math.round((coveredTasks / taskCount) * 100) : null };
}
