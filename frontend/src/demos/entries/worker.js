import { cdkStack, idempotency, partialBatch, visibility } from '../../lab/worker.js';
import { SOURCES, excerpt } from '../../kb/repo.js';
import { kbMistake } from '../kb-pitfalls.js';

const CATEGORY = 'Order worker: SQS → Lambda → DynamoDB';

export default [
  {
    id: 'partial-batch',
    category: CATEGORY,
    title: 'Partial batch responses',
    tagline: 'One bad message shouldn’t send nine good ones back to the queue',
    description: [
      'The repo’s order worker is an SQS-triggered function that records orders in DynamoDB. The event source mapping hands it up to 10 messages per batch. Without partial batch responses, any error, including an exception thrown from the handler, returns every message in the batch to the queue.',
      'Press the button to send a batch with a malformed order in it. The handler here is a line-for-line port of samples/…/typescript/order-worker.ts. Each row is one receive of the batch: green messages are deleted, amber ones return to the queue, red ones are poison, and anything that reaches maxReceiveCount moves to the dead-letter queue.',
      'With ReportBatchItemFailures on, the handler catches errors per record and returns only the failed message IDs, so only the poison message cycles to the DLQ. Turn it off (the handler throws) and the good orders behind the poison message are never stored: the whole batch ends up in the DLQ.',
    ],
    keyApis: ['ReportBatchItemFailures', 'batchItemFailures', 'itemIdentifier', 'maxReceiveCount'],
    useCases: ['Queue workers', 'Kinesis / DynamoDB Streams consumers (same idea)'],
    snippet: { lang: 'ts', name: 'samples/concepts/lambda/typescript/order-worker.ts', code: excerpt(SOURCES.orderWorkerTs, 'export const handler', '};') },
    inputs: [
      { name: 'batchSize', label: 'Batch size', type: 'number', default: 10, min: 2, max: 10 },
      { name: 'poison', label: 'Malformed messages', type: 'number', default: 1, min: 0, max: 3 },
      { name: 'maxReceiveCount', label: 'maxReceiveCount', type: 'number', default: 5, min: 1, max: 10 },
      { name: 'mode', label: 'Partial batch responses', type: 'select', default: 'on: ReportBatchItemFailures', options: ['on: ReportBatchItemFailures', 'off: the handler throws'] },
    ],
    flow: [
      ['sqs', 'lambda', 'batch of 10 (event source mapping)'],
      ['lambda', 'ddb', 'PutItem per order'],
      ['lambda', 'sqs', '{ batchItemFailures: [m06] }'],
      ['sqs', 'sqs', 'delete 9; m06 visible again → DLQ after 5'],
    ],
    actions: [
      { id: 'run', label: 'Process the batch', tone: 'accent', run: (i) => partialBatch(i) },
      { id: 'throw', label: 'Do it wrong: throw from the handler', tone: 'ghost', run: (i) => partialBatch(i, { throwInstead: true }), flow: () => [['sqs', 'lambda', 'batch of 10'], ['lambda', 'ddb', 'PutItem m01…m05'], ['lambda', 'lambda', 'throws at m06'], ['lambda', 'sqs', 'whole batch returns'], ['sqs', 'sqs', 'all 10 → DLQ after 5 receives']] },
    ],
    pitfalls: [
      kbMistake('One bad message fails the whole SQS batch', {
        avoid: 'Turn on ReportBatchItemFailures in IaC and unit-test a batch with one bad record (the samples do).',
        lang: 'ts',
        wrongCode: 'for (const record of event.Records) {\n  await recordOrder(parseOrder(record.body)); // throws → whole batch retried\n}',
        rightCode: 'for (const record of event.Records) {\n  try { await recordOrder(parseOrder(record.body)); }\n  catch { batchItemFailures.push({ itemIdentifier: record.messageId }); }\n}\nreturn { batchItemFailures };',
        reproduce: 'throw',
      }),
    ],
    visual: 'batch',
    test: { action: 'run' },
  },
  {
    id: 'visibility-timeout',
    category: CATEGORY,
    title: 'Visibility timeout: the 6× rule',
    tagline: 'Set the queue’s visibility timeout to at least six times the function timeout',
    description: [
      'When the event source mapping receives a message, SQS hides it for the visibility timeout. If the message isn’t deleted before that ends, SQS hands it out again, even if Lambda is still waiting to retry a throttled batch.',
      'Set the function timeout, the visibility timeout, how long the batch waits while throttled, and how long it runs. The timeline shows when the message is hidden, when it is processed and whether it reappears for a second consumer: a duplicate.',
      'AWS recommends a visibility timeout of at least 6× the function timeout (plus any batching window). The CDK sample computes it from the timeout (30 s × 6 = 180 s), and Lambda refuses to create the mapping at all when the visibility timeout is shorter than the function timeout.',
    ],
    keyApis: ['VisibilityTimeout', 'Timeout', 'MaximumBatchingWindowInSeconds', 'InvalidParameterValueException'],
    useCases: ['Any SQS-triggered function', 'Practice question lambda-001'],
    snippet: { lang: 'ts', name: 'samples/concepts/lambda/cdk/order-worker-stack.ts', code: excerpt(SOURCES.orderWorkerStack, 'const functionTimeout', 'enforceSSL: true,') },
    inputs: [
      { name: 'functionTimeoutS', label: 'Function timeout (s)', type: 'number', default: 30, min: 1, max: 900 },
      { name: 'visibilityS', label: 'Visibility timeout (s)', type: 'number', default: 180, min: 0, max: 43200 },
      { name: 'throttleS', label: 'Throttled for (s)', type: 'number', default: 60, min: 0, max: 3600 },
      { name: 'durationS', label: 'Run time (s)', type: 'number', default: 20, min: 1, max: 900 },
    ],
    flow: [
      ['sqs', 'lambda', 'receive: message hidden'],
      ['lambda', 'lambda', 'throttled, retried later'],
      ['lambda', 'ddb', 'PutItem'],
      ['lambda', 'sqs', 'DeleteMessage before the timeout ends'],
    ],
    actions: [
      { id: 'run', label: 'Play the timeline', tone: 'accent', run: (i) => visibility(i) },
      { id: 'question', label: 'Do it wrong: 60 s function, 70 s queue', tone: 'ghost', run: (i) => visibility(i, { questionScenario: true }) },
    ],
    pitfalls: [
      kbMistake('SQS visibility timeout shorter than six times the function timeout', {
        avoid: 'Derive the visibility timeout from the function timeout in IaC, as the CDK sample does, so they can’t drift.',
        lang: 'ts',
        wrongCode: "new sqs.Queue(this, 'Orders'); // 30 s default visibility\nnew lambda.Function(this, 'Worker', { timeout: Duration.seconds(60) });",
        rightCode: "const functionTimeout = Duration.seconds(30);\nnew sqs.Queue(this, 'Orders', {\n  visibilityTimeout: Duration.seconds(functionTimeout.toSeconds() * 6),\n});",
        reproduce: 'question',
      }),
      {
        mistake: 'Visibility timeout below the function timeout',
        symptom: 'InvalidParameterValueException: Queue visibility timeout: 30 seconds is less than Function timeout: 60 seconds',
        why: 'Lambda validates the queue when you create the event source mapping.',
        fix: 'Raise the queue’s VisibilityTimeout (6× the function timeout), then create the mapping.',
        avoid: 'Compute both from one constant in IaC.',
        source: { title: 'Configuring a queue to use with Lambda', url: 'https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html' },
      },
    ],
    visual: 'visibility',
    test: { action: 'run' },
  },
  {
    id: 'idempotency',
    category: CATEGORY,
    title: 'Idempotent writes',
    tagline: 'At-least-once delivery means the same order can arrive twice',
    description: [
      'Event source mappings and asynchronous invocation deliver at least once: the same event can arrive more than once even without an error. A handler that isn’t idempotent double-charges, double-emails or writes duplicate rows.',
      'Deliver the same order several times. The order worker writes with ConditionExpression attribute_not_exists(pk), so only the first write succeeds and later deliveries are skipped as duplicates. Turn the condition off and every delivery repeats the side effect, even though the table still shows one row.',
      'The lab also runs the sample’s parseOrder() on a few bodies: it rejects anything without a string orderId and a numeric total, which is what makes a message "poison" in the batch demo.',
    ],
    keyApis: ['ConditionExpression', 'attribute_not_exists(pk)', 'ConditionalCheckFailedException', 'Powertools idempotency'],
    useCases: ['Payments', 'Emails and notifications', 'Any SQS or async handler'],
    snippet: { lang: 'python', name: 'samples/concepts/lambda/python/order_worker/handler.py', code: excerpt(SOURCES.handlerPy, 'def record_order', 'return False') },
    inputs: [
      { name: 'deliveries', label: 'Deliveries of the same message', type: 'number', default: 3, min: 1, max: 6 },
      { name: 'conditional', label: 'Conditional write (attribute_not_exists)', type: 'checkbox', default: true },
    ],
    flow: [
      ['sqs', 'lambda', 'message o-1 (again)'],
      ['lambda', 'ddb', 'PutItem if attribute_not_exists(pk)'],
      ['ddb', 'lambda', 'ConditionalCheckFailedException'],
      ['lambda', 'cw', 'duplicate delivery skipped'],
    ],
    actions: [
      { id: 'run', label: 'Deliver the order', tone: 'accent', run: (i) => idempotency(i) },
      { id: 'unconditional', label: 'Do it wrong: unconditional PutItem', tone: 'ghost', run: (i) => idempotency(i, { unconditional: true }) },
    ],
    pitfalls: [
      kbMistake("Handler that isn't idempotent", {
        avoid: 'Assume every message arrives twice; key side effects on a stable ID such as the order ID or message ID.',
        lang: 'python',
        wrongCode: 'TABLE.put_item(Item={"pk": f"ORDER#{order_id}", ...})\ncharge_card(order)',
        rightCode: 'TABLE.put_item(\n    Item={"pk": f"ORDER#{order_id}", ...},\n    ConditionExpression="attribute_not_exists(pk)",\n)  # raises ConditionalCheckFailedException on a duplicate\ncharge_card(order)',
        reproduce: 'unconditional',
      }),
    ],
    visual: 'idempotency',
    test: { action: 'run' },
  },
  {
    id: 'cdk-stack',
    category: CATEGORY,
    title: 'The CDK stack, reviewed',
    tagline: 'Queue + DLQ + function + table, configured the way the Lambda page recommends',
    description: [
      'OrderWorkerStack wires the queue, dead-letter queue, function and table together. The lab reads its settings straight out of order-worker-stack.ts and reviews them against the rules the Lambda page teaches: visibility 6× the timeout, a DLQ with maxReceiveCount 5, partial batch responses, a log retention period, least privilege, X-Ray tracing and TLS-only queues.',
      'Compare it with the same stack written with the defaults (timeout raised to 30 s, queue left at its default). Each rule lights up green or red, and the resource graph shows what is missing.',
      'The stack has CDK assertion tests (order-worker-stack.test.ts) that pin these settings, and the live workflow deploys it to a sandbox account, sends a message and checks DynamoDB before tearing it down.',
    ],
    keyApis: ['SqsEventSource({ reportBatchItemFailures })', 'deadLetterQueue', 'RetentionDays.TWO_WEEKS', 'table.grant()'],
    useCases: ['A reviewable template for SQS workers', 'Infrastructure tests'],
    snippet: { lang: 'ts', name: 'samples/concepts/lambda/cdk/order-worker-stack.ts', code: excerpt(SOURCES.orderWorkerStack, 'const worker = new lambda.Function', 'worker.addEventSource') },
    inputs: [{ name: 'variant', label: 'Stack', type: 'select', default: 'the repo sample', options: ['the repo sample', 'defaults'] }],
    flow: [
      ['dev', 'repo', 'read order-worker-stack.ts'],
      ['repo', 'repo', 'extract settings'],
      ['repo', 'dev', 'review against the Lambda page'],
    ],
    actions: [
      { id: 'run', label: 'Review the stack', tone: 'accent', run: (i) => cdkStack(i) },
      { id: 'defaults', label: 'Do it wrong: ship the defaults', tone: 'ghost', run: (i) => cdkStack(i, { defaults: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Shipping an SQS worker with service defaults',
        symptom: 'Duplicates, a poison message that blocks batches, logs kept forever and a role that can scan every table.',
        why: 'Each default is reasonable alone; together they break most of the Lambda page’s rules.',
        fix: 'Start from the sample stack: derive visibility from the timeout, add a DLQ, enable ReportBatchItemFailures, set retention, grant one action.',
        avoid: 'Pin the settings with CDK assertion tests so a refactor can’t undo them.',
        source: { title: 'samples/concepts/lambda/cdk/order-worker-stack.test.ts', file: 'samples/concepts/lambda/cdk/order-worker-stack.test.ts' },
        reproduce: 'defaults',
      },
    ],
    visual: 'cdk',
    test: { action: 'run' },
  },
];
