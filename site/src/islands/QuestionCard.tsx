import { useId } from 'react';
import { correctIds, isCorrect, type QuizQuestion } from './types';

interface Props {
  question: QuizQuestion;
  number: number;
  picked: string[];
  onPick: (ids: string[]) => void;
  /** Show per-option feedback and the explanation. */
  revealed: boolean;
}

export default function QuestionCard({ question: q, number, picked, onPick, revealed }: Props) {
  const name = useId();
  const want = correctIds(q);
  const toggle = (id: string) => {
    if (revealed) return;
    if (q.type === 'single') onPick([id]);
    else onPick(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]);
  };
  const right = revealed && isCorrect(q, picked);

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <legend className="sr-only">Question {number}</legend>
      <p className="mb-3 font-medium">
        <span className="mr-2 text-slate-500">{number}.</span>
        {q.stem}
        {q.type === 'multiple' && <span className="ml-1 text-sm font-normal text-slate-500">(Choose {want.length}.)</span>}
      </p>
      <ul className="space-y-2">
        {q.options.map((o) => {
          const chosen = picked.includes(o.id);
          const state = !revealed ? '' : o.correct ? 'correct' : chosen ? 'wrong' : 'other';
          return (
            <li
              key={o.id}
              className={
                'rounded-md border px-3 py-2 ' +
                (state === 'correct'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                  : state === 'wrong'
                    ? 'border-red-500 bg-red-50 dark:bg-red-500/10'
                    : 'border-slate-200 dark:border-slate-800')
              }
            >
              <label className="flex cursor-pointer gap-3">
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  name={name}
                  value={o.id}
                  checked={chosen}
                  disabled={revealed}
                  onChange={() => toggle(o.id)}
                  className="mt-1 accent-orange-600"
                />
                <span>
                  {o.text}
                  {revealed && (
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                      <strong>{o.correct ? 'Correct. ' : 'Incorrect. '}</strong>
                      {o.why}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {revealed && (
        <div className="mt-3 text-sm" role="status">
          <p className={right ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-semibold text-red-700 dark:text-red-300'}>
            {right ? 'You got it.' : `Not quite. Correct answer: ${want.join(', ').toUpperCase()}.`}
          </p>
          <p className="mt-1">{q.explanation}</p>
          <p className="mt-1 text-slate-500">
            Source:{' '}
            {q.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ', '}
                <a className="underline" href={s.url}>
                  {s.title}
                </a>
              </span>
            ))}
          </p>
        </div>
      )}
    </fieldset>
  );
}
