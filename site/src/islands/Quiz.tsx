import { useState } from 'react';
import QuestionCard from './QuestionCard';
import type { QuizQuestion } from './types';

export default function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <ol className="space-y-4">
      {questions.map((q, i) => (
        <li key={q.id}>
          <QuestionCard
            question={q}
            number={i + 1}
            picked={picked[q.id] ?? []}
            onPick={(ids) => setPicked({ ...picked, [q.id]: ids })}
            revealed={!!revealed[q.id]}
          />
          <div className="mt-2 flex gap-2">
            {revealed[q.id] ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
                onClick={() => {
                  setRevealed({ ...revealed, [q.id]: false });
                  setPicked({ ...picked, [q.id]: [] });
                }}
              >
                Try again
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={!picked[q.id]?.length}
                onClick={() => setRevealed({ ...revealed, [q.id]: true })}
              >
                Check answer
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
