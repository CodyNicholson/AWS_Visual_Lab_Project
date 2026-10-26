// The order worker from samples/concepts/lambda: SQS → Lambda → DynamoDB. parseOrder, recordOrder and
// handler are line-for-line ports of samples/concepts/lambda/typescript/order-worker.ts, running against
// an in-memory table that enforces the same condition DynamoDB does. The queue around it follows SQS's
// documented rules: visibility timeout, receive counts and the redrive policy.
import { AwsError, Demo, bool, clampInt, oneOf } from './lab.js';
import { SOURCES } from '../kb/repo.js';

// ---- The handler (port of order-worker.ts) -----------------------------------------------

export function parseOrder(body) {
  const order = JSON.parse(body);
  if (typeof order?.orderId !== 'string' || !order.orderId || typeof order.total !== 'number') {
    throw new Error('order needs orderId and total');
  }
  return { orderId: order.orderId, total: order.total };
}

/** An in-memory stand-in for the Orders table that honours ConditionExpression attribute_not_exists(pk). */
export class OrdersTable {
  constructor() {
    this.items = new Map();
    this.writes = 0;
  }

  put(item, { conditional = true } = {}) {
    this.writes += 1;
    if (conditional && this.items.has(item.pk)) {
      throw new AwsError('ConditionalCheckFailedException', 'The conditional request failed');
    }
    this.items.set(item.pk, item);
  }
}

/** Writes the order once. Returns false if it was already recorded (a duplicate delivery). */
export function recordOrder(table, order, { conditional = true } = {}) {
  try {
    table.put({ pk: `ORDER#${order.orderId}`, total: order.total, status: 'RECEIVED' }, { conditional });
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

export function handler(event, table, log = () => {}) {
  const batchItemFailures = [];
  for (const record of event.Records) {
    try {
      if (!recordOrder(table, parseOrder(record.body))) log(`duplicate delivery skipped ${record.messageId}`);
    } catch {
      // Log the ID, not the body: message bodies can hold customer data.
      log(`failed to process message ${record.messageId}`);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}

/** The mistake: throw on the first bad record, so Lambda treats the whole batch as failed. */
export function throwingHandler(event, table, log = () => {}) {
  for (const record of event.Records) {
    recordOrder(table, parseOrder(record.body));
    log(`processed ${record.messageId}`);
  }
  return {};
}

// ---- Partial batch responses ---------------------------------------------------------------

export const POISON_BODIES = ['{"orderId": "o-bad", "total": "12.50"}', 'not json at all', '{"total": 3}', '{"orderId": ""}', 'null'];

function makeMessages(n, poison) {
  // Spread the bad messages through the batch, e.g. one poison message in the middle of ten
  const bad = new Set(Array.from({ length: Math.min(poison, n) }, (_, k) => Math.min(n - 1, Math.floor(((k + 1) * n) / (poison + 1)))));
  let p = 0;
  return Array.from({ length: n }, (_, i) => ({
    messageId: `m${String(i + 1).padStart(2, '0')}`,
    bad: bad.has(i),
    body: bad.has(i) ? POISON_BODIES[p++ % POISON_BODIES.length] : JSON.stringify({ orderId: `o-${1000 + i}`, total: 10 + i }),
    receiveCount: 0,
  }));
}

/** Runs the queue until it drains: receive → invoke → delete or return → redrive to the DLQ. */
export function runQueue({ batchSize, poison, partial, maxReceiveCount }) {
  const queue = makeMessages(batchSize, poison);
  const table = new OrdersTable();
  const dlq = [];
  const rounds = [];
  const deliveries = new Map();
  for (let r = 1; r <= 12 && queue.length; r++) {
    const batch = queue.slice(0, batchSize);
    batch.forEach((m) => {
      m.receiveCount += 1;
      deliveries.set(m.messageId, (deliveries.get(m.messageId) || 0) + 1);
    });
    const event = { Records: batch.map((m) => ({ messageId: m.messageId, body: m.body })) };
    const logs = [];
    let failedIds;
    let threw = null;
    if (partial) {
      failedIds = new Set(handler(event, table, (l) => logs.push(l)).batchItemFailures.map((f) => f.itemIdentifier));
    } else {
      try {
        throwingHandler(event, table, (l) => logs.push(l));
        failedIds = new Set();
      } catch (e) {
        threw = `${e.name}: ${e.message}`;
        failedIds = new Set(batch.map((m) => m.messageId));
      }
    }
    const deleted = [];
    const returned = [];
    const redriven = [];
    for (const m of batch) {
      const idx = queue.indexOf(m);
      if (!failedIds.has(m.messageId)) {
        queue.splice(idx, 1);
        deleted.push(m.messageId);
      } else if (m.receiveCount >= maxReceiveCount) {
        queue.splice(idx, 1);
        dlq.push(m);
        redriven.push(m.messageId);
      } else returned.push(m.messageId);
    }
    rounds.push({ round: r, batch: batch.map((m) => ({ id: m.messageId, bad: m.bad, receive: m.receiveCount })), deleted, returned, redriven, threw, logs });
  }
  const good = makeMessages(batchSize, poison).filter((m) => !m.bad);
  return {
    rounds,
    dlq: dlq.map((m) => ({ id: m.messageId, bad: m.bad })),
    rows: table.items.size,
    writes: table.writes,
    goodCount: good.length,
    goodInDlq: dlq.filter((m) => !m.bad).length,
    goodRedeliveries: good.reduce((n, m) => n + (deliveries.get(m.messageId) || 0) - 1, 0),
  };
}

export function partialBatch(inputs, { throwInstead = false } = {}) {
  const d = new Demo('partial-batch');
  const batchSize = clampInt(inputs.batchSize, 2, 10, 10);
  const poison = clampInt(inputs.poison, 0, 3, 1);
  const maxReceiveCount = clampInt(inputs.maxReceiveCount, 1, 10, 5);
  const partial = throwInstead ? false : inputs.mode !== 'off: the handler throws';
  d.cmd(`SendMessageBatch ${batchSize} orders (${poison} malformed); redrive maxReceiveCount=${maxReceiveCount}`);
  d.cmd(`CreateEventSourceMapping BatchSize=${batchSize} FunctionResponseTypes=${partial ? '[ReportBatchItemFailures]' : '[] (the handler throws)'}`);
  const run = runQueue({ batchSize, poison, partial, maxReceiveCount });
  run.rounds.forEach((r) =>
    d.cmd(`receive #${r.round}: ${r.batch.length} msgs → ${r.threw ? `handler threw ${r.threw}; whole batch returns` : `${r.deleted.length} deleted, ${r.returned.length} back on the queue`}${r.redriven.length ? `, ${r.redriven.length} → DLQ` : ''}`),
  );
  d.cmd(`DynamoDB: ${run.rows} orders stored, ${run.writes} PutItem calls; DLQ: ${run.dlq.length} messages`);

  if (partial) {
    d.check('Only malformed messages end up in the dead-letter queue', run.dlq.every((m) => m.bad) && run.dlq.length === poison, `${run.dlq.length} in DLQ, ${run.goodInDlq} of them good`);
    d.check('Good messages are processed once', run.goodRedeliveries === 0, `${run.goodRedeliveries} extra deliveries of good messages`);
    d.check('Every good order is stored', run.rows === run.goodCount, `${run.rows}/${run.goodCount}`);
  } else if (poison > 0) {
    d.check('One bad message sends the whole batch back, again and again', run.goodRedeliveries > 0, `${run.goodRedeliveries} extra deliveries of good messages`);
    d.check('Good orders behind the poison message are never stored', run.rows < run.goodCount, `${run.rows}/${run.goodCount} stored`);
    d.check('…and end up in the DLQ with it', run.goodInDlq > 0, `${run.goodInDlq} good messages in the DLQ`);
  } else {
    d.check('With no bad messages, both handlers behave the same', run.dlq.length === 0, 'nothing in the DLQ');
  }
  return d.result({ ...run, batchSize, poison, partial, maxReceiveCount });
}

// ---- Visibility timeout ---------------------------------------------------------------------

export const SIX_TIMES = 6;

export function createEventSourceMapping(visibilityS, functionTimeoutS) {
  if (visibilityS < functionTimeoutS) {
    throw new AwsError('InvalidParameterValueException', `Queue visibility timeout: ${visibilityS} seconds is less than Function timeout: ${functionTimeoutS} seconds`);
  }
}

/**
 * Message received at t=0. The batch is throttled and Lambda retries it after `throttleS`; the
 * function then runs for `durationS`. If the visibility timeout ends first, SQS hands the same
 * message to another poller: a duplicate.
 */
export function visibilityTimeline({ functionTimeoutS, visibilityS, throttleS, durationS }) {
  const done = throttleS + durationS;
  const reappears = visibilityS < done;
  const events = [
    { t: 0, label: 'received (hidden)', tone: 'accent' },
    { t: throttleS, label: 'throttled batch retried', tone: 'warn' },
    { t: done, label: 'processed + deleted', tone: 'ok' },
  ];
  if (reappears) {
    events.push({ t: visibilityS, label: 'visibility timeout ends: message visible again', tone: 'bad' });
    events.push({ t: visibilityS + durationS, label: 'second consumer processes it: duplicate', tone: 'bad' });
  }
  events.sort((a, b) => a.t - b.t);
  return { done, reappears, events, recommended: functionTimeoutS * SIX_TIMES };
}

export function stackTimeouts() {
  const timeout = Number(SOURCES.orderWorkerStack.match(/functionTimeout = Duration\.seconds\((\d+)\)/)?.[1]);
  const factor = Number(SOURCES.orderWorkerStack.match(/functionTimeout\.toSeconds\(\) \* (\d+)/)?.[1]);
  return { timeout, factor, visibility: timeout * factor };
}

export function visibility(inputs, { questionScenario = false } = {}) {
  const d = new Demo('visibility-timeout');
  let functionTimeoutS = clampInt(inputs.functionTimeoutS, 1, 900, 30);
  let visibilityS = clampInt(inputs.visibilityS, 0, 43200, 180);
  const throttleS = clampInt(inputs.throttleS, 0, 3600, 60);
  const durationS = Math.min(functionTimeoutS, clampInt(inputs.durationS, 1, 900, 20));
  if (questionScenario) {
    functionTimeoutS = 60;
    visibilityS = 70;
    d.cmd('practice question lambda-001: function timeout 60 s, visibility timeout 70 s, throttled during a spike');
  }
  const stack = stackTimeouts();
  d.cmd(`order-worker-stack.ts: timeout ${stack.timeout} s, visibilityTimeout = timeout × ${stack.factor} = ${stack.visibility} s`);
  d.check('The CDK sample sets visibility to 6× the function timeout', stack.factor === SIX_TIMES, `${stack.timeout} s × ${stack.factor} = ${stack.visibility} s`);

  const esm = d.attempt(`CreateEventSourceMapping (visibility ${visibilityS} s, function timeout ${functionTimeoutS} s)`, () => createEventSourceMapping(visibilityS, functionTimeoutS));
  if (!esm.ok) {
    d.check('Lambda refuses a queue whose visibility timeout is below the function timeout', esm.error.name === 'InvalidParameterValueException', esm.error.message);
    return d.result({ blocked: true, functionTimeoutS, visibilityS, throttleS, durationS, error: esm.error.message, recommended: functionTimeoutS * SIX_TIMES });
  }
  const tl = visibilityTimeline({ functionTimeoutS, visibilityS, throttleS, durationS });
  tl.events.forEach((e) => d.cmd(`t+${e.t}s  ${e.label}`));
  if (questionScenario) {
    d.check('70 s is not enough once the batch is throttled: the message is processed twice', tl.reappears, `done at t+${tl.done}s, visible again at t+${visibilityS}s`);
    const fixed = visibilityTimeline({ functionTimeoutS, visibilityS: functionTimeoutS * SIX_TIMES, throttleS, durationS });
    d.cmd(`fix: SetQueueAttributes VisibilityTimeout=${functionTimeoutS * SIX_TIMES}`);
    d.check('At 6× (360 s) the retry finishes before the message reappears', !fixed.reappears, `done at t+${fixed.done}s < ${functionTimeoutS * SIX_TIMES}s`);
  } else {
    d.check(
      tl.reappears ? 'The visibility timeout ran out first: a duplicate delivery' : 'The message stayed hidden until it was deleted',
      tl.reappears === visibilityS < tl.done,
      `done at t+${tl.done}s, visibility ${visibilityS}s (6× rule: ${tl.recommended}s)`,
    );
  }
  return d.result({ ...tl, functionTimeoutS, visibilityS, throttleS, durationS, questionScenario });
}

// ---- Idempotency ----------------------------------------------------------------------------

export const SAMPLE_BODIES = ['{"orderId": "o-1", "total": 25}', '{"orderId": "o-2"}', '{"orderId": "o-3", "total": "9.99"}', 'not json'];

export function idempotency(inputs, { unconditional = false } = {}) {
  const d = new Demo('idempotency');
  const deliveries = clampInt(inputs.deliveries, 1, 6, 3);
  const conditional = unconditional ? false : bool(inputs.conditional ?? true);
  const table = new OrdersTable();
  let charges = 0;
  const timeline = [];
  for (let i = 1; i <= deliveries; i++) {
    const order = parseOrder(SAMPLE_BODIES[0]);
    const first = recordOrder(table, order, { conditional });
    // A side effect that must happen once per order, e.g. charging a card
    if (first) charges += 1;
    timeline.push({ delivery: i, wrote: first, charged: first });
    d.cmd(`delivery ${i}: PutItem ORDER#o-1${conditional ? ' ConditionExpression=attribute_not_exists(pk)' : ''} → ${first ? 'written, card charged' : 'ConditionalCheckFailedException: duplicate delivery skipped'}`);
  }
  const validation = SAMPLE_BODIES.map((body) => {
    try {
      return { body, ok: true, order: parseOrder(body) };
    } catch (e) {
      return { body, ok: false, error: `${e.name}: ${e.message}` };
    }
  });
  validation.forEach((v) => d.cmd(`parseOrder(${v.body}) → ${v.ok ? JSON.stringify(v.order) : v.error}`));

  if (conditional) {
    d.check('The same message delivered again is recorded once', table.items.size === 1 && charges === 1, `${deliveries} deliveries → ${charges} charge`);
  } else {
    d.check('Without the condition every redelivery repeats the side effect', charges === deliveries, `${deliveries} deliveries → ${charges} charges`);
    d.check('The table still shows one row, which hides the problem', table.items.size === 1, 'the overwrite looks harmless');
  }
  d.check('parseOrder rejects bodies without a string orderId and a numeric total', validation.filter((v) => !v.ok).length === 3, validation.map((v) => (v.ok ? '✓' : '✗')).join(' '));
  return d.result({ timeline, charges, rows: table.items.size, deliveries, conditional, validation });
}

// ---- The CDK stack ---------------------------------------------------------------------------

/** Reads the settings that matter straight out of samples/concepts/lambda/cdk/order-worker-stack.ts. */
export function readStack(src = SOURCES.orderWorkerStack) {
  const m = (re) => src.match(re)?.[1];
  const timeout = Number(m(/functionTimeout = Duration\.seconds\((\d+)\)/));
  return {
    source: 'order-worker-stack.ts',
    runtime: m(/Runtime\.(\w+)/),
    memoryMb: Number(m(/memorySize: (\d+)/)),
    timeoutS: timeout,
    visibilityS: timeout * Number(m(/functionTimeout\.toSeconds\(\) \* (\d+)/)),
    dlq: /deadLetterQueue: \{ queue: dlq/.test(src),
    maxReceiveCount: Number(m(/maxReceiveCount: (\d+)/)),
    batchSize: Number(m(/batchSize: (\d+)/)),
    reportBatchItemFailures: /reportBatchItemFailures: true/.test(src),
    logRetention: m(/RetentionDays\.(\w+)/) || 'never expire',
    tracing: m(/Tracing\.(\w+)/) || 'disabled',
    grant: m(/table\.grant\(worker, '([^']+)'\)/) || 'none',
    enforceSSL: (src.match(/enforceSSL: true/g) || []).length,
    billing: m(/Billing\.(\w+)\(/),
  };
}

/** The same stack written with CDK and service defaults: what people ship before reading the Lambda page. */
export const DEFAULTS_STACK = {
  source: 'a stack written with the defaults (timeout raised to 30 s, queue left at its 30 s default)',
  runtime: 'PYTHON_3_13',
  memoryMb: 128,
  timeoutS: 30,
  visibilityS: 30,
  dlq: false,
  maxReceiveCount: 0,
  batchSize: 10,
  reportBatchItemFailures: false,
  logRetention: 'never expire',
  tracing: 'disabled',
  grant: 'grantReadWriteData (dynamodb:*Item, Query, Scan, …)',
  enforceSSL: 0,
  billing: 'onDemand',
};

export function reviewStack(s) {
  return [
    { rule: 'Visibility timeout ≥ 6× function timeout', ok: s.visibilityS >= s.timeoutS * 6, value: `${s.visibilityS} s vs ${s.timeoutS} s` },
    { rule: 'Dead-letter queue with maxReceiveCount ≥ 5', ok: s.dlq && s.maxReceiveCount >= 5, value: s.dlq ? `maxReceiveCount ${s.maxReceiveCount}` : 'no DLQ' },
    { rule: 'Partial batch responses (ReportBatchItemFailures)', ok: s.reportBatchItemFailures, value: String(s.reportBatchItemFailures) },
    { rule: 'Log group with a retention period', ok: s.logRetention !== 'never expire', value: s.logRetention },
    { rule: 'Least privilege: only dynamodb:PutItem', ok: s.grant === 'dynamodb:PutItem', value: s.grant },
    { rule: 'Timeout above the 3 s default', ok: s.timeoutS > 3, value: `${s.timeoutS} s` },
    { rule: 'X-Ray tracing on', ok: s.tracing === 'ACTIVE', value: s.tracing },
    { rule: 'Queues refuse non-TLS requests (enforceSSL)', ok: s.enforceSSL >= 2, value: `${s.enforceSSL} queues` },
  ];
}

export function cdkStack(inputs, { defaults = false } = {}) {
  const d = new Demo('cdk-stack');
  const variant = defaults ? 'defaults' : oneOf(inputs.variant, ['the repo sample', 'defaults']);
  const stack = variant === 'defaults' ? DEFAULTS_STACK : readStack();
  d.cmd(variant === 'defaults' ? 'review a stack written with CDK defaults' : 'read samples/concepts/lambda/cdk/order-worker-stack.ts');
  const review = reviewStack(stack);
  review.forEach((r) => d.cmd(`${r.ok ? '✓' : '✗'} ${r.rule}: ${r.value}`));
  const failed = review.filter((r) => !r.ok);
  if (variant === 'defaults') {
    d.check('The defaults stack breaks the rules the Lambda page teaches', failed.length >= 6, `${failed.length} of ${review.length} rules broken`);
    d.check('Its visibility timeout invites duplicate processing', !review[0].ok, review[0].value);
  } else {
    d.check('The repo sample follows every rule', failed.length === 0, `${review.length - failed.length}/${review.length}`);
    d.check('Its CDK assertion test pins these settings', /VisibilityTimeout/.test(SOURCES.orderWorkerStackTest) && /maxReceiveCount/.test(SOURCES.orderWorkerStackTest), 'order-worker-stack.test.ts');
  }
  return d.result({ stack, review, variant });
}
