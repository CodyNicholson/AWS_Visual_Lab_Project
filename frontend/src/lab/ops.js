// Lambda in production: VPC networking, recursive loops, least privilege and the settings that surprise
// the bill. The rules are the ones lambda.mdx documents (and links to the AWS docs for); the IAM
// demo evaluates the page's own least-privilege policy.
import { AwsError, Demo, bool, clamp, clampInt, oneOf, round } from './lab.js';
import { LAMBDA, fencedBlock } from '../kb/repo.js';

// ---- VPC networking -------------------------------------------------------------------------

export const PLACEMENTS = ['not attached to a VPC', 'private subnets', 'public subnet'];
export const ROUTES = ['nothing extra', 'gateway endpoint (S3, DynamoDB)', 'interface endpoint (PrivateLink)', 'NAT gateway'];
export const TARGETS = ['DynamoDB', 'S3', 'Secrets Manager', 'external HTTPS API', 'RDS database in the VPC'];

/** Can a function placed like this reach the target? Returns { ok, via, why }. */
export function reach(placement, route, target) {
  if (placement === PLACEMENTS[0]) {
    if (target === 'RDS database in the VPC') return { ok: false, why: 'the database is private to the VPC; attach the function to it' };
    return { ok: true, via: "Lambda's own network" };
  }
  // In a VPC (public subnet or not): Lambda's network interfaces never get public IPs
  if (target === 'RDS database in the VPC') return { ok: true, via: 'the VPC' };
  if (route === 'NAT gateway') return { ok: true, via: 'NAT gateway → internet gateway' };
  if (route === ROUTES[1] && (target === 'DynamoDB' || target === 'S3')) return { ok: true, via: 'gateway endpoint in the route table' };
  if (route === ROUTES[2] && target !== 'external HTTPS API') return { ok: true, via: 'interface endpoint (private IP in the subnet)' };
  const why = placement === 'public subnet' ? 'a public subnet does not give a Lambda function internet access' : 'no route out of the private subnet';
  return { ok: false, why };
}

const ROUTE_COST = {
  'nothing extra': 'free',
  'gateway endpoint (S3, DynamoDB)': 'no extra charge',
  'interface endpoint (PrivateLink)': 'hourly per AZ + per GB',
  'NAT gateway': 'hourly + per GB processed',
};

export function vpc(inputs, { publicSubnet = false } = {}) {
  const d = new Demo('vpc-networking');
  const placement = publicSubnet ? 'public subnet' : oneOf(inputs.placement, PLACEMENTS);
  const route = publicSubnet ? 'nothing extra' : oneOf(inputs.route, ROUTES);
  const target = publicSubnet ? 'DynamoDB' : oneOf(inputs.target, TARGETS);
  const timeoutS = 3;
  d.cmd(`function: ${placement}; extra route: ${route} (${ROUTE_COST[route]})`);
  const matrix = TARGETS.map((t) => ({ target: t, ...reach(placement, route, t) }));
  const call = d.attempt(`call ${target}`, () => {
    const r = reach(placement, route, target);
    if (!r.ok) throw new AwsError('Sandbox.Timedout', `Task timed out after ${timeoutS.toFixed(2)} seconds`, { why: r.why });
    return r;
  });
  if (call.ok) d.cmd(`→ connected via ${call.value.via}`);
  else d.cmd(`(${call.error.why}: the call hangs until the function times out)`);

  if (publicSubnet) {
    d.check('A public subnet without NAT or endpoints gives no route to DynamoDB', !call.ok, call.error?.message);
    const fixed = reach('private subnets', ROUTES[1], 'DynamoDB');
    d.cmd(`fix: private subnets + DynamoDB gateway endpoint → ${fixed.ok ? 'connected' : 'still failing'}`);
    d.check('A gateway endpoint fixes it at no extra charge (practice question lambda-003)', fixed.ok, fixed.via);
  } else {
    d.check(`Calling ${target} ${call.ok ? 'succeeds' : 'hangs until the timeout'}`, call.ok === reach(placement, route, target).ok, call.ok ? call.value.via : call.error.message);
    if (!call.ok) d.check('A missing route is a hang until the timeout, not an AccessDenied error', call.error.name === 'Sandbox.Timedout', call.error.message);
    d.check('Each target is reachable only through a matching route', matrix.every((m) => m.ok === reach(placement, route, m.target).ok), `${matrix.filter((m) => m.ok).length} of ${matrix.length} targets reachable from here`);
  }
  return d.result({ placement, route, target, matrix, ok: call.ok, cost: ROUTE_COST[route] });
}

// ---- Recursive loops -----------------------------------------------------------------------

export const LOOP_SOURCES = ['S3 bucket', 'SQS queue', 'SNS topic', 'EventBridge custom bus', 'DynamoDB table (stream)'];
const DETECTED = new Set(['S3 bucket', 'SQS queue', 'SNS topic', 'EventBridge custom bus']);
export const LOOP_LIMIT = 16;
const SIM_CAP = 120;

export function recursion(inputs, { sameResource = null } = {}) {
  const d = new Demo('recursive-loops');
  const source = oneOf(inputs.source, LOOP_SOURCES);
  const same = sameResource ?? inputs.writeTo !== 'a different resource';
  const killAt = bool(inputs.killSwitch) ? 40 : null;
  d.cmd(`trigger: ${source}; the function writes its output to ${same ? 'the same resource' : 'a different resource'}`);
  let count = 0;
  let stoppedBy = null;
  const series = [];
  while (count < SIM_CAP) {
    count += 1;
    series.push(count);
    if (!same) {
      stoppedBy = 'nothing to stop: the output does not trigger the function';
      break;
    }
    if (DETECTED.has(source) && count >= LOOP_LIMIT) {
      stoppedBy = `recursive loop detection (RecursiveInvocationException after ~${LOOP_LIMIT} invocations)`;
      break;
    }
    if (killAt && count >= killAt) {
      stoppedBy = 'PutFunctionConcurrency ReservedConcurrentExecutions=0 (every invocation is throttled)';
      break;
    }
  }
  if (!stoppedBy) stoppedBy = `still running when the simulation stopped at ${SIM_CAP}`;
  d.cmd(`→ ${count} invocations; stopped by ${stoppedBy}`);

  if (!same) {
    d.check('Writing to a different resource breaks the loop', count === 1, '1 invocation per event');
  } else if (DETECTED.has(source)) {
    d.check(`Lambda stops loops through ${source.split(' ')[0]} after about ${LOOP_LIMIT} invocations`, count === LOOP_LIMIT, `${count} invocations`);
  } else {
    d.check('Loops through DynamoDB are not detected', count > LOOP_LIMIT, `${count} invocations${killAt ? '' : ' and counting'}`);
    if (killAt) d.check('Reserved concurrency 0 is the emergency stop', count === killAt, stoppedBy);
  }
  return d.result({ source, same, count, series, stoppedBy, detected: DETECTED.has(source), limit: LOOP_LIMIT, cap: SIM_CAP });
}

// ---- Least privilege -----------------------------------------------------------------------

const ACCOUNT = '111122223333'; // the AWS documentation example account, as used on the Lambda page
export const ROLE_ARN = `arn:aws:sts::${ACCOUNT}:assumed-role/order-worker-role/order-worker`;
export const ACTIONS = ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:DeleteTable', 's3:GetObject', 'iam:CreateUser'];
export const RESOURCES = [`arn:aws:dynamodb:us-east-1:${ACCOUNT}:table/Orders`, `arn:aws:dynamodb:us-east-1:${ACCOUNT}:table/Customers`];

/** The least-privilege policy straight from lambda.mdx's "Security and cost notes". */
export const PAGE_POLICY = JSON.parse(fencedBlock(LAMBDA.body, 'json'));
export const ADMIN_POLICY = { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }] };

const glob = (pattern, value) => new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(value);
const list = (v) => (Array.isArray(v) ? v : [v]);

/** Identity-policy evaluation: an explicit Deny wins, then any Allow, otherwise an implicit deny. */
export function evaluate(policy, action, resource) {
  const matching = policy.Statement.filter((s) => list(s.Action).some((a) => glob(a, action)) && list(s.Resource).some((r) => glob(r, resource)));
  if (matching.some((s) => s.Effect === 'Deny')) return 'explicit deny';
  if (matching.some((s) => s.Effect === 'Allow')) return 'allow';
  return 'implicit deny';
}

export function accessDenied(action, resource) {
  return new AwsError(
    'AccessDeniedException',
    `User: ${ROLE_ARN} is not authorized to perform: ${action} on resource: ${resource} because no identity-based policy allows the ${action} action`,
  );
}

export function iam(inputs, { admin = false } = {}) {
  const d = new Demo('least-privilege');
  const policyName = admin ? 'AdministratorAccess' : oneOf(inputs.policy, ['least privilege (Lambda page)', 'AdministratorAccess']);
  const policy = policyName === 'AdministratorAccess' ? ADMIN_POLICY : PAGE_POLICY;
  const action = oneOf(inputs.action, ACTIONS);
  const resource = RESOURCES[inputs.resource === 'table/Customers' ? 1 : 0];
  d.cmd(`execution role policy: ${policyName}${policy === PAGE_POLICY ? ' (read from lambda.mdx)' : ''}`);
  const matrix = ACTIONS.flatMap((a) => RESOURCES.map((r) => ({ action: a, resource: r.split(':').pop(), decision: evaluate(policy, a, r) })));
  const call = d.attempt(`${action} on ${resource.split(':').pop()}`, () => {
    const decision = evaluate(policy, action, resource);
    if (decision !== 'allow') throw accessDenied(action, resource);
    return decision;
  });
  if (call.ok) d.cmd('→ allowed');
  const allowed = matrix.filter((m) => m.decision === 'allow').length;

  if (policy === PAGE_POLICY) {
    d.check('The page policy allows exactly one action on one table', allowed === 1 && evaluate(policy, 'dynamodb:PutItem', RESOURCES[0]) === 'allow', `${allowed} of ${matrix.length} combinations`);
    d.check('Anything else is an implicit deny', evaluate(policy, 'dynamodb:DeleteTable', RESOURCES[0]) === 'implicit deny', 'DeleteTable on Orders → AccessDeniedException');
  } else {
    d.check('AdministratorAccess allows everything the function could ever be tricked into doing', allowed === matrix.length, `${allowed} of ${matrix.length}, including DeleteTable and iam:CreateUser`);
    d.check('The page policy limits the blast radius to one action', ACTIONS.flatMap((a) => RESOURCES.map((r) => evaluate(PAGE_POLICY, a, r))).filter((x) => x === 'allow').length === 1, 'dynamodb:PutItem on table/Orders');
  }
  return d.result({ policyName, policy, matrix, action, resource, ok: call.ok, error: call.error?.message });
}

// ---- Cost surprises -------------------------------------------------------------------------

export const MEMORY_STEPS = [128, 256, 512, 1024, 1769, 3008, 5120, 10240];

/** Duration model: CPU-bound work speeds up with memory until 1 vCPU (single-threaded); I/O waits don't. */
export function durationMs(memoryMb, workload) {
  if (workload === 'I/O-bound') return 120;
  return round(1000 * (1769 / Math.min(memoryMb, 1769)), 0);
}

export function gbSeconds(memoryMb, ms, invocations) {
  return (memoryMb / 1024) * (ms / 1000) * invocations;
}

export function cost(inputs, { neverExpire = false } = {}) {
  const d = new Demo('cost-surprises');
  const memoryMb = clampInt(inputs.memoryMb, 128, 10240, 512);
  const workload = oneOf(inputs.workload, ['I/O-bound', 'CPU-bound']);
  const millions = clamp(inputs.invocationsM, 0.1, 100, 10);
  const logKb = clamp(inputs.logKb, 0, 20, 1);
  const months = clampInt(inputs.months, 1, 36, 12);
  const retention = neverExpire ? 'never expire' : oneOf(inputs.retention, ['2 weeks (CDK sample)', 'never expire']);
  const invocations = millions * 1e6;
  const curve = MEMORY_STEPS.map((m) => ({ memoryMb: m, ms: durationMs(m, workload), gbs: round(gbSeconds(m, durationMs(m, workload), invocations) / 1e6, 2) }));
  const chosen = { memoryMb, ms: durationMs(memoryMb, workload), gbs: round(gbSeconds(memoryMb, durationMs(memoryMb, workload), invocations) / 1e6, 2) };
  d.cmd(`${workload}, ${memoryMb} MB, ${millions}M invocations/month → ${chosen.ms} ms each, ${chosen.gbs}M GB-seconds/month`);

  const monthlyGb = (invocations * logKb) / 1024 / 1024;
  const stored = Array.from({ length: months }, (_, i) => ({
    month: i + 1,
    gb: round(retention === 'never expire' ? monthlyGb * (i + 1) : monthlyGb * (14 / 30), 2),
  }));
  d.cmd(`logs: ${round(monthlyGb, 2)} GB/month written; retention ${retention} → ${stored[stored.length - 1].gb} GB stored after ${months} months`);

  if (workload === 'I/O-bound') {
    const a = gbSeconds(512, durationMs(512, workload), 1);
    const b = gbSeconds(1024, durationMs(1024, workload), 1);
    d.check('For I/O-bound work, doubling memory doubles the bill', round(b / a, 2) === 2, 'duration stays 120 ms; billed GB-s scale with memory');
  } else {
    const a = gbSeconds(512, durationMs(512, workload), 1);
    const b = gbSeconds(1024, durationMs(1024, workload), 1);
    d.check('For CPU-bound work below 1 vCPU, more memory runs faster for about the same GB-s', Math.abs(b / a - 1) < 0.01, `512 MB: ${durationMs(512, workload)} ms, 1024 MB: ${durationMs(1024, workload)} ms`);
  }
  if (retention === 'never expire') {
    d.check('Without a retention period, stored logs grow every month', stored.length < 2 || stored[stored.length - 1].gb > stored[0].gb, `${stored[0].gb} GB → ${stored[stored.length - 1].gb} GB`);
    const capped = round(monthlyGb * (14 / 30), 2);
    d.check('With the sample’s 2-week retention it would stay flat', months < 2 || capped < stored[stored.length - 1].gb, `${capped} GB at any month instead`);
  } else {
    d.check('A retention period caps stored logs', stored.every((s) => s.gb === stored[0].gb), `${stored[0].gb} GB every month`);
  }
  return d.result({ curve, chosen, workload, stored, retention, monthlyGb: round(monthlyGb, 2), months });
}
