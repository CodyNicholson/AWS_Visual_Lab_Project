import React from 'react';
import { Empty, Stat } from '../components/common.jsx';
import { Graph, Legend, Timeline } from './kit.jsx';

function Steps({ steps, runKey }) {
  return (
    <ol className="req-steps" key={runKey}>
      {steps.map((s, i) => <li key={i} className="pop-in" style={{ animationDelay: `${i * 180}ms` }}>{s}</li>)}
    </ol>
  );
}

export function CloudFrontVisual({ result }) {
  if (!result) return <Empty>Enter a path and press “Request the page”.</Empty>;
  const { status, steps, headers, via, bucket, path, key } = result.data;
  const direct = via !== 'CloudFront';
  const ok = status === 200;
  const nodes = direct
    ? [
        { id: 'v', x: 90, y: 60, label: 'Viewer', sub: path.slice(0, 18), tone: 'accent' },
        { id: 's3', x: 540, y: 60, label: 'S3 bucket', sub: bucket.split(' (')[0], tone: ok ? 'bad' : 'ok' },
      ]
    : [
        { id: 'v', x: 80, y: 60, label: 'Viewer', sub: 'HTTPS', tone: 'accent' },
        { id: 'cf', x: 250, y: 60, label: 'CloudFront', sub: 'IndexRewrite', tone: 'store' },
        { id: 's3', x: 420, y: 60, label: 'S3 (private)', sub: 'OAC only', tone: 'store' },
        { id: 'obj', x: 570, y: 60, label: ok ? 'object' : '404.html', sub: (key || '').split('/').slice(-2).join('/'), tone: ok ? 'ok' : 'warn' },
      ];
  const edges = direct
    ? [{ from: 'v', to: 's3', animated: true, tone: ok ? 'bad' : 'ok', label: ok ? '200: bypassed CloudFront' : '403 AccessDenied' }]
    : [
        { from: 'v', to: 'cf', animated: true, tone: 'accent' },
        { from: 'cf', to: 's3', animated: true, tone: 'store', label: 'SigV4 (OAC)' },
        { from: 's3', to: 'obj', tone: ok ? 'ok' : 'warn', label: ok ? '200' : '403 → 404' },
      ];
  return (
    <div>
      <div className={`verdict pop-in ${ok && !direct ? 'verdict-ok' : ok ? 'verdict-bad' : direct ? 'verdict-ok' : 'verdict-warn'}`}>HTTP {status} for {path}</div>
      <Graph runKey={result.receivedAt} nodes={nodes} edges={edges} height={120} />
      <Steps steps={steps} runKey={result.receivedAt} />
      {Object.keys(headers).length > 0 && (
        <div className="headers">
          {Object.entries(headers).map(([k, v]) => <code key={k} className="chip chip-code">{k}: {v}</code>)}
        </div>
      )}
    </div>
  );
}

export function OidcVisual({ result }) {
  if (!result) return <Empty>Pick what is running and press “Request credentials”.</Empty>;
  const { claims, results, looseTrust } = result.data;
  return (
    <div>
      <div className="token pop-in">
        <span className="muted">OIDC token</span>
        {Object.entries(claims).map(([k, v]) => <div key={k}><code>{k}</code> <b>{v}</b></div>)}
      </div>
      <div className="roles">
        {results.map((r, i) => {
          const [op, cond] = Object.entries(r.condition)[0];
          return (
            <div key={r.name} className={`role pop-in ${r.ok ? 'role-ok' : 'role-bad'}`} style={{ animationDelay: `${300 + i * 200}ms` }}>
              <b>{r.ok ? '✓' : '✗'} {r.name}</b>
              <code>{op} sub = {cond.sub}</code>
              {r.ok ? <ul>{r.can.map((c) => <li key={c}>{c}</li>)}</ul> : <span className="bad">{r.error}</span>}
            </div>
          );
        })}
      </div>
      {looseTrust && <p className="hint bad">The deploy role above trusts repo:* — any repository on GitHub can push to your bucket.</p>}
    </div>
  );
}

export function DeployCacheVisual({ result }) {
  if (!result) return <Empty>Press “Replay a deploy”.</Empty>;
  const { rules, tabAge, keepOld, chunk, maxAge, staleUntil } = result.data;
  const events = [
    { t: 0, label: `tab opened (HTML v1)`, tone: 'accent' },
    { t: tabAge, label: 'deploy v2 + invalidate /*', tone: 'store' },
    { t: tabAge + 1, label: `tab loads practice.v1.js → ${chunk}`, tone: chunk === 200 ? 'ok' : 'bad' },
    { t: tabAge + Math.max(1, Math.round(staleUntil)), label: 'cached HTML revalidates → v2', tone: 'ok' },
  ];
  return (
    <div>
      <Timeline runKey={result.receivedAt} events={events} unit="m" />
      <div className="bucket">
        <div className="bucket-col">
          <h4>_astro/ (Cache-Control: {rules.assets})</h4>
          <span className={`msg ${keepOld ? 'msg-ok' : 'msg-gone'}`}>practice.v1.js {keepOld ? '' : '(deleted)'}</span>
          <span className="msg msg-ok pop-in">practice.v2.js (new)</span>
        </div>
        <div className="bucket-col">
          <h4>pages (Cache-Control: {rules.pages})</h4>
          <span className="msg msg-ok pop-in">concepts/…/lambda/index.html (v2)</span>
        </div>
      </div>
      <div className="stat-row">
        <Stat label="open tab" value={chunk === 200 ? 'keeps working' : 'broken island'} tone={chunk === 200 ? 'ok' : 'bad'} />
        <Stat label="pages max-age" value={`${maxAge} s`} />
        <Stat label="invalidation" value={rules.invalidation} />
      </div>
    </div>
  );
}

export function BudgetVisual({ result }) {
  if (!result) return <Empty>Press “Play the month”.</Empty>;
  const { days, fired, amount, total } = result.data;
  const max = Math.max(amount * 1.2, ...days.map((d) => Math.min(d.forecast, amount * 3)), total);
  const W = 600;
  const H = 180;
  const x = (day) => 30 + ((day - 1) / 29) * (W - 40);
  const y = (v) => H - 20 - (Math.min(v, max) / max) * (H - 40);
  const line = (key) => days.map((d, i) => `${i ? 'L' : 'M'} ${x(d.day)} ${y(d[key])}`).join(' ');
  return (
    <div>
      <svg className="budget-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spend and forecast against the budget" key={result.receivedAt}>
        <line x1="30" x2={W - 10} y1={y(amount)} y2={y(amount)} className="budget-line" />
        <text x="34" y={y(amount) - 6} className="axis-text">budget ${amount}</text>
        <line x1="30" x2={W - 10} y1={y(amount / 2)} y2={y(amount / 2)} className="grid-line" />
        <path d={line('forecast')} className="budget-forecast draw" />
        <path d={line('total')} className="budget-actual draw" />
        {Object.entries(fired).map(([k, day], i) => (
          <g key={k} className="pop-in" style={{ animationDelay: `${600 + i * 200}ms` }}>
            <line x1={x(day)} x2={x(day)} y1="12" y2={H - 20} className="budget-alarm" />
            <text x={x(day) + 4} y={20 + i * 14} className="axis-text">✉ day {day}: {k}</text>
          </g>
        ))}
        {[1, 10, 20, 30].map((d) => <text key={d} x={x(d)} y={H - 4} textAnchor={d === 30 ? 'end' : d === 1 ? 'start' : 'middle'} className="axis-text">day {d}</text>)}
      </svg>
      <Legend items={[{ color: 'var(--accent)', label: 'actual (cumulative)' }, { color: 'var(--api)', label: 'forecast (linear)' }, { color: 'var(--bad)', label: 'alarm email' }]} />
      <div className="stat-row">
        <Stat label="month total" value={`$${total}`} tone={total > amount ? 'bad' : 'ok'} />
        <Stat label="alarms fired" value={Object.keys(fired).length} />
      </div>
    </div>
  );
}
