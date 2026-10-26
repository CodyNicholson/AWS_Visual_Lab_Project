import React, { useState } from 'react';
import { Bar, Empty, Stat } from '../components/common.jsx';
import { Cells, Donut, Legend, Ring, Timeline } from './kit.jsx';
import { isCorrect, correctIds } from '../kb/repo.js';

const DOMAIN_COLORS = ['var(--n-lambda)', 'var(--n-iam)', 'var(--n-sqs)', 'var(--n-cw)', 'var(--n-ddb)'];

export function BlueprintVisual({ result }) {
  if (!result) return <Empty>Press “Build the study plan” to read the blueprint from objectives.yaml.</Empty>;
  const { rows, hours, useOldWeights } = result.data;
  return (
    <div>
      <div className="donut-pair">
        <figure>
          <Donut runKey={result.receivedAt} segments={rows.map((r, i) => ({ value: r.weight, color: DOMAIN_COLORS[i], label: `D${r.number} ${r.weight}%` }))} label="DVA-C03" sub="2026" />
          <figcaption>Current</figcaption>
        </figure>
        <figure>
          <Donut runKey={result.receivedAt} size={120} thickness={16} segments={rows.map((r, i) => ({ value: r.oldWeight, color: DOMAIN_COLORS[i], label: `D${r.number} ${r.oldWeight}%` }))} label="DVA-C02" sub="retiring" />
          <figcaption>Old</figcaption>
        </figure>
        <Legend items={rows.map((r, i) => ({ color: DOMAIN_COLORS[i], label: `D${r.number} ${r.name}` }))} />
      </div>
      <h4>{hours} study hours by weight{useOldWeights ? ' (old weights shown as the marker)' : ''}</h4>
      {rows.map((r, i) => (
        <Bar key={r.number} label={`D${r.number} · ${r.weight}%`} value={useOldWeights ? r.oldHours : r.hours} max={hours * 0.35} tone={r.delta > 0 ? 'ok' : r.delta < 0 ? 'warn' : 'accent'}
          text={`${useOldWeights ? r.oldHours : r.hours} h · ≈${r.scoredQuestions} Qs ${r.delta ? `(${r.delta > 0 ? '+' : ''}${r.delta} pts)` : ''}`}
          marker={useOldWeights ? r.hours : r.oldHours} markerLabel={useOldWeights ? 'DVA-C03 hours' : 'DVA-C02 hours'} />
      ))}
      <div className="change-grid">
        {rows.map((r, i) => (
          <div key={r.number} className="change-card pop-in" style={{ animationDelay: `${i * 90}ms`, borderColor: DOMAIN_COLORS[i] }}>
            <b>D{r.number} {r.name}</b>
            {r.oldName !== r.name && <span className="chip chip-miss">renamed from “{r.oldName}”</span>}
            <p className="muted">{r.whatsNew}</p>
            <div className="chips">{r.services.map((s) => <span key={s} className="chip chip-soft">{s}</span>)}</div>
          </div>
        ))}
      </div>
      <p className="hint">objectives.yaml status: <b>{result.data.status}</b>. {result.data.statusNote}</p>
    </div>
  );
}

export function DatesVisual({ result }) {
  if (!result) return <Empty>Pick your exam day and press “Check my exam day”.</Empty>;
  const { milestones, examDate, version, today } = result.data;
  const start = new Date('2026-10-01T00:00:00Z').getTime();
  const all = [...milestones.map((m) => ({ ...m })), { label: 'today', date: today, today: true }, { label: 'your exam', date: examDate, exam: true }];
  const end = Math.max(...all.map((m) => new Date(`${m.date}T00:00:00Z`).getTime())) + 6 * 864e5;
  const pos = (d) => ((new Date(`${d}T00:00:00Z`).getTime() - start) / (end - start)) * 100;
  return (
    <div>
      <div className="date-track">
        <div className="date-band date-c02" style={{ left: 0, width: `${pos(milestones[1].date)}%` }}>DVA-C02</div>
        <div className="date-band date-c03" style={{ left: `${pos(milestones[2].date)}%`, right: 0 }}>DVA-C03</div>
        {all.map((m, i) => (
          <div key={m.label} className={`date-pin pop-in ${m.today ? 'date-today' : ''} ${m.exam ? 'date-exam' : ''} ${i % 2 ? 'date-low' : ''} ${pos(m.date) > 55 ? 'date-right' : ''}`} style={{ left: `${Math.max(0, Math.min(100, pos(m.date)))}%`, animationDelay: `${i * 160}ms` }}>
            <span className="date-dot" />
            <span className="date-label"><b>{m.date}</b> {m.label}</span>
          </div>
        ))}
      </div>
      <div className="stat-row">
        <Stat label="you would sit" value={version} tone={version === 'DVA-C03' ? 'accent' : 'warn'} />
        {milestones.map((m) => <Stat key={m.date} label={m.label.split(';')[0]} value={m.days >= 0 ? `${m.days} days` : `${-m.days} days ago`} />)}
      </div>
    </div>
  );
}

export function FormatVisual({ result }) {
  if (!result) return <Empty>Press “Plan my pacing” to lay out the 65 questions.</Empty>;
  const { format, perQuestion, pace, checkpoints, grid, skipped, lostScored, unscored } = result.data;
  return (
    <div>
      <div className="stat-row">
        <Stat label="minutes" value={format.duration_minutes} />
        <Stat label="questions (scored)" value={`${format.questions_total} (${format.questions_scored})`} />
        <Stat label="min / question" value={perQuestion} tone="accent" />
        <Stat label="with review time" value={`${pace} min`} />
        <Stat label="passing score" value={`${format.passing_score} / ${format.score_scale[1]}`} tone="ok" />
        {skipped > 0 && <Stat label="scored questions left blank" value={lostScored} tone="bad" />}
      </div>
      <h4>65 questions: {unscored} unscored (hatched here, unmarked on the exam){skipped ? `; ${skipped} skipped` : ''}</h4>
      <Cells columns={13} cells={grid.map((q) => ({ key: q.n, text: q.n, tone: q.skipped ? (q.unscored ? 'warn' : 'bad') : q.unscored ? 'hatch' : 'ok', title: `${q.unscored ? 'unscored' : 'scored'}${q.skipped ? ', skipped' : ''}` }))} />
      <Legend items={[{ color: 'var(--ok)', label: 'scored, answered' }, { color: 'var(--muted)', label: 'unscored' }, { color: 'var(--bad)', label: 'scored, left blank' }, { color: 'var(--warn)', label: 'unscored, left blank' }]} />
      <h4>Checkpoints</h4>
      <div className="checkpoints">
        {checkpoints.map((c, i) => (
          <div key={c.question} className="checkpoint pop-in" style={{ animationDelay: `${i * 120}ms` }}><b>Q{c.question}</b><span className="muted">by minute {c.minute}</span></div>
        ))}
      </div>
    </div>
  );
}

export function CertificationsVisual({ result }) {
  if (!result) return <Empty>Pick a topic and press “Which exam covers it?”.</Empty>;
  const { certifications, aip, topic, topics } = result.data;
  const levels = ['Foundational', 'Associate', 'Professional'];
  return (
    <div>
      <div className={`verdict pop-in ${topic.dva ? 'verdict-ok' : 'verdict-warn'}`}>
        <b>{topic.topic}</b> → {topic.exam} {topic.dva ? '(in scope for DVA-C03)' : '(out of scope for DVA-C03)'}
      </div>
      <div className="cert-ladder">
        {levels.map((lvl) => (
          <div key={lvl} className="cert-level">
            <h4>{lvl}</h4>
            {certifications.filter((c) => c.level === lvl).map((c, i) => (
              <div key={c.code} className={`cert pop-in cert-${c.depth.toLowerCase()} ${topic.exam === c.code ? 'cert-hit' : ''}`} style={{ animationDelay: `${i * 80}ms` }}>
                <b>{c.code}</b><span>{c.name}</span><span className="muted">{c.depth}: {c.role}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="cert-level">
          <h4>Retiring</h4>
          {certifications.filter((c) => !levels.includes(c.level)).map((c) => (
            <div key={c.code} className="cert cert-archive pop-in"><b>{c.code}</b><span>{c.name}</span><span className="muted">{c.level}</span></div>
          ))}
        </div>
      </div>
      <div className="donut-pair">
        <Donut runKey={result.receivedAt} segments={aip.map((d, i) => ({ value: d.weight, color: DOMAIN_COLORS[i], label: `${d.name} ${d.weight}%` }))} label="AIP-C01" sub="5 domains" />
        <Legend items={aip.map((d, i) => ({ color: DOMAIN_COLORS[i], label: `${d.weight}% ${d.name}` }))} />
      </div>
      <h4>Topic scope</h4>
      <div className="chips">{topics.map((t) => <span key={t.topic} className={`chip ${t.dva ? 'chip-hit' : 'chip-miss'}`}>{t.topic} · {t.exam}</span>)}</div>
    </div>
  );
}

function QuestionCard({ q, index }) {
  const [picked, setPicked] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const want = correctIds(q).length;
  const toggle = (id) => {
    if (revealed) return;
    setPicked((p) => (q.type === 'single' ? [id] : p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const right = revealed && isCorrect(q, picked);
  return (
    <li className="quiz-card pop-in" style={{ animationDelay: `${index * 90}ms` }}>
      <div className="quiz-meta"><span className="chip chip-soft">{q.id}</span>{q.exam_domains.map((d) => <span key={d} className="chip">{d}</span>)}<span className="muted">{q.type === 'multiple' ? `choose ${want}` : 'choose 1'} · {q.difficulty}</span></div>
      <p className="quiz-stem">{q.stem}</p>
      <ul className="quiz-options">
        {q.options.map((o) => {
          const chosen = picked.includes(o.id);
          const state = !revealed ? (chosen ? 'chosen' : '') : o.correct ? 'correct' : chosen ? 'wrong' : 'other';
          return (
            <li key={o.id}>
              <button type="button" className={`quiz-option quiz-${state}`} onClick={() => toggle(o.id)} aria-pressed={chosen}>
                <b>{o.id.toUpperCase()}.</b> {o.text}
              </button>
              {revealed && <p className={`quiz-why ${o.correct ? 'ok' : 'muted'}`}>{o.correct ? 'Correct. ' : 'Incorrect. '}{o.why}</p>}
            </li>
          );
        })}
      </ul>
      <div className="actions">
        {!revealed ? (
          <button type="button" className="btn btn-small btn-accent" disabled={!picked.length} onClick={() => setRevealed(true)}>Check</button>
        ) : (
          <>
            <span className={right ? 'ok' : 'bad'}>{right ? '✓ You got it.' : `✗ Not quite: ${correctIds(q).join(', ').toUpperCase()}.`}</span>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => { setPicked([]); setRevealed(false); }}>Try again</button>
          </>
        )}
      </div>
      {revealed && <p className="hint">{q.explanation} <a href={q.sources[0]?.url} target="_blank" rel="noreferrer">{q.sources[0]?.title}</a></p>}
    </li>
  );
}

export function PracticeVisual({ result }) {
  if (!result) return <Empty>Press “Build a deck”, then answer the questions here.</Empty>;
  return (
    <div>
      <div className="stat-row">
        <Stat label="in this deck" value={result.data.deck.length} tone="accent" />
        <Stat label="in the bank" value={result.data.total} />
        <Stat label="domain filter" value={result.data.domain} />
      </div>
      <ol className="quiz-list" key={result.receivedAt}>
        {result.data.deck.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />)}
      </ol>
    </div>
  );
}

export function CoverageVisual({ result }) {
  if (!result) return <Empty>Press “Compute coverage” to run the site’s computeCoverage().</Empty>;
  const { real, sim, perTask, minQuestions } = result.data;
  const shown = sim || real;
  return (
    <div>
      <div className="ring-row">
        <Ring runKey={result.receivedAt} pct={real.percent == null ? 0 : real.percent / 100} label={real.percent == null ? 'n/a' : `${real.percent}%`} sub="real coverage (no tasks loaded yet)" color="var(--muted)" />
        {sim && <Ring runKey={result.receivedAt} pct={sim.percent / 100} label={`${sim.percent}%`} sub={`hypothetical: ${sim.coveredTasks}/${sim.taskCount} tasks`} color={sim.percent === 100 ? 'var(--ok)' : 'var(--bad)'} />}
      </div>
      <h4>Per domain{sim ? ' (with the hypothetical tasks)' : ''}</h4>
      {shown.domains.map((d) => (
        <div key={d.id} className="cov-domain">
          <div className="cov-head"><b>D{d.number} {d.name}</b><span className="muted">{d.weight}% · {d.pages.length} page · {d.questions.length} questions</span></div>
          {d.tasks.length ? (
            <div className="cov-tasks">
              {d.tasks.map((t, i) => (
                <div key={t.id} className={`cov-task pop-in ${t.covered ? 'cov-ok' : 'cov-bad'}`} style={{ animationDelay: `${i * 90}ms` }}>
                  <code>{t.id}</code>
                  <span>{t.pages.length} page{t.pages.length === 1 ? '' : 's'}</span>
                  <Bar label="questions" value={t.questions.length} max={Math.max(minQuestions, perTask)} marker={minQuestions} markerLabel={`${minQuestions} needed`} tone={t.covered ? 'ok' : 'bad'} text={`${t.questions.length}/${minQuestions}`} />
                </div>
              ))}
            </div>
          ) : <p className="muted">No task statements loaded for this domain.</p>}
        </div>
      ))}
    </div>
  );
}
