import { ACTIONS, LOOP_SOURCES, PAGE_POLICY, PLACEMENTS, ROUTES, TARGETS, cost, iam, recursion, vpc } from '../../lab/ops.js';
import { LAMBDA, sectionsOf } from '../../kb/repo.js';
import { kbMistake } from '../kb-pitfalls.js';

const CATEGORY = 'Lambda in production';
const DOCS = 'https://docs.aws.amazon.com/lambda/latest/dg';
const securityNotes = sectionsOf(LAMBDA.body).find((s) => s.title === 'Security and cost notes')?.text || '';

export default [
  {
    id: 'vpc-networking',
    category: CATEGORY,
    title: 'VPC networking',
    tagline: 'Attach to a VPC only for private resources, and give it a route out',
    description: [
      'A VPC-attached function can only reach what the VPC can reach. Attach a function to a VPC only when it needs private resources such as an RDS database or ElastiCache. When you do, use private subnets and add VPC endpoints for the AWS services it calls.',
      'Choose where the function runs and which route the VPC has, then call a target. The grid shows every target at once: green connects, red hangs. A missing route doesn’t return an error; the call simply waits until the function times out.',
      'A gateway endpoint (S3, DynamoDB) has no extra charge. Interface endpoints (PrivateLink) cover other AWS services for an hourly fee; only a NAT gateway reaches the public internet. A public subnet does not give a Lambda function internet access.',
    ],
    keyApis: ['VpcConfig.SubnetIds', 'Gateway VPC endpoint', 'Interface VPC endpoint', 'NAT gateway'],
    useCases: ['Functions that talk to RDS or ElastiCache', 'Private access to AWS APIs'],
    snippet: { lang: 'ts', name: 'CDK', code: "const vpc = new ec2.Vpc(this, 'Vpc', { natGateways: 0 });\n// Free, private routes to DynamoDB and S3 from the private subnets\nvpc.addGatewayEndpoint('Dynamo', { service: ec2.GatewayVpcEndpointAwsService.DYNAMODB });\nvpc.addGatewayEndpoint('S3', { service: ec2.GatewayVpcEndpointAwsService.S3 });\n// Other AWS APIs need interface endpoints (PrivateLink)\nvpc.addInterfaceEndpoint('Secrets', { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER });\n\nnew lambda.Function(this, 'Fn', { vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, /* … */ });" },
    inputs: [
      { name: 'placement', label: 'Function placement', type: 'select', default: PLACEMENTS[1], options: PLACEMENTS },
      { name: 'route', label: 'Extra route', type: 'select', default: ROUTES[1], options: ROUTES },
      { name: 'target', label: 'Call', type: 'select', default: 'DynamoDB', options: TARGETS },
    ],
    flow: [
      ['lambda', 'lambda', 'ENI in a private subnet'],
      ['lambda', 'ddb', 'route table → gateway endpoint'],
      ['ddb', 'lambda', 'response'],
    ],
    actions: [
      { id: 'run', label: 'Make the call', tone: 'accent', run: (i) => vpc(i) },
      { id: 'public', label: 'Do it wrong: public subnet, no route', tone: 'ghost', run: (i) => vpc(i, { publicSubnet: true }), flow: () => [['lambda', 'lambda', 'ENI in a public subnet (no public IP)'], ['lambda', 'ddb', 'no route…'], ['lambda', 'cw', 'Task timed out after 3.00 seconds']] },
    ],
    pitfalls: [
      kbMistake('Function attached to a VPC with no route', {
        avoid: 'Only attach to a VPC when needed; when you do, add the endpoints first and test every downstream call.',
        reproduce: 'public',
      }),
    ],
    visual: 'vpc',
    test: { action: 'run' },
  },
  {
    id: 'recursive-loops',
    category: CATEGORY,
    title: 'Recursive loops',
    tagline: 'A function that writes to its own trigger runs up the bill in minutes',
    description: [
      'If an S3-triggered function writes its output to the same bucket, or an SQS consumer re-sends to its own queue, every invocation triggers the next. Invocations and cost spike and the function can use up the account’s concurrency.',
      'Pick a trigger and where the function writes. The counter climbs with each invocation. Lambda’s recursive loop detection stops loops through SQS, S3, SNS and EventBridge custom buses after about 16 invocations, but not loops through services like DynamoDB; for those, setting reserved concurrency to 0 is the emergency stop.',
      'The real fix is design: write to a different bucket, prefix or queue.',
    ],
    keyApis: ['RecursiveInvocationException', 'RecursiveLoop setting', 'ReservedConcurrentExecutions=0'],
    useCases: ['S3 processing pipelines', 'Queue re-drivers', 'Stream handlers'],
    snippet: { lang: 'bash', name: 'Emergency stop', code: '# Throttle every invocation of a runaway function right now\naws lambda put-function-concurrency --function-name thumbnailer --reserved-concurrent-executions 0\n\n# then fix the design: output to a different bucket or prefix\n#   s3://uploads/  →  function  →  s3://thumbnails/' },
    inputs: [
      { name: 'source', label: 'Trigger', type: 'select', default: LOOP_SOURCES[0], options: LOOP_SOURCES },
      { name: 'writeTo', label: 'Function writes to', type: 'select', default: 'the same resource', options: ['the same resource', 'a different resource'] },
      { name: 'killSwitch', label: 'Set reserved concurrency to 0 at invocation 40', type: 'checkbox', default: true },
    ],
    flow: [
      ['s3', 'lambda', 'ObjectCreated'],
      ['lambda', 's3', 'PutObject to the same bucket'],
      ['s3', 'lambda', 'ObjectCreated again…'],
      ['lambda', 'lambda', 'loop detected after ~16'],
    ],
    actions: [
      { id: 'run', label: 'Trigger it', tone: 'accent', run: (i) => recursion(i) },
      { id: 'dynamodb', label: 'Do it wrong: loop through DynamoDB', tone: 'ghost', run: (i) => recursion({ ...i, source: LOOP_SOURCES[4] }, { sameResource: true }), flow: () => [['ddb', 'lambda', 'stream record'], ['lambda', 'ddb', 'UpdateItem on the same table'], ['ddb', 'lambda', 'stream record again… (not detected)'], ['lambda', 'cw', 'Invocations climbing']] },
    ],
    pitfalls: [
      kbMistake('Function writes back to the resource that triggers it', {
        avoid: 'Use separate input and output resources, and alarm on Invocations for event-driven functions.',
        reproduce: 'dynamodb',
      }),
    ],
    visual: 'recursion',
    test: { action: 'run' },
  },
  {
    id: 'least-privilege',
    category: CATEGORY,
    title: 'Execution role and least privilege',
    tagline: 'The role decides what the function can do; scope it to one action on one table',
    description: [
      'Give each function its own execution role with only the actions it calls, scoped to the resources it touches. The order worker can only put items into one table. Lambda supplies the role’s temporary credentials automatically, so never put access keys in environment variables.',
      'Pick a policy, an action and a table. The lab evaluates the policy (explicit Deny wins, then Allow, otherwise an implicit deny) and the matrix shows every combination. The least-privilege policy is read straight from the Lambda page.',
      'The execution role controls what the function can do. The function’s resource-based policy controls who can invoke it; it can’t grant the function access to anything.',
    ],
    keyApis: ['execution role', 'AccessDeniedException', 'resource-based policy', 'table.grant()'],
    useCases: ['Limiting the blast radius of a bug', 'Passing a security review'],
    snippet: { lang: 'json', name: 'lambda.mdx: least-privilege policy', code: JSON.stringify(PAGE_POLICY, null, 2) },
    inputs: [
      { name: 'policy', label: 'Execution role policy', type: 'select', default: 'least privilege (Lambda page)', options: ['least privilege (Lambda page)', 'AdministratorAccess'] },
      { name: 'action', label: 'Action', type: 'select', default: 'dynamodb:DeleteTable', options: ACTIONS },
      { name: 'resource', label: 'Resource', type: 'select', default: 'table/Orders', options: ['table/Orders', 'table/Customers'] },
    ],
    flow: [
      ['lambda', 'sts', 'role credentials (automatic)'],
      ['lambda', 'ddb', 'DeleteTable (signed with the role)'],
      ['ddb', 'sts', 'evaluate the identity policy'],
      ['ddb', 'lambda', 'AccessDeniedException'],
    ],
    actions: [
      { id: 'run', label: 'Make the call', tone: 'accent', run: (i) => iam(i) },
      { id: 'admin', label: 'Do it wrong: AdministratorAccess', tone: 'ghost', run: (i) => iam(i, { admin: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Attaching AdministratorAccess (or dynamodb:*) "for simplicity"',
        symptom: 'Everything works, until a bug or a compromised dependency deletes a table or creates IAM users.',
        why: 'The role is the function’s identity; whatever it allows, any code in the function can do.',
        fix: 'Grant only the actions the code calls on the resources it touches; CDK’s table.grant(fn, "dynamodb:PutItem") does this.',
        avoid: 'Review generated policies (cdk synth) and test that an unexpected action returns AccessDeniedException.',
        source: { title: 'Defining Lambda function permissions with an execution role', url: `${DOCS}/lambda-intro-execution-role.html` },
        reproduce: 'admin',
      },
      {
        mistake: 'Long-lived access keys in code or environment variables',
        symptom: 'Keys leak to Git and are hard to rotate.',
        why: 'Tutorials paste aws configure credentials into code.',
        fix: 'Use IAM roles for Lambda, ECS tasks and EC2, and IAM Identity Center for people; rotate and delete any leaked key now.',
        avoid: 'Keep secrets in Secrets Manager or Parameter Store and fetch them at Init.',
        source: { title: 'aws-vl-plan.md: Common-mistakes format', file: 'aws-vl-plan.md' },
      },
      {
        mistake: 'Granting access through the function’s resource-based policy',
        symptom: 'The function still gets AccessDeniedException from DynamoDB.',
        why: 'A resource-based policy on the function controls who can invoke it, not what it can call (practice question lambda-007).',
        fix: 'Add the permission to the execution role instead.',
        avoid: 'Remember the two directions: execution role = outbound, resource-based policy = inbound.',
        source: { title: 'Lambda execution role', url: `${DOCS}/lambda-intro-execution-role.html` },
      },
    ],
    visual: 'iam',
    test: { action: 'run' },
  },
  {
    id: 'cost-surprises',
    category: CATEGORY,
    title: 'What surprises the bill',
    tagline: 'Recursive loops, idle provisioned concurrency, logs kept forever, oversized memory',
    description: [
      'Lambda bills duration in proportion to memory (GB-seconds). For I/O-bound work that waits on DynamoDB or HTTP, more memory doesn’t make it faster, so doubling memory doubles the bill. For CPU-bound work, more memory adds CPU and the function finishes sooner, up to the point where it can’t use more.',
      'Pick a workload and memory size: the curve shows GB-seconds for every memory step. Then look at the logs: a log group created without a retention period keeps logs, and bills for them, forever. The CDK sample sets two weeks.',
      'Measure with the Max Memory Used field in the REPORT log line before you size up, or use AWS Lambda Power Tuning. Provisioned concurrency is billed while configured, whether or not it is used.',
    ],
    keyApis: ['GB-seconds', 'REPORT Max Memory Used', 'logs.RetentionDays', 'Lambda Power Tuning'],
    useCases: ['Right-sizing memory', 'Keeping log storage flat'],
    snippet: { lang: 'markdown', name: 'lambda.mdx: Security and cost notes', code: securityNotes.slice(securityNotes.indexOf('**What surprises the bill:**')) },
    inputs: [
      { name: 'workload', label: 'Workload', type: 'select', default: 'I/O-bound', options: ['I/O-bound', 'CPU-bound'] },
      { name: 'memoryMb', label: 'Memory (MB)', type: 'number', default: 1024, min: 128, max: 10240 },
      { name: 'invocationsM', label: 'Invocations / month (millions)', type: 'number', default: 10, min: 0.1, max: 100, step: 0.1 },
      { name: 'logKb', label: 'Log KB per invocation', type: 'number', default: 1, min: 0, max: 20 },
      { name: 'months', label: 'Months', type: 'number', default: 12, min: 1, max: 36 },
      { name: 'retention', label: 'Log retention', type: 'select', default: '2 weeks (CDK sample)', options: ['2 weeks (CDK sample)', 'never expire'] },
    ],
    flow: [
      ['lambda', 'lambda', 'duration × memory = GB-s'],
      ['lambda', 'cw', 'log lines every invocation'],
      ['cw', 'cw', 'retention: 14 days vs forever'],
    ],
    actions: [
      { id: 'run', label: 'Estimate', tone: 'accent', run: (i) => cost(i) },
      { id: 'never', label: 'Do it wrong: logs never expire', tone: 'ghost', run: (i) => cost(i, { neverExpire: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Log groups without a retention period',
        symptom: 'CloudWatch Logs storage grows every month and never comes down.',
        why: 'A log group created without a retention period keeps logs forever.',
        fix: 'Set retention on every log group (the CDK sample uses logs.RetentionDays.TWO_WEEKS); existing groups can be updated with put-retention-policy.',
        avoid: 'Create the log group in IaC with the function, never let it be auto-created.',
        source: { title: 'lambda.mdx: What surprises the bill', file: 'content/concepts/compute-and-containers/lambda.mdx' },
        reproduce: 'never',
      },
      {
        mistake: 'Raising memory "to be safe"',
        symptom: 'Duration barely changes but the bill doubles.',
        why: 'Duration is billed in proportion to memory; I/O-bound functions don’t get faster.',
        fix: 'Read Max Memory Used from the REPORT line and run Power Tuning; pick the cheapest size that meets latency.',
        avoid: 'Size memory from measurements, per function.',
        source: { title: 'Lambda best practices', url: `${DOCS}/best-practices.html` },
      },
    ],
    visual: 'cost',
    test: { action: 'run' },
  },
];
