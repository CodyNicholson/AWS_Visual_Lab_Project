// Every lab demo in one place: what it teaches, how a request flows between the AWS services involved
// (drives the animated diagram), which buttons it has, and which action the "Run all" suite uses.
// Flow steps are [from, to, label]; from === to means work done inside that node. Each action's
// run(inputs) executes in the browser and returns a DemoResult (see src/lab/lab.js).
import exam from './entries/exam.js';
import lambda from './entries/lambda.js';
import ops from './entries/ops.js';
import worker from './entries/worker.js';
import hosting from './entries/hosting.js';
import pipeline from './entries/pipeline.js';
import plan from './entries/plan.js';

/** The participants a flow can show. Colors are CSS variables defined in App.css. */
export const NODE_META = {
  dev: { label: 'You', sub: 'reader / developer', color: 'var(--n-dev)' },
  gh: { label: 'GitHub', sub: 'repo + Actions', color: 'var(--n-gh)' },
  docs: { label: 'AWS docs', sub: 'exam guides', color: 'var(--n-docs)' },
  repo: { label: 'KB repo', sub: 'content/ samples/', color: 'var(--n-repo)' },
  cf: { label: 'CloudFront', sub: 'CDN + function', color: 'var(--n-cf)' },
  apigw: { label: 'API Gateway', sub: 'sync caller', color: 'var(--n-apigw)' },
  sts: { label: 'IAM / STS', sub: 'roles + policies', color: 'var(--n-iam)' },
  sqs: { label: 'SQS', sub: 'queue + DLQ', color: 'var(--n-sqs)' },
  lambda: { label: 'Lambda', sub: 'function', color: 'var(--n-lambda)' },
  ddb: { label: 'DynamoDB', sub: 'Orders table', color: 'var(--n-ddb)' },
  s3: { label: 'S3', sub: 'bucket', color: 'var(--n-s3)' },
  cw: { label: 'CloudWatch', sub: 'logs, alarms, budgets', color: 'var(--n-cw)' },
};

/** Left-to-right order of the participants in every diagram. */
export const NODE_ORDER = ['dev', 'gh', 'docs', 'repo', 'cf', 'apigw', 'sts', 's3', 'sqs', 'lambda', 'ddb', 'cw'];

export function nodesFor(flow) {
  const used = new Set(flow.flatMap(([from, to]) => [from, to]));
  return NODE_ORDER.filter((id) => used.has(id));
}

export const DEMOS = [...exam, ...lambda, ...ops, ...worker, ...hosting, ...pipeline, ...plan];

export const CATEGORIES = [...new Set(DEMOS.map((d) => d.category))];
