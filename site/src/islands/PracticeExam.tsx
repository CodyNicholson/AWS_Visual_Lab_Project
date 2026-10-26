import { useEffect, useMemo, useState } from 'react';
import QuestionCard from './QuestionCard';
import { isCorrect, shuffle, type QuizQuestion } from './types';

interface ExamInfo {
  code: string;
  durationMinutes: number;
  questionsTotal: number;
  domains: { id: string; number: number; name: string; weight: number }[];
}

type Mode = 'study' | 'timed';
type Phase = 'setup' | 'running' | 'results';

const btn = 'rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700';
const primary = 'rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50';

export default function PracticeExam({ exam, questions }: { exam: ExamInfo; questions: QuizQuestion[] }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<Mode>('study');
  const [domains, setDomains] = useState<string[]>(exam.domains.map((d) => d.id));
  const [count, setCount] = useState(Math.min(10, questions.length));
  const [deck, setDeck] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);

  const pool = useMemo(() => questions.filter((q) => q.exam_domains.some((d) => domains.includes(d))), [questions, domains]);
  const secondsPerQuestion = (exam.durationMinutes * 60) / exam.questionsTotal;
  const n = Math.min(count, pool.length);

  useEffect(() => {
    if (phase !== 'running' || mode !== 'timed') return;
    if (secondsLeft <= 0) {
      setPhase('results');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, mode, secondsLeft]);

  const start = () => {
    const picked = shuffle(pool).slice(0, n).map((q) => ({ ...q, options: shuffle(q.options) }));
    // Re-letter shuffled options so "A" is always first on screen.
    const relettered = picked.map((q) => ({
      ...q,
      options: q.options.map((o, i) => ({ ...o, id: String.fromCharCode(97 + i) })),
    }));
    setDeck(relettered);
    setIndex(0);
    setAnswers({});
    setChecked({});
    setFlagged({});
    setSecondsLeft(Math.round(n * secondsPerQuestion));
    setPhase('running');
  };

  if (phase === 'setup') {
    return (
      <div className="space-y-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <fieldset>
          <legend className="font-semibold">Mode</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex gap-2">
              <input type="radio" name="mode" checked={mode === 'study'} onChange={() => setMode('study')} className="accent-orange-600" />
              Study: check each answer as you go
            </label>
            <label className="flex gap-2">
              <input type="radio" name="mode" checked={mode === 'timed'} onChange={() => setMode('timed')} className="accent-orange-600" />
              Timed: real exam pace ({Math.round(secondsPerQuestion / 60)} min per question), results at the end
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend className="font-semibold">Domains</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {exam.domains.map((d) => (
              <label key={d.id} className="flex gap-2">
                <input
                  type="checkbox"
                  className="accent-orange-600"
                  checked={domains.includes(d.id)}
                  onChange={() => setDomains(domains.includes(d.id) ? domains.filter((x) => x !== d.id) : [...domains, d.id])}
                />
                Domain {d.number}: {d.name} ({d.weight}%)
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="font-semibold">Questions</span>
          <input
            type="number"
            min={1}
            max={pool.length || 1}
            value={n}
            onChange={(e) => setCount(Number(e.target.value))}
            className="ml-3 w-20 rounded-md border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          />
          <span className="ml-2 text-sm text-slate-500">
            of {pool.length} available. The real exam has {exam.questionsTotal} questions in {exam.durationMinutes} minutes.
          </span>
        </label>
        <button type="button" className={primary} disabled={n < 1} onClick={start}>
          Start
        </button>
      </div>
    );
  }

  if (phase === 'results') {
    const correct = deck.filter((q) => isCorrect(q, answers[q.id] ?? [])).length;
    const byDomain = exam.domains
      .map((d) => {
        const qs = deck.filter((q) => q.exam_domains.includes(d.id));
        return { ...d, total: qs.length, right: qs.filter((q) => isCorrect(q, answers[q.id] ?? [])).length };
      })
      .filter((d) => d.total > 0);
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800" role="status">
          <p className="text-2xl font-semibold">
            {correct} / {deck.length} correct ({Math.round((correct / deck.length) * 100)}%)
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            This is a raw percentage. AWS reports a scaled score from 100 to 1,000, which a raw percentage doesn't convert
            to directly.
          </p>
          <table className="data-table mt-4">
            <thead>
              <tr><th scope="col">Domain</th><th scope="col">Correct</th></tr>
            </thead>
            <tbody>
              {byDomain.map((d) => (
                <tr key={d.id}>
                  <td>Domain {d.number}: {d.name}</td>
                  <td>{d.right} / {d.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className={`${primary} mt-4`} onClick={() => setPhase('setup')}>
            New session
          </button>
        </div>
        <h2 className="text-xl font-semibold">Review</h2>
        <ol className="space-y-4">
          {deck.map((q, i) => (
            <li key={q.id}>
              <QuestionCard question={q} number={i + 1} picked={answers[q.id] ?? []} onPick={() => {}} revealed />
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const q = deck[index];
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const answered = deck.filter((x) => answers[x.id]?.length).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          Question {index + 1} of {deck.length}
        </span>
        <span className="text-slate-500">{answered} answered</span>
        {mode === 'timed' && (
          <span className="ml-auto font-mono text-base" aria-label={`Time left ${mm} minutes ${ss} seconds`}>
            {mm}:{ss}
          </span>
        )}
      </div>
      <QuestionCard
        question={q}
        number={index + 1}
        picked={answers[q.id] ?? []}
        onPick={(ids) => setAnswers({ ...answers, [q.id]: ids })}
        revealed={mode === 'study' && !!checked[q.id]}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous
        </button>
        {mode === 'study' && !checked[q.id] && (
          <button type="button" className={btn} disabled={!answers[q.id]?.length} onClick={() => setChecked({ ...checked, [q.id]: true })}>
            Check answer
          </button>
        )}
        {mode === 'timed' && (
          <button type="button" className={btn} aria-pressed={!!flagged[q.id]} onClick={() => setFlagged({ ...flagged, [q.id]: !flagged[q.id] })}>
            {flagged[q.id] ? 'Unflag' : 'Flag for review'}
          </button>
        )}
        {index < deck.length - 1 ? (
          <button type="button" className={btn} onClick={() => setIndex(index + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className={primary} onClick={() => setPhase('results')}>
            Finish
          </button>
        )}
      </div>
      <nav aria-label="Question palette" className="flex flex-wrap gap-1">
        {deck.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Question ${i + 1}${answers[x.id]?.length ? ', answered' : ''}${flagged[x.id] ? ', flagged' : ''}`}
            className={
              'h-8 w-8 rounded text-xs ' +
              (i === index ? 'ring-2 ring-brand-600 ' : '') +
              (flagged[x.id] ? 'bg-amber-200 text-amber-900 ' : answers[x.id]?.length ? 'bg-slate-300 dark:bg-slate-700 ' : 'border border-slate-300 dark:border-slate-700 ')
            }
          >
            {i + 1}
          </button>
        ))}
      </nav>
    </div>
  );
}
