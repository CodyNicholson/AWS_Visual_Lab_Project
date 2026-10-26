import React from 'react';
import { Empty, Stat } from '../components/common.jsx';
import { Graph, Legend } from './kit.jsx';

export function BatchVisual({ result }) {
  if (!result) return <Empty>Press “Process the batch” to run the order worker’s handler against the queue.</Empty>;
  const { rounds, dlq, rows, goodCount, goodRedeliveries, partial, maxReceiveCount } = result.data;
  return (
    <div>
      <div className="stat-row">
        <Stat label="partial batch responses" value={partial ? 'on' : 'off'} tone={partial ? 'ok' : 'bad'} />
        <Stat label="orders stored" value={`${rows} / ${goodCount}`} tone={rows === goodCount ? 'ok' : 'bad'} />
        <Stat label="extra deliveries of good messages" value={goodRedeliveries} tone={goodRedeliveries ? 'bad' : 'ok'} />
        <Stat label="in the DLQ" value={dlq.length} tone={dlq.some((m) => !m.bad) ? 'bad' : 'warn'} />
      </div>
      <div className="rounds" key={result.receivedAt}>
        {rounds.map((r, ri) => (
          <div key={r.round} className="round pop-in" style={{ animationDelay: `${ri * 260}ms` }}>
            <span className="round-label">receive {r.round}</span>
            <div className="msgs">
              {r.batch.map((m) => {
                const tone = r.deleted.includes(m.id) ? 'ok' : m.bad ? 'bad' : r.redriven.includes(m.id) ? 'dlq' : 'warn';
                return <span key={m.id} className={`msg msg-${tone}`} title={`${m.id}: ${m.bad ? 'malformed' : 'valid'}, receive ${m.receive}`}>{m.id}</span>;
              })}
            </div>
            <span className="round-note">{r.threw ? 'threw: whole batch back' : `${r.deleted.length} deleted`}{r.redriven.length ? ` · ${r.redriven.length} → DLQ` : ''}</span>
          </div>
        ))}
      </div>
      <div className="dlq">
        <span className="round-label">DLQ (after {maxReceiveCount} receives)</span>
        <div className="msgs">{dlq.length ? dlq.map((m) => <span key={m.id} className={`msg pop-in ${m.bad ? 'msg-bad' : 'msg-dlq'}`}>{m.id}</span>) : <span className="muted">empty</span>}</div>
      </div>
      <Legend items={[{ color: 'var(--ok)', label: 'deleted (processed)' }, { color: 'var(--warn)', label: 'good, back on the queue' }, { color: 'var(--bad)', label: 'malformed' }, { color: 'var(--api)', label: 'good message moved to the DLQ' }]} />
    </div>
  );
}

export function VisibilityVisual({ result }) {
  if (!result) return <Empty>Press “Play the timeline”.</Empty>;
  const d = result.data;
  if (d.blocked) {
    return (
      <div>
        <div className="verdict verdict-bad pop-in">CreateEventSourceMapping rejected: {d.error}</div>
        <p className="hint">Raise the visibility timeout to at least {d.recommended} s (6 × {d.functionTimeoutS} s).</p>
      </div>
    );
  }
  const max = Math.max(d.visibilityS, d.recommended, ...d.events.map((e) => e.t)) * 1.1;
  return (
    <div>
      <div className="vis-track" key={result.receivedAt}>
        <div className="vis-hidden" style={{ width: `${(d.visibilityS / max) * 100}%` }}>hidden for {d.visibilityS} s</div>
        <div className="vis-recommended" style={{ left: `${Math.min(100, (d.recommended / max) * 100)}%` }} title="6 × function timeout">6× = {d.recommended} s</div>
        {d.events.map((e, i) => (
          <span key={i} className={`vis-mark pop-in vis-${e.tone}`} style={{ left: `${(e.t / max) * 100}%`, animationDelay: `${i * 300}ms` }} title={e.label}>{i + 1}</span>
        ))}
      </div>
      <ol className="vis-events">
        {d.events.map((e, i) => (
          <li key={i} className="pop-in" style={{ animationDelay: `${i * 300}ms` }}><span className={`vis-mark-inline vis-${e.tone}`}>{i + 1}</span><b>t+{e.t} s</b> {e.label}</li>
        ))}
      </ol>
      <div className="stat-row">
        <Stat label="function timeout" value={`${d.functionTimeoutS} s`} />
        <Stat label="visibility timeout" value={`${d.visibilityS} s`} tone={d.visibilityS >= d.recommended ? 'ok' : 'warn'} />
        <Stat label="processing done at" value={`t+${d.done} s`} />
        <Stat label="processed" value={d.reappears ? 'twice' : 'once'} tone={d.reappears ? 'bad' : 'ok'} />
      </div>
    </div>
  );
}

export function IdempotencyVisual({ result }) {
  if (!result) return <Empty>Press “Deliver the order”.</Empty>;
  const { timeline, charges, rows, conditional, validation } = result.data;
  return (
    <div>
      <div className="deliveries" key={result.receivedAt}>
        {timeline.map((t, i) => (
          <div key={t.delivery} className={`delivery pop-in ${t.wrote ? 'delivery-ok' : 'delivery-skip'}`} style={{ animationDelay: `${i * 220}ms` }}>
            <b>delivery {t.delivery}</b>
            <span>{t.wrote ? 'PutItem ✓' : 'ConditionalCheckFailed'}</span>
            <span className={t.charged ? (conditional ? 'ok' : i ? 'bad' : 'ok') : 'muted'}>{t.charged ? '💳 charged' : 'skipped'}</span>
          </div>
        ))}
      </div>
      <div className="stat-row">
        <Stat label="rows in Orders" value={rows} />
        <Stat label="card charges" value={charges} tone={charges > 1 ? 'bad' : 'ok'} />
      </div>
      <h4>parseOrder() on sample bodies</h4>
      <ul className="checks">
        {validation.map((v) => (
          <li key={v.body} className={v.ok ? 'check-ok' : 'check-bad'}>
            <span className="check-icon">{v.ok ? '✓' : '✗'}</span>
            <div><code>{v.body}</code><div className="check-detail">{v.ok ? JSON.stringify(v.order) : v.error}</div></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CdkVisual({ result }) {
  if (!result) return <Empty>Press “Review the stack”.</Empty>;
  const { stack, review } = result.data;
  const r = Object.fromEntries(review.map((x) => [x.rule, x.ok]));
  const tone = (ok) => (ok ? 'ok' : 'bad');
  const nodes = [
    { id: 'q', x: 90, y: 70, label: 'OrdersQueue', sub: `visibility ${stack.visibilityS} s`, tone: tone(r['Visibility timeout ≥ 6× function timeout']) },
    { id: 'dlq', x: 90, y: 180, label: 'OrdersDlq', sub: stack.dlq ? `maxReceive ${stack.maxReceiveCount}` : 'missing', tone: tone(stack.dlq) },
    { id: 'fn', x: 320, y: 70, label: 'OrderWorker', sub: `${stack.timeoutS} s · ${stack.memoryMb} MB`, tone: 'accent' },
    { id: 'logs', x: 320, y: 180, label: 'Log group', sub: stack.logRetention, tone: tone(stack.logRetention !== 'never expire') },
    { id: 'table', x: 550, y: 70, label: 'Orders table', sub: stack.grant.split(' ')[0], tone: tone(stack.grant === 'dynamodb:PutItem') },
    { id: 'xray', x: 550, y: 180, label: 'X-Ray', sub: stack.tracing, tone: tone(stack.tracing === 'ACTIVE') },
  ];
  const edges = [
    { from: 'q', to: 'fn', label: stack.reportBatchItemFailures ? 'batch 10 + ReportBatchItemFailures' : 'batch 10', animated: true, tone: tone(stack.reportBatchItemFailures) },
    { from: 'q', to: 'dlq', dashed: !stack.dlq, tone: tone(stack.dlq), label: stack.dlq ? 'redrive' : '' },
    { from: 'fn', to: 'table', label: 'PutItem', animated: true, tone: 'ok' },
    { from: 'fn', to: 'logs', tone: tone(stack.logRetention !== 'never expire') },
    { from: 'fn', to: 'xray', dashed: stack.tracing !== 'ACTIVE', tone: tone(stack.tracing === 'ACTIVE') },
  ];
  return (
    <div>
      <p className="muted">{stack.source}</p>
      <Graph runKey={result.receivedAt} nodes={nodes} edges={edges} height={220} />
      <ul className="checks">
        {review.map((x, i) => (
          <li key={x.rule} className={x.ok ? 'check-ok' : 'check-bad'} style={{ animationDelay: `${i * 70}ms` }}>
            <span className="check-icon">{x.ok ? '✓' : '✗'}</span>
            <div>{x.rule}<div className="check-detail">{x.value}</div></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
