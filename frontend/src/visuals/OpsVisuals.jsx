import React from 'react';
import { Bar, Empty, Stat } from '../components/common.jsx';
import { Graph, Legend } from './kit.jsx';

export function VpcVisual({ result }) {
  if (!result) return <Empty>Choose a placement and route, then press “Make the call”.</Empty>;
  const { placement, route, target, matrix, ok, cost } = result.data;
  const inVpc = placement !== 'not attached to a VPC';
  const nodes = [
    { id: 'fn', x: 110, y: 142, label: 'Lambda', sub: placement, tone: 'accent' },
    { id: 'route', x: 320, y: 142, label: inVpc ? route.split(' (')[0] : 'Lambda network', sub: inVpc ? cost : '', tone: route === 'nothing extra' && inVpc ? 'bad' : 'store' },
    ...matrix.map((m, i) => ({ id: `t${i}`, x: 540, y: 30 + i * 56, label: m.target.replace(' in the VPC', ''), sub: m.ok ? m.via : 'hangs → timeout', tone: m.ok ? 'ok' : 'bad' })),
  ];
  const edges = [
    { from: 'fn', to: 'route', animated: true, tone: 'accent' },
    ...matrix.map((m, i) => ({ from: 'route', to: `t${i}`, tone: m.ok ? 'ok' : 'bad', dashed: !m.ok, animated: m.ok && m.target === target })),
  ];
  return (
    <div>
      <div className={`verdict pop-in ${ok ? 'verdict-ok' : 'verdict-bad'}`}>{target}: {ok ? 'connected' : 'Task timed out after 3.00 seconds'}</div>
      <Graph runKey={result.receivedAt} nodes={nodes} edges={edges} height={290} />
      <Legend items={[{ color: 'var(--ok)', label: 'reachable' }, { color: 'var(--bad)', label: 'no route (the call hangs)' }]} />
    </div>
  );
}

export function RecursionVisual({ result }) {
  if (!result) return <Empty>Pick a trigger and press “Trigger it”.</Empty>;
  const { count, cap, limit, stoppedBy, source, same, detected } = result.data;
  const bars = Array.from({ length: Math.min(count, cap) }, (_, i) => i + 1);
  return (
    <div>
      <div className="stat-row">
        <Stat label="invocations" value={count} tone={count > limit ? 'bad' : count > 1 ? 'warn' : 'ok'} />
        <Stat label="trigger" value={source} />
        <Stat label="loop detection" value={detected ? `stops at ~${limit}` : 'not covered'} tone={detected ? 'ok' : 'bad'} />
      </div>
      <div className="loop-bars" key={result.receivedAt}>
        {bars.map((n) => (
          <span key={n} className={`loop-bar ${n >= limit && !detected ? 'loop-bad' : n >= limit ? 'loop-stop' : ''}`} style={{ height: `${Math.min(100, 8 + n * 0.75)}%`, animationDelay: `${n * 18}ms` }} title={`invocation ${n}`} />
        ))}
        <span className="loop-limit" style={{ left: `${(limit / cap) * 100}%` }}>~{limit}</span>
      </div>
      <p className={`verdict ${same && !detected && count >= cap ? 'verdict-bad' : 'verdict-ok'}`}>Stopped by: {stoppedBy}</p>
    </div>
  );
}

export function IamVisual({ result }) {
  if (!result) return <Empty>Pick a policy and an action, then press “Make the call”.</Empty>;
  const { matrix, policyName, ok, error, action, resource } = result.data;
  const actions = [...new Set(matrix.map((m) => m.action))];
  const resources = [...new Set(matrix.map((m) => m.resource))];
  const allowed = matrix.filter((m) => m.decision === 'allow').length;
  return (
    <div>
      <div className={`verdict pop-in ${ok ? 'verdict-ok' : 'verdict-bad'}`}>{action} on {resource.split(':').pop()}: {ok ? 'allowed' : error}</div>
      <div className="table-wrap">
        <table className="iam-matrix">
          <thead><tr><th>{policyName}</th>{resources.map((r) => <th key={r}>{r}</th>)}</tr></thead>
          <tbody>
            {actions.map((a, i) => (
              <tr key={a}>
                <td><code>{a}</code></td>
                {resources.map((r, j) => {
                  const d = matrix.find((m) => m.action === a && m.resource === r).decision;
                  return <td key={r} className={`iam-cell pop-in iam-${d.replace(' ', '-')}`} style={{ animationDelay: `${(i * 2 + j) * 60}ms` }}>{d === 'allow' ? '✓ allow' : '✗ deny'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Bar label="blast radius" value={allowed} max={matrix.length} tone={allowed > 1 ? 'bad' : 'ok'} text={`${allowed} of ${matrix.length} combinations allowed`} />
    </div>
  );
}

export function CostVisual({ result }) {
  if (!result) return <Empty>Pick a workload and press “Estimate”.</Empty>;
  const { curve, chosen, stored, retention, monthlyGb, workload } = result.data;
  const maxG = Math.max(...curve.map((c) => c.gbs));
  const maxS = Math.max(...stored.map((s) => s.gb), 0.01);
  return (
    <div>
      <h4>{workload}: GB-seconds per month by memory size</h4>
      {curve.map((c) => (
        <Bar key={c.memoryMb} label={`${c.memoryMb} MB${c.memoryMb === 1769 ? ' (1 vCPU)' : ''}`} value={c.gbs} max={maxG} tone={c.memoryMb === chosen.memoryMb ? 'accent' : 'store'} text={`${c.ms} ms · ${c.gbs}M GB-s`} />
      ))}
      {!curve.some((c) => c.memoryMb === chosen.memoryMb) && <Bar label={`${chosen.memoryMb} MB (yours)`} value={chosen.gbs} max={maxG} tone="accent" text={`${chosen.ms} ms · ${chosen.gbs}M GB-s`} />}
      <h4>Stored logs ({monthlyGb} GB written per month, retention: {retention})</h4>
      <div className="columns" key={result.receivedAt}>
        {stored.map((s, i) => (
          <div key={s.month} className="column" title={`month ${s.month}: ${s.gb} GB`}>
            <span className={`column-fill ${retention === 'never expire' ? 'column-bad' : 'column-ok'}`} style={{ height: `${(s.gb / maxS) * 100}%`, animationDelay: `${i * 50}ms` }} />
            <span className="column-label">{s.month}</span>
          </div>
        ))}
      </div>
      <div className="stat-row"><Stat label={`stored after ${stored.length} months`} value={`${stored[stored.length - 1].gb} GB`} tone={retention === 'never expire' ? 'bad' : 'ok'} /></div>
    </div>
  );
}
