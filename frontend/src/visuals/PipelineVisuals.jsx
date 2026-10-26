import React from 'react';
import { Empty, Stat } from '../components/common.jsx';
import { Graph, Ring } from './kit.jsx';

export function TemplateVisual({ result }) {
  if (!result) return <Empty>Press “Check the page” to run the template rules on lambda.mdx.</Empty>;
  const { headings, expected, problems, mistakes } = result.data;
  const errors = problems.filter((p) => p.level === 'error');
  return (
    <div>
      <div className="blocks" key={result.receivedAt}>
        <div className="block block-ok pop-in"><b>1</b> Header (frontmatter)</div>
        {expected.map((h, i) => {
          const found = headings[i];
          const ok = found === h;
          return (
            <div key={h} className={`block pop-in ${ok ? 'block-ok' : 'block-bad'}`} style={{ animationDelay: `${(i + 1) * 90}ms` }}>
              <b>{i + 2}</b> {h}
              {!ok && <span className="block-found">found: {found || '(missing)'}</span>}
            </div>
          );
        })}
      </div>
      <div className="stat-row">
        <Stat label="errors" value={errors.length} tone={errors.length ? 'bad' : 'ok'} />
        <Stat label="common mistakes" value={mistakes} tone={mistakes >= 5 && mistakes <= 8 ? 'ok' : 'bad'} hint="5–8 required" />
        <Stat label="exit code" value={errors.length ? 1 : 0} tone={errors.length ? 'bad' : 'ok'} />
      </div>
      {problems.length > 0 && (
        <pre className="terminal">{problems.map((p, i) => <div key={i} className="terminal-line" style={{ animationDelay: `${i * 60}ms` }}><span className={p.level === 'error' ? 'bad' : 'warn-text'}>{p.level}</span> {p.message}</div>)}</pre>
      )}
    </div>
  );
}

export function QuestionPolicyVisual({ result }) {
  if (!result) return <Empty>Press “Check the bank”.</Empty>;
  const { report, shuffle } = result.data;
  return (
    <div>
      <div className="policy-grid" key={result.receivedAt}>
        {report.map((r, i) => (
          <div key={r.id} className={`policy-card pop-in ${r.problems.length ? 'policy-bad' : 'policy-ok'}`} style={{ animationDelay: `${i * 70}ms` }}>
            <b>{r.problems.length ? '✗' : '✓'} {r.id}</b><span className="muted">{r.type}</span>
            {r.problems.map((p) => <span key={p} className="bad policy-problem">{p}</span>)}
          </div>
        ))}
      </div>
      {shuffle && (
        <div className="two-col">
          <div><h4>As written</h4><ol className="plain-list">{shuffle.before.map((o) => <li key={o}>{o}</li>)}</ol></div>
          <div><h4>After the practice exam shuffles</h4><ol className="plain-list">{shuffle.after.map((o) => <li key={o} className={o.startsWith('A.') ? 'bad' : ''}>{o}</li>)}</ol><p className="hint">“Option A is the main fix” now points at <b>{shuffle.optionAAfter}</b>.</p></div>
        </div>
      )}
    </div>
  );
}

export function FreshnessVisual({ result }) {
  if (!result) return <Empty>Press “Check freshness”.</Empty>;
  const { pages, now, max } = result.data;
  return (
    <div>
      <p className="muted">As of {now}</p>
      <div className="ring-row">
        {pages.map((p) => (
          <Ring key={p.file} runKey={`${result.receivedAt}-${p.file}`} pct={Math.max(0, p.daysLeft) / max} color={p.age < 0 ? 'var(--bad)' : p.stale ? 'var(--bad)' : p.daysLeft < 21 ? 'var(--warn)' : 'var(--ok)'}
            label={p.age < 0 ? 'future' : p.stale ? 'stale' : `${p.daysLeft}d`} sub={`${p.title} · verified ${p.verified}${p.stale ? ' · Needs review' : ''}`} />
        ))}
      </div>
    </div>
  );
}

export function ExamDiffVisual({ result }) {
  if (!result) return <Empty>Pick a change and press “Diff the guide”.</Empty>;
  const { diff, before, after, raw } = result.data;
  return (
    <div>
      <div className="two-col">
        <div><h4>snapshot{raw ? ' (raw HTML)' : ' (toText)'}</h4><pre className="code diff-pane">{before}</pre></div>
        <div><h4>this week</h4><pre className="code diff-pane">{after}</pre></div>
      </div>
      <pre className="terminal" key={result.receivedAt}>
        {diff.removed.map((l, i) => <div key={`r${i}`} className="terminal-line bad">- {l}</div>)}
        {diff.added.map((l, i) => <div key={`a${i}`} className="terminal-line ok">+ {l}</div>)}
        {!diff.added.length && !diff.removed.length && <div className="terminal-line muted">no changes → no pull request</div>}
      </pre>
      <div className="stat-row">
        <Stat label="lines added / removed" value={`${diff.added.length} / ${diff.removed.length}`} tone={diff.added.length + diff.removed.length ? 'warn' : 'ok'} />
        <Stat label="pull request" value={diff.added.length + diff.removed.length ? 'opened' : 'none'} />
      </div>
    </div>
  );
}

export function CiVisual({ result }) {
  if (!result) return <Empty>Press “Replay the CI run”.</Empty>;
  const { jobs, status, waves, keyWorkflow } = result.data;
  const pos = {};
  const tallest = Math.max(...waves.map((w) => w.length));
  waves.forEach((w, wi) => w.forEach((id, i) => {
    // Each wave is a column; shorter columns are centred against the tallest
    pos[id] = { x: 90 + wi * (460 / Math.max(1, waves.length - 1)), y: 30 + (i + (tallest - w.length) / 2) * 56 };
  }));
  const tone = (s) => (s === 'success' ? 'ok' : s === 'failure' ? 'bad' : 'muted');
  const nodes = jobs.map((j) => ({ id: j.id, ...pos[j.id], label: j.id, sub: status[j.id], tone: tone(status[j.id]) }));
  const edges = jobs.flatMap((j) => j.needs.map((n) => ({ from: n, to: j.id, animated: status[n] === 'success', tone: tone(status[j.id]), label: 'needs' })));
  const height = Math.max(...nodes.map((n) => n.y)) + 40;
  return (
    <div>
      <Graph runKey={result.receivedAt} nodes={nodes} edges={edges} height={height} />
      <div className="stat-row">
        {['success', 'failure', 'skipped'].map((s) => <Stat key={s} label={s} value={Object.values(status).filter((x) => x === s).length} tone={tone(s)} />)}
      </div>
      {keyWorkflow && <><h4>Flagged workflow</h4><pre className="code">{keyWorkflow}</pre></>}
    </div>
  );
}
