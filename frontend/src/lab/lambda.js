// AWS Lambda demos: execution environments (Init vs Invoke), the three invocation types, concurrency,
// versions and weighted aliases, and the limits from lambda.mdx. These simulate the behaviour the
// concept page documents; timings marked "illustrative" are round numbers chosen to make the effect
// visible, not measurements.
import { AwsError, Demo, clamp, clampInt, oneOf, round, seeded } from './lab.js';

// ---- Execution environments -------------------------------------------------------------

export const LIFECYCLE_MS = { init: 200, client: 40, work: 60, reapAfter: 3000, spacing: 40 }; // illustrative

/**
 * Requests arrive; each needs a free execution environment. A new environment runs Init first
 * (a cold start). An SDK client built at module scope is paid once per environment; one built
 * inside the handler is paid on every invocation. Idle environments are eventually reclaimed.
 */
export function simulateLifecycle({ requests, pattern, clientInHandler, provisioned }) {
  const { init, client, work, reapAfter, spacing } = LIFECYCLE_MS;
  const arrivals = [];
  if (pattern === 'steady') {
    for (let i = 0; i < requests; i++) arrivals.push(i * spacing);
  } else {
    // A burst, a quiet period long enough for environments to be reclaimed, then another burst
    const first = Math.ceil(requests / 2);
    for (let i = 0; i < first; i++) arrivals.push(i * spacing);
    for (let i = first; i < requests; i++) arrivals.push(first * spacing + reapAfter + 1000 + (i - first) * spacing);
  }
  const envs = Array.from({ length: provisioned }, (_, i) => ({ id: i + 1, freeAt: 0, lastUsed: 0, provisioned: true, segments: [] }));
  const invocations = [];
  for (const t of arrivals) {
    // Reclaim idle on-demand environments (provisioned ones are kept initialized)
    for (const env of envs) if (!env.provisioned && !env.gone && env.freeAt <= t && t - env.lastUsed > reapAfter) env.gone = true;
    let env = envs.find((e) => !e.gone && e.freeAt <= t);
    let cold = false;
    let start = t;
    if (!env) {
      env = { id: envs.length + 1, freeAt: 0, lastUsed: 0, provisioned: false, segments: [] };
      envs.push(env);
      cold = true;
      const initMs = init + (clientInHandler ? 0 : client);
      env.segments.push({ start: t, end: t + initMs, kind: 'init' });
      start = t + initMs;
    }
    const duration = work + (clientInHandler ? client : 0);
    env.segments.push({ start, end: start + duration, kind: cold ? 'cold' : 'warm' });
    env.freeAt = start + duration;
    env.lastUsed = env.freeAt;
    invocations.push({ arrival: t, start, end: start + duration, env: env.id, cold, latency: start + duration - t });
  }
  const coldStarts = invocations.filter((i) => i.cold).length;
  const clientMs = clientInHandler ? invocations.length * client : envs.filter((e) => !e.provisioned).length * client;
  const latencies = invocations.map((i) => i.latency).sort((a, b) => a - b);
  const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))];
  return { envs, invocations, coldStarts, clientMs, p50: p(0.5), p99: p(0.99), end: Math.max(...invocations.map((i) => i.end)) };
}

export function lifecycle(inputs, { compareHandler = false } = {}) {
  const d = new Demo('lambda-lifecycle');
  const requests = clampInt(inputs.requests, 2, 40, 28);
  const pattern = oneOf(inputs.pattern, ['burst after idle', 'steady']);
  const provisioned = clampInt(inputs.provisioned, 0, 20, 0);
  const clientInHandler = compareHandler || inputs.client === 'inside the handler';
  const run = simulateLifecycle({ requests, pattern, clientInHandler, provisioned });
  d.cmd(`${requests} requests, ${pattern}, provisioned concurrency ${provisioned}, SDK client ${clientInHandler ? 'inside the handler' : 'at module scope'}`);
  d.cmd(`→ ${run.envs.length} execution environments, ${run.coldStarts} cold starts, p50 ${run.p50} ms, p99 ${run.p99} ms`);

  const warm = run.invocations.filter((i) => !i.cold);
  d.check('Warm invocations skip the Init phase', warm.every((i) => i.start === i.arrival), `${warm.length} warm, ${run.coldStarts} cold`);
  const created = run.envs.filter((e) => !e.provisioned).length;
  d.check('Every cold start is a new execution environment', created === run.coldStarts, `${created} environments created on demand`);
  if (provisioned > 0) {
    const peak = Math.max(...run.invocations.map((a) => run.invocations.filter((b) => b.start < a.end && b.end > a.start).length));
    d.check(
      provisioned >= peak ? 'Provisioned concurrency covering the peak removes cold starts' : 'Requests beyond provisioned concurrency still cold-start',
      provisioned >= peak ? run.coldStarts === 0 : run.coldStarts > 0,
      `peak concurrency ${peak}, provisioned ${provisioned}`,
    );
  }

  let other = null;
  if (compareHandler) {
    other = simulateLifecycle({ requests, pattern, clientInHandler: false, provisioned });
    d.cmd(`same traffic with the client at module scope → client setup ${other.clientMs} ms total vs ${run.clientMs} ms`);
    d.check('A client built inside the handler is paid on every invocation', run.clientMs === requests * LIFECYCLE_MS.client, `${requests} × ${LIFECYCLE_MS.client} ms = ${run.clientMs} ms`);
    d.check('At module scope it is paid once per environment', other.clientMs < run.clientMs, `${other.clientMs} ms (${other.envs.filter((e) => !e.provisioned).length} environments)`);
  } else {
    d.check(
      clientInHandler ? 'Client setup runs on every invocation' : 'Client setup runs once per environment, during Init',
      clientInHandler ? run.clientMs === requests * LIFECYCLE_MS.client : run.clientMs === created * LIFECYCLE_MS.client,
      `${run.clientMs} ms of client setup`,
    );
  }
  return d.result({ run, other, timings: LIFECYCLE_MS, clientInHandler, provisioned, pattern });
}

// ---- Invocation types ----------------------------------------------------------------------

export const INVOCATION_TYPES = ['synchronous (API Gateway)', 'asynchronous (S3 / SNS)', 'event source mapping (SQS)'];
export const ON_FAILURE = ['nothing', 'on-failure destination', 'dead-letter queue on the function'];

/** Lambda's documented retry behaviour for each invocation type. Times in seconds. */
export function simulateInvocation({ type, failingAttempts, onFailure, visibilityS = 180, maxReceiveCount = 5 }) {
  const attempts = [];
  const outcome = { caller: null, keptBy: null, lost: false, functionDlq: 0, sourceDlq: 0 };
  const fails = (n) => n <= failingAttempts;
  if (type === 'sync') {
    attempts.push({ t: 0, ok: !fails(1) });
    outcome.caller = fails(1) ? '200 with X-Amz-Function-Error: Unhandled (the caller decides whether to retry)' : '200 with the function result';
    outcome.keptBy = fails(1) ? 'the caller' : null;
  } else if (type === 'async') {
    outcome.caller = '202 Accepted (queued; the caller never sees the result)';
    const times = [0, 60, 180]; // first try, then 1 minute, then 2 more minutes
    for (let i = 0; i < times.length; i++) {
      attempts.push({ t: times[i], ok: !fails(i + 1) });
      if (!fails(i + 1)) break;
    }
    if (attempts.every((a) => !a.ok)) {
      if (onFailure === 'nothing') outcome.lost = true;
      else outcome.keptBy = onFailure;
      if (onFailure === 'dead-letter queue on the function') outcome.functionDlq = 1;
    }
  } else {
    outcome.caller = 'no caller: the event source mapping polls the queue';
    for (let receive = 1; receive <= maxReceiveCount; receive++) {
      const t = (receive - 1) * visibilityS;
      attempts.push({ t, ok: !fails(receive), receive });
      if (!fails(receive)) break;
    }
    if (attempts.every((a) => !a.ok)) {
      outcome.sourceDlq = 1;
      outcome.keptBy = `the source queue's DLQ (redrive after ${maxReceiveCount} receives)`;
    }
  }
  return { attempts, outcome };
}

export function invocation(inputs, { dropFailures = false } = {}) {
  const d = new Demo('invocation-types');
  const typeLabel = oneOf(inputs.type, INVOCATION_TYPES);
  const type = ['sync', 'async', 'esm'][INVOCATION_TYPES.indexOf(typeLabel)];
  const failing = clampInt(inputs.failingAttempts, 0, 9, 1);
  const onFailure = dropFailures ? 'nothing' : oneOf(inputs.onFailure, ON_FAILURE);
  const sim = simulateInvocation({ type: dropFailures ? 'async' : type, failingAttempts: dropFailures ? 9 : failing, onFailure });
  const t = dropFailures ? 'async' : type;
  d.cmd(`invoke (${dropFailures ? INVOCATION_TYPES[1] : typeLabel}); the function fails its first ${dropFailures ? 'every' : failing} attempt(s); on failure: ${onFailure}`);
  sim.attempts.forEach((a, i) => d.cmd(`attempt ${i + 1} at t+${a.t}s → ${a.ok ? 'success' : 'function error'}`));
  d.cmd(`caller sees: ${sim.outcome.caller}`);

  if (t === 'sync') {
    d.check('Synchronous: Lambda does not retry; the caller gets the error', sim.attempts.length === 1, `${sim.attempts.length} attempt`);
  } else if (t === 'async') {
    d.check('Asynchronous: at most 3 attempts (2 retries)', sim.attempts.length <= 3, `${sim.attempts.length} attempts`);
    if (sim.attempts.length === 3) d.check('Retries wait 1 minute, then 2 minutes', sim.attempts[1].t === 60 && sim.attempts[2].t === 180, sim.attempts.map((a) => `t+${a.t}s`).join(', '));
    if (dropFailures) d.check('With no destination or DLQ, a failed async event is discarded', sim.outcome.lost, 'nothing kept the event');
    else if (sim.attempts.every((a) => !a.ok)) d.check(onFailure === 'nothing' ? 'The event is lost' : `The failed event is kept by the ${onFailure}`, onFailure === 'nothing' ? sim.outcome.lost : Boolean(sim.outcome.keptBy), sim.outcome.keptBy || 'discarded');
  } else {
    d.check('SQS: retries follow the visibility timeout and the queue redrive policy', sim.attempts.every((a, i) => a.t === i * 180), sim.attempts.map((a) => `receive ${a.receive} at t+${a.t}s`).join(', '));
    if (onFailure === 'dead-letter queue on the function') d.check("A function DLQ doesn't apply to an SQS source", sim.outcome.functionDlq === 0, `function DLQ: ${sim.outcome.functionDlq}, source DLQ: ${sim.outcome.sourceDlq}`);
  }
  return d.result({ type: t, typeLabel: dropFailures ? INVOCATION_TYPES[1] : typeLabel, failing: dropFailures ? 9 : failing, onFailure, ...sim });
}

// ---- Concurrency ---------------------------------------------------------------------------

export const UNRESERVED_MINIMUM = 100;
export const SCALE_RATE = { environments: 1000, seconds: 10 };

export function concurrencyNeeded(rps, durationMs) {
  return Math.ceil(rps * (durationMs / 1000));
}

export function putReservedConcurrency(quota, reserved) {
  if (quota - reserved < UNRESERVED_MINIMUM) {
    throw new AwsError(
      'InvalidParameterValueException',
      `Specified ReservedConcurrentExecutions for function decreases account's UnreservedConcurrentExecution below its minimum value of [${UNRESERVED_MINIMUM}].`,
    );
  }
  return reserved;
}

export function concurrency(inputs, { overReserve = false } = {}) {
  const d = new Demo('concurrency');
  const rps = clampInt(inputs.rps, 1, 50000, 4000);
  const durationMs = clampInt(inputs.durationMs, 1, 900000, 200);
  const quota = clampInt(inputs.quota, 1000, 20000, 1000);
  let reserved = clampInt(inputs.reserved, 0, 20000, 0);
  const needed = concurrencyNeeded(rps, durationMs);
  d.cmd(`concurrency = ${rps} req/s × ${durationMs / 1000} s = ${needed}`);
  d.check('Worked example from the Lambda page: 5,000 req/s × 200 ms = 1,000', concurrencyNeeded(5000, 200) === 1000, '= the default Regional quota');
  d.check('Practice question lambda-005: 4,000 req/s × 200 ms = 800', concurrencyNeeded(4000, 200) === 800, 'rps × duration, not rps ÷ duration');

  if (overReserve) {
    const tooMuch = quota - UNRESERVED_MINIMUM + 50;
    const a = d.attempt(`PutFunctionConcurrency ReservedConcurrentExecutions=${tooMuch} (quota ${quota})`, () => putReservedConcurrency(quota, tooMuch));
    d.check(`Lambda keeps ${UNRESERVED_MINIMUM} units unreserved`, !a.ok && a.error.name === 'InvalidParameterValueException', a.error?.message);
    reserved = putReservedConcurrency(quota, quota - UNRESERVED_MINIMUM);
    d.cmd(`PutFunctionConcurrency ReservedConcurrentExecutions=${reserved} → ok`);
  } else if (reserved > 0) {
    const a = d.attempt(`PutFunctionConcurrency ReservedConcurrentExecutions=${reserved}`, () => putReservedConcurrency(quota, reserved));
    if (!a.ok) reserved = 0;
  }

  const cap = reserved > 0 ? reserved : quota - 0; // unreserved functions share the pool
  const served = Math.min(needed, cap);
  const throttledShare = needed > 0 ? round(1 - served / needed, 3) : 0;
  const scaleSeconds = Math.ceil(served / SCALE_RATE.environments) * SCALE_RATE.seconds;
  d.cmd(`cap ${cap} (${reserved > 0 ? 'reserved' : 'shared Regional pool'}) → ${served} in flight, ${Math.round(throttledShare * 100)}% throttled`);
  if (throttledShare > 0) d.cmd(`✗ sync callers get 429 TooManyRequestsException: Rate Exceeded.; async events and SQS batches are retried`);
  d.cmd(`scaling: up to ${SCALE_RATE.environments} new environments per ${SCALE_RATE.seconds} s → ${served} in ≈ ${scaleSeconds} s`);
  d.check(
    needed > cap ? 'Demand above the cap is throttled' : 'The cap covers the demand',
    needed > cap ? throttledShare > 0 : throttledShare === 0,
    `${needed} needed, cap ${cap}`,
  );
  if (reserved > 0) d.check('Reserved concurrency guarantees and caps the function', served <= reserved, `others share ${quota - reserved} (minimum ${UNRESERVED_MINIMUM})`);
  return d.result({ rps, durationMs, needed, quota, reserved, cap, served, throttledShare, scaleSeconds, othersPool: quota - reserved });
}

// ---- Versions and weighted aliases ---------------------------------------------------------

export function updateAliasRouting(versions) {
  if (versions.includes('$LATEST')) throw new Error('weighted routing needs two published versions; $LATEST cannot be one of them');
  return versions;
}

export function aliases(inputs, { straightToLatest = false } = {}) {
  const d = new Demo('versions-aliases');
  const weight = clamp(inputs.weight, 0, 50, 10) / 100;
  const errorRate = clamp(inputs.newErrorRate, 0, 100, 8) / 100;
  const requests = clampInt(inputs.requests, 100, 5000, 1000);
  const alarm = 0.02;
  const baseRate = 0.005;
  const rand = seeded(42);
  d.cmd('PublishVersion → 1 (current), PublishVersion → 2 (new code)');

  if (straightToLatest) {
    const a = d.attempt('UpdateAlias live --routing-config AdditionalVersionWeights={"$LATEST":0.1}', () => updateAliasRouting(['1', '$LATEST']));
    d.check('A weighted alias cannot route to $LATEST', !a.ok, a.error?.message);
  } else {
    updateAliasRouting(['1', '2']);
    d.cmd(`UpdateAlias live FunctionVersion=1 AdditionalVersionWeights={"2": ${weight}}`);
  }

  const log = [];
  let rolledBack = false;
  let v2Seen = 0;
  let v2Errors = 0;
  for (let i = 0; i < requests; i++) {
    const toNew = straightToLatest ? true : !rolledBack && rand() < weight;
    const failed = rand() < (toNew ? errorRate : baseRate);
    if (toNew) {
      v2Seen += 1;
      if (failed) v2Errors += 1;
    }
    log.push({ v: toNew ? (straightToLatest ? 'L' : '2') : '1', failed });
    // CodeDeploy-style alarm: roll back once the new version's error rate is clearly above the threshold
    if (!straightToLatest && !rolledBack && v2Seen >= 30 && v2Errors / v2Seen > alarm) {
      rolledBack = true;
      d.cmd(`alarm: version 2 error rate ${round((v2Errors / v2Seen) * 100, 1)}% > ${alarm * 100}% after ${i + 1} requests → UpdateAlias live AdditionalVersionWeights={} (rollback)`);
    }
  }
  const failedTotal = log.filter((r) => r.failed).length;
  const newShare = v2Seen / requests;
  d.cmd(`${requests} requests: ${v2Seen} to the new code, ${failedTotal} errors in total`);

  if (straightToLatest) {
    d.check('Shipping to $LATEST sends every request to the new code at once', v2Seen === requests, `${v2Seen}/${requests}`);
    d.check('Every user is exposed to the new code’s error rate', errorRate === 0 || failedTotal > requests * errorRate * 0.5, `${failedTotal} failed requests`);
  } else if (errorRate > alarm) {
    d.check('A bad canary is caught and rolled back by one alias update', rolledBack, `${v2Seen} requests reached version 2 before rollback`);
    d.check('Most users never saw the bad version', newShare < weight + 0.05, `${round(newShare * 100, 1)}% of traffic`);
  } else {
    d.check('The alias splits traffic by its weight', Math.abs(newShare - weight) < 0.04, `${round(newShare * 100, 1)}% observed vs ${weight * 100}% configured`);
  }
  return d.result({ log, weight, errorRate, requests, rolledBack, v2Seen, v2Errors, failedTotal, straightToLatest });
}

// ---- Limits --------------------------------------------------------------------------------

/** The numeric limits from lambda.mdx, as rules. The test suite checks each name exists in the frontmatter. */
export const LIMIT_RULES = [
  { name: 'Function timeout', input: 'timeoutS', unit: 's', min: 1, max: 900 },
  { name: 'Memory', input: 'memoryMb', unit: 'MB', min: 128, max: 10240 },
  { name: 'Invocation payload (synchronous)', input: 'payloadMb', unit: 'MB', max: 6 },
  { name: 'Environment variables', input: 'envKb', unit: 'KB', max: 4 },
  { name: 'Deployment package (.zip)', input: 'zipMb', unit: 'MB zipped', max: 50 },
  { name: 'Layers per function', input: 'layers', unit: '', max: 5 },
];

export const VCPU_MB = 1769;

export function invokeWithPayload(bytes) {
  const max = 6 * 1024 * 1024;
  if (bytes > max) throw new AwsError('RequestEntityTooLargeException', `Request must be smaller than ${max} bytes for the InvokeFunction operation`);
  return bytes;
}

export function runWithTimeout(timeoutS, durationS) {
  if (durationS > timeoutS) throw new AwsError('Sandbox.Timedout', `Task timed out after ${timeoutS.toFixed(2)} seconds`);
  return durationS;
}

export function limits(inputs, { mistake = false } = {}) {
  const d = new Demo('limits');
  const values = {
    timeoutS: clamp(inputs.timeoutS, 1, 2000, 3),
    memoryMb: clampInt(inputs.memoryMb, 64, 20000, 512),
    payloadMb: clamp(inputs.payloadMb, 0, 20, 1),
    envKb: clamp(inputs.envKb, 0, 16, 1),
    zipMb: clamp(inputs.zipMb, 0, 200, 20),
    layers: clampInt(inputs.layers, 0, 10, 2),
  };
  const p99S = clamp(inputs.p99S, 0, 2000, 1.2);
  if (mistake) Object.assign(values, { timeoutS: 3, payloadMb: 7 });
  const rows = LIMIT_RULES.map((r) => {
    const v = values[r.input];
    const ok = v <= r.max && (r.min == null || v >= r.min);
    return { ...r, value: v, ok };
  });
  rows.forEach((r) => d.cmd(`${r.ok ? '✓' : '✗'} ${r.name}: ${r.value} ${r.unit} (limit ${r.min != null ? `${r.min}–` : '≤ '}${r.max})`));
  const vcpu = round(values.memoryMb / VCPU_MB, 2);
  d.cmd(`memory ${values.memoryMb} MB ≈ ${vcpu} vCPU (1,769 MB = 1 vCPU)`);

  const payload = d.attempt(`Invoke RequestResponse with a ${values.payloadMb} MB payload`, () => invokeWithPayload(Math.round(values.payloadMb * 1024 * 1024)));
  const timeout = d.attempt(`run a p99 ${mistake ? 3.4 : p99S} s invocation with Timeout=${values.timeoutS}`, () => runWithTimeout(values.timeoutS, mistake ? 3.4 : p99S));
  if (mistake) {
    d.check('A 7 MB synchronous payload is rejected', !payload.ok && payload.error.name === 'RequestEntityTooLargeException', payload.error?.message);
    d.check('The 3-second default cuts off a slow invocation', !timeout.ok, timeout.error?.message);
    const fixed = d.attempt('fix: pass large payloads through S3 and set Timeout=10 (headroom over the observed p99)', () => {
      invokeWithPayload(200 * 1024);
      return runWithTimeout(10, 3.4);
    });
    d.check('The fix stays inside the limits', fixed.ok, 'S3 object key in the payload; 10 s timeout');
  } else {
    d.check(
      'Every setting is checked against its documented limit',
      rows.length === LIMIT_RULES.length,
      rows.filter((r) => !r.ok).map((r) => `over: ${r.name}`).join(', ') || 'all within limits',
    );
    d.check(timeout.ok ? 'The timeout leaves headroom over the p99 duration' : 'The p99 duration exceeds the timeout', timeout.ok === p99S <= values.timeoutS, `p99 ${p99S} s vs timeout ${values.timeoutS} s`);
  }
  return d.result({ rows, vcpu, values, payloadOk: payload.ok, timeoutOk: timeout.ok, mistake, p99S: mistake ? 3.4 : p99S });
}

