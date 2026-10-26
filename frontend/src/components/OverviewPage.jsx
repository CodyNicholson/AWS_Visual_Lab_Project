import React from 'react';
import Terminal from './Terminal.jsx';
import CodeBlock from './CodeBlock.jsx';
import { OVERVIEW } from '../demos/guide.js';
import { CATEGORIES, DEMOS } from '../demos/catalog.js';

function List({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <section className={`card list-card list-${tone}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item, i) => <li key={i} style={{ animationDelay: `${i * 70}ms` }}>{item}</li>)}
      </ul>
    </section>
  );
}

/** Landing page: what the KB is, what is in the repo, how to work with it, its strengths and risks, how not to use AWS, and a map of every demo. */
export default function OverviewPage({ onOpen }) {
  return (
    <article className="demo">
      <header className="demo-head">
        <span className="chip">Start here</span>
        <h2>{OVERVIEW.title}</h2>
        <p className="tagline">{OVERVIEW.intro}</p>
      </header>

      <div className="stat-row">
        {OVERVIEW.facts.map(([label, value]) => (
          <div key={label} className="stat"><div className="stat-value stat-text">{value}</div><div className="stat-label">{label}</div></div>
        ))}
      </div>

      <section className="card list-card">
        <h3>The mental model</h3>
        <ul>{OVERVIEW.mentalModel.map((m, i) => <li key={i} style={{ animationDelay: `${i * 70}ms` }}>{m}</li>)}</ul>
      </section>

      <section className="card">
        <h3>Every topic in this lab</h3>
        <div className="feature-map">
          {CATEGORIES.map((category) => (
            <div key={category} className="feature-group">
              <h4>{category}</h4>
              {DEMOS.filter((d) => d.category === category).map((d) => (
                <button key={d.id} type="button" className="feature-link" onClick={() => onOpen(d.id)}>
                  <b>{d.title}</b><span className="muted">{d.tagline}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>What is in the repository</h3>
        <div className="table-wrap">
          <table>
            <tbody>{OVERVIEW.repoLayout.map(([dir, what]) => <tr key={dir}><td><code>{dir}</code></td><td>{what}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Work with it</h3>
        <ol className="guide-steps">
          {OVERVIEW.steps.map((step, i) => (
            <li key={step.title} style={{ animationDelay: `${i * 90}ms` }}>
              <h4>{i + 1}. {step.title}</h4>
              <p>{step.text}</p>
              {step.commands && <Terminal commands={step.commands} />}
              {step.file && <CodeBlock code={step.file.code} name={step.file.name} lang={step.file.lang} />}
            </li>
          ))}
        </ol>
      </section>

      <div className="two-col">
        <List title="Strengths of the approach" items={OVERVIEW.pros} tone="ok" />
        <List title="Risks and trade-offs" items={OVERVIEW.cons} tone="bad" />
        <List title="Use the KB when" items={OVERVIEW.whenToUse} tone="ok" />
        <List title="Look elsewhere when" items={OVERVIEW.whenNotToUse} tone="warn" />
      </div>

      <section className="card list-card list-bad">
        <div className="card-title-row">
          <h3>How not to use AWS</h3>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => onOpen('pitfalls')}>All mistakes & fixes →</button>
        </div>
        <ul>
          {OVERVIEW.antiPatterns.map((a, i) => (
            <li key={a.dont} style={{ animationDelay: `${i * 70}ms` }}><b>{a.dont}</b><span className="muted"> Instead: {a.instead}</span></li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>The site stack (from the plan)</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Layer</th><th>Choice</th><th>Why</th></tr></thead>
            <tbody>{OVERVIEW.siteStack.map(([layer, choice, why]) => <tr key={layer}><td><b>{layer}</b></td><td>{choice}</td><td className="muted">{why}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className="two-col">
        <List title="Gaps the plan's review found" items={OVERVIEW.reviewGaps} tone="warn" />
        <List title="Improvements, in priority order" items={OVERVIEW.improvements} tone="ok" />
      </div>

      <section className="card">
        <h3>Alternatives</h3>
        <table>
          <tbody>{OVERVIEW.alternatives.map(([name, diff]) => <tr key={name}><td><b>{name}</b></td><td>{diff}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="card list-card">
        <h3>Sources</h3>
        <ul>{OVERVIEW.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
      </section>
    </article>
  );
}
