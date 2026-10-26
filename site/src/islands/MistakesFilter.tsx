import { useMemo, useState } from 'react';

export interface MistakeRow {
  service: string;
  serviceTitle: string;
  href: string;
  mistake: string;
  symptom: string;
  why: string;
  fix: string;
  severity: 'high' | 'medium' | 'low';
  errors: string[];
  source: { title: string; url: string };
}

const SEVERITIES = ['high', 'medium', 'low'] as const;

export default function MistakesFilter({ rows }: { rows: MistakeRow[] }) {
  const services = useMemo(() => [...new Map(rows.map((r) => [r.service, r.serviceTitle])).entries()], [rows]);
  const [service, setService] = useState('');
  const [severity, setSeverity] = useState<string[]>([...SEVERITIES]);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!service || r.service === service) &&
      severity.includes(r.severity) &&
      (!q || [r.mistake, r.symptom, r.why, r.fix, ...r.errors].some((t) => t.toLowerCase().includes(q))),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <label className="flex flex-col text-sm">
          <span className="font-semibold">Search, or paste an error message</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Task timed out after 3.00 seconds"
            className="mt-1 w-72 max-w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-semibold">Service</span>
          <select value={service} onChange={(e) => setService(e.target.value)} className="mt-1 rounded-md border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700">
            <option value="">All services</option>
            {services.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="font-semibold">Severity</legend>
          <div className="mt-1 flex gap-3">
            {SEVERITIES.map((s) => (
              <label key={s} className="flex gap-1 capitalize">
                <input
                  type="checkbox"
                  className="accent-orange-600"
                  checked={severity.includes(s)}
                  onChange={() => setSeverity(severity.includes(s) ? severity.filter((x) => x !== s) : [...severity, s])}
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400" role="status">
        Showing {shown.length} of {rows.length} mistakes
      </p>
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.service + r.mistake} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a href={r.href} className="font-semibold text-brand-700 underline dark:text-brand-300">
                {r.serviceTitle}
              </a>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 uppercase dark:bg-slate-800">{r.severity}</span>
            </div>
            <h3 className="mt-1 font-semibold">{r.mistake}</h3>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-medium text-slate-500">Symptom</dt>
                <dd>
                  {r.symptom}
                  {r.errors.map((e) => (
                    <code key={e} className="mt-1 block break-words rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-ink-800">
                      {e}
                    </code>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Why</dt>
                <dd>{r.why}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Fix</dt>
                <dd>
                  {r.fix}{' '}
                  <a className="underline" href={r.source.url}>
                    Source
                  </a>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
