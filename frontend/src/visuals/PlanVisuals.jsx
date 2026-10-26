import React from 'react';
import { Bar, Empty, Stat } from '../components/common.jsx';
import { Graph } from './kit.jsx';

export function ConceptMapVisual({ result }) {
  if (!result) return <Empty>Press “Draw the map”.</Empty>;
  const { grid, domain, live, total, decisionGuides } = result.data;
  return (
    <div>
      <div className="stat-row">
        <Stat label="planned pages" value={total} />
        <Stat label="live" value={live.length} tone="ok" />
        <Stat label="coming soon" value={total - live.length} tone="warn" />
      </div>
      <div className="domain-grid" key={result.receivedAt}>
        {grid.filter((g) => domain === 'all' || g.slug === domain).map((g, gi) => (
          <div key={g.slug} className="domain pop-in" style={{ animationDelay: `${gi * 90}ms` }}>
            <h4>{g.title}</h4>
            <div className="chips">{g.examTags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
            {g.services.map((s) => (
              <div key={s.slug} className={`svc ${s.live ? 'svc-live' : ''} ${s.relatedToLambda ? 'svc-related' : ''}`} title={s.live ? 'live' : 'coming soon'}>
                <span>{s.live ? '●' : '○'} {s.title}</span>
                {s.questions > 0 && <span className="muted">{s.questions} Qs</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="hint">Dashed outline: related to the Lambda page. Decision guides planned: {decisionGuides.join(' · ')}.</p>
    </div>
  );
}

export function CaseStudiesVisual({ result }) {
  if (!result) return <Empty>Pick a case study and press “Show the data path”.</Empty>;
  const { study, studies, structure, written } = result.data;
  const n = study.services.length;
  const nodes = study.services.map((s, i) => ({ id: `s${i}`, x: 70 + (i * 500) / Math.max(1, n - 1), y: i % 2 ? 130 : 60, label: s.length > 16 ? `${s.slice(0, 15)}…` : s, sub: s.length > 16 ? s.slice(15, 31) : '', tone: 'store' }));
  const edges = nodes.slice(1).map((nd, i) => ({ from: nodes[i].id, to: nd.id, animated: true, tone: 'accent' }));
  return (
    <div>
      <div className="verdict pop-in"><b>{study.n}. {study.title}</b> · {study.scenario}</div>
      <Graph runKey={result.receivedAt} nodes={nodes} edges={edges} height={180} />
      <div className="chips">{study.exams.map((e) => <span key={e} className="chip chip-hit">{e}</span>)}</div>
      <div className="case-grid">
        {studies.map((c) => (
          <div key={c.n} className={`case ${c.n === study.n ? 'case-hit' : ''}`}><b>{c.n}. {c.title}</b><span className="muted">{c.exams.join(' · ')}</span></div>
        ))}
      </div>
      <h4>Every case study ({written} of {studies.length} written)</h4>
      <ol className="plain-list">{structure.map((s) => <li key={s}>{s}</li>)}</ol>
    </div>
  );
}

export function RoadmapVisual({ result }) {
  if (!result) return <Empty>Press “Measure progress”.</Empty>;
  const { week, phase, roadmap, progress, targets, criteria } = result.data;
  return (
    <div>
      <div className="roadmap" key={result.receivedAt}>
        {roadmap.map((p) => (
          <div key={p.phase} className={`phase pop-in ${p.phase === phase.phase ? 'phase-now' : ''}`} style={{ flexGrow: p.weeks[1] - p.weeks[0] + 1 }}>
            <b>Phase {p.phase} · {p.name}</b>
            <span className="muted">weeks {p.weeks.join('–')}</span>
            <ul>{p.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
            <span className="phase-gate">Gate: {p.gate}</span>
          </div>
        ))}
        <div className="week-marker" style={{ left: `${((week - 0.5) / 26) * 100}%` }}>week {week}</div>
      </div>
      <h4>Phase 1 targets, measured from the repository</h4>
      <Bar label="concept pages" value={progress.pages} max={targets.pages} text={`${progress.pages} / ${targets.pages}`} />
      <Bar label="practice questions" value={progress.questions} max={targets.questions} text={`${progress.questions} / ${targets.questions}`} />
      <Bar label="case studies" value={progress.caseStudies} max={targets.caseStudies} text={`${progress.caseStudies} / ${targets.caseStudies}`} tone="warn" />
      <Bar label="task statements" value={progress.tasksLoaded} max={1} text={progress.tasksLoaded ? `${progress.tasksLoaded} loaded` : 'waiting for the guide (Oct 27)'} tone="store" />
      <h4>v1 success criteria</h4>
      <ul className="checks">
        {criteria.map((c) => (
          <li key={c.id} className={c.pct >= 1 ? 'check-ok' : 'check-bad'}>
            <span className="check-icon">{c.pct >= 1 ? '✓' : '…'}</span>
            <div>{c.text}<div className="check-detail">{c.value}</div></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
