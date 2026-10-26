import React from 'react';
import { Bar, Empty, Stat, formatNumber } from '../components/common.jsx';
import { Cells, Gantt, Legend, Timeline } from './kit.jsx';

export function LifecycleVisual({ result }) {
  if (!result) return <Empty>Press “Send the traffic” to watch execution environments start, warm up and get reclaimed.</Empty>;
  const { run, other, timings, clientInHandler } = result.data;
  const lanes = run.envs.map((env) => ({
    label: `env ${env.id}${env.provisioned ? ' (provisioned)' : ''}`,
    segments: env.segments.map((s) => ({ ...s, tone: s.kind === 'init' ? 'warn' : s.kind === 'cold' ? 'bad' : 'ok', title: `${s.kind} ${s.start}–${s.end} ms` })),
  }));
  return (
    <div>
      <div className="stat-row">
        <Stat label="requests" value={run.invocations.length} />
        <Stat label="environments" value={run.envs.length} tone="accent" />
        <Stat label="cold starts" value={run.coldStarts} tone={run.coldStarts ? 'bad' : 'ok'} />
        <Stat label="p50 / p99 latency" value={`${run.p50} / ${run.p99} ms`} />
        <Stat label="client setup paid" value={`${run.clientMs} ms`} tone={clientInHandler ? 'bad' : 'ok'} hint={clientInHandler ? 'every invocation' : 'once per environment'} />
        {other && <Stat label="…at module scope" value={`${other.clientMs} ms`} tone="ok" />}
      </div>
      <Gantt runKey={result.receivedAt} lanes={lanes} unit="ms" />
      <Legend items={[{ color: 'var(--warn)', label: `Init (${timings.init} ms${clientInHandler ? '' : ` + ${timings.client} ms client`})` }, { color: 'var(--bad)', label: 'first invocation (cold)' }, { color: 'var(--ok)', label: 'warm invocation' }]} />
      <p className="hint">Idle environments are reclaimed after {timings.reapAfter / 1000} s here (illustrative); provisioned ones stay initialized.</p>
    </div>
  );
}

export function InvocationVisual({ result }) {
  if (!result) return <Empty>Pick an invocation type and press “Invoke”.</Empty>;
  const { attempts, outcome, typeLabel } = result.data;
  const events = attempts.map((a, i) => ({ t: a.t, label: `attempt ${i + 1}${a.receive ? ` (receive ${a.receive})` : ''}: ${a.ok ? 'success' : 'error'}`, tone: a.ok ? 'ok' : 'bad' }));
  const last = attempts[attempts.length - 1];
  if (!last.ok) events.push({ t: last.t + 20, label: outcome.lost ? 'event discarded' : `kept by ${outcome.keptBy}`, tone: outcome.lost ? 'bad' : 'warn' });
  return (
    <div>
      <div className="verdict pop-in"><b>{typeLabel}</b> · caller sees: {outcome.caller}</div>
      <Timeline runKey={result.receivedAt} events={events} unit="s" />
      <div className="stat-row">
        <Stat label="attempts" value={attempts.length} />
        <Stat label="result" value={last.ok ? 'processed' : outcome.lost ? 'lost' : 'kept for later'} tone={last.ok ? 'ok' : outcome.lost ? 'bad' : 'warn'} />
        {result.data.type === 'esm' && <Stat label="function DLQ / source DLQ" value={`${outcome.functionDlq} / ${outcome.sourceDlq}`} />}
      </div>
    </div>
  );
}

export function ConcurrencyVisual({ result }) {
  if (!result) return <Empty>Set the traffic and press “Calculate”.</Empty>;
  const { needed, cap, served, throttledShare, scaleSeconds, quota, reserved, othersPool, rps, durationMs } = result.data;
  const max = Math.max(needed, quota) * 1.05;
  return (
    <div>
      <div className="formula pop-in">
        <span>{formatNumber(rps)} req/s</span><span>×</span><span>{durationMs / 1000} s</span><span>=</span><b>{formatNumber(needed)}</b><span className="muted">concurrent executions</span>
      </div>
      <Bar label="needed" value={needed} max={max} tone={needed > cap ? 'bad' : 'accent'} text={formatNumber(needed)} marker={cap} markerLabel="cap" />
      <Bar label={reserved ? 'reserved (cap)' : 'Regional quota'} value={cap} max={max} tone="store" text={formatNumber(cap)} />
      <Bar label="served" value={served} max={max} tone="ok" text={formatNumber(served)} />
      {reserved > 0 && <Bar label="left for others" value={othersPool} max={max} tone="warn" text={`${formatNumber(othersPool)} (min 100)`} />}
      <div className="stat-row">
        <Stat label="throttled" value={`${Math.round(throttledShare * 100)}%`} tone={throttledShare ? 'bad' : 'ok'} hint={throttledShare ? '429 TooManyRequestsException' : 'none'} />
        <Stat label="time to scale" value={`≈ ${scaleSeconds} s`} hint="1,000 environments / 10 s" />
      </div>
    </div>
  );
}

export function AliasesVisual({ result }) {
  if (!result) return <Empty>Press “Run the canary” to route traffic through the live alias.</Empty>;
  const { log, weight, rolledBack, v2Seen, v2Errors, failedTotal, requests, straightToLatest } = result.data;
  const shown = log.slice(0, 400);
  return (
    <div>
      <div className="stat-row">
        <Stat label="configured weight" value={straightToLatest ? '100% ($LATEST)' : `${Math.round(weight * 100)}%`} />
        <Stat label="reached new code" value={`${v2Seen} / ${requests}`} tone={straightToLatest ? 'bad' : 'accent'} />
        <Stat label="new-code errors" value={v2Errors} tone={v2Errors ? 'bad' : 'ok'} />
        <Stat label="all errors" value={failedTotal} />
        <Stat label="rolled back" value={rolledBack ? 'yes' : 'no'} tone={rolledBack ? 'warn' : 'ok'} />
      </div>
      <Cells small columns={40} cells={shown.map((r, i) => ({ key: i, text: '', tone: r.failed ? 'bad' : r.v === '1' ? 'store' : 'warn', title: `request ${i + 1}: version ${r.v}${r.failed ? ', error' : ''}` }))} />
      <Legend items={[{ color: 'var(--store)', label: 'version 1' }, { color: 'var(--warn)', label: straightToLatest ? '$LATEST (new code)' : 'version 2 (canary)' }, { color: 'var(--bad)', label: 'error' }]} />
      {log.length > shown.length && <p className="hint">First {shown.length} of {log.length} requests shown.</p>}
    </div>
  );
}

export function LimitsVisual({ result }) {
  if (!result) return <Empty>Enter a configuration and press “Check the configuration”.</Empty>;
  const { rows, vcpu, payloadOk, timeoutOk, values, p99S } = result.data;
  return (
    <div>
      {rows.map((r) => (
        <Bar key={r.name} label={r.name} value={r.value} max={r.max * 1.25} tone={r.ok ? 'ok' : 'bad'} marker={r.max} markerLabel={`limit ${r.max}`} text={`${r.value} / ${r.max} ${r.unit}`} />
      ))}
      <Bar label="p99 vs timeout" value={p99S} max={Math.max(p99S, values.timeoutS) * 1.25} marker={values.timeoutS} markerLabel="timeout" tone={timeoutOk ? 'ok' : 'bad'} text={`${p99S} s / ${values.timeoutS} s`} />
      <div className="stat-row">
        <Stat label="vCPU (1,769 MB = 1)" value={vcpu} tone="accent" />
        <Stat label="sync invoke" value={payloadOk ? 'accepted' : 'RequestEntityTooLarge'} tone={payloadOk ? 'ok' : 'bad'} />
        <Stat label="run" value={timeoutOk ? 'finished' : 'Task timed out'} tone={timeoutOk ? 'ok' : 'bad'} />
      </div>
    </div>
  );
}
