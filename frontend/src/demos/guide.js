// The overview page: what the AWS Dev KB is, what is in this repository, how to work with it (typed
// out in an animated terminal), and an honest look at the approach. antiPatterns and troubleshooting
// also feed the #pitfalls page, next to every demo's own pitfalls.
import { CONCEPTS, DVA, QUESTIONS, KB_DOMAINS, LAMBDA } from '../kb/repo.js';
import { AUDIENCE, IMPROVEMENTS, PILLARS, PLAN_SOURCES, PURPOSE, REVIEW_GAPS, SITE_STACK } from '../kb/plan.js';

const plannedPages = KB_DOMAINS.reduce((n, d) => n + d.services.length, 0);

export const OVERVIEW = {
  title: 'The AWS Dev KB, explained',
  intro: `${PURPOSE} This lab walks through everything in the repository: the DVA-C03 exam it is built around, AWS Lambda in depth (the exemplar page), the tested order-worker sample, how the site is hosted and shipped, the content pipeline that keeps it honest, and the plan ahead.`,
  facts: [
    ['Core exam', `${DVA.code} (from Dec 1, 2026)`],
    ['Concept pages', `${CONCEPTS.length} of ${plannedPages} live`],
    ['Practice questions', String(QUESTIONS.length)],
    ['Lambda page verified', String(LAMBDA.data.last_verified)],
  ],
  mentalModel: [
    'Three pillars: ' + PILLARS.map((p) => `${p.name} (${p.text.charAt(0).toLowerCase()}${p.text.slice(1, -1)})`).join('; ') + '.',
    `Audience: ${AUDIENCE.join('; ')}.`,
    'Content is code: MDX pages with typed frontmatter, YAML questions and tested samples, all checked in CI, so a page can’t claim something its sample doesn’t do.',
    'Every limit and every mistake links to the AWS doc it came from, and every page shows when it was last verified.',
    'Nothing here calls real AWS. The demos run the repository’s own code (coverage, freshness, the order-worker handler, the CloudFront function) and simulations of the behaviour the KB documents; illustrative timings are labelled as such.',
  ],
  repoLayout: [
    ['site/', 'Astro site: layouts, components, React islands (quiz, practice exam, mistakes filter)'],
    ['content/', 'Concept pages (MDX), decision guides, case studies, exam facts, objectives and questions (YAML)'],
    ['samples/', 'Code shown on pages, tested in CI: Python boto3, TypeScript SDK v3, CDK'],
    ['infra/', 'CDK app: private S3 + CloudFront hosting, GitHub OIDC roles, sandbox budget alarms'],
    ['scripts/', 'Content checks, coverage report, link check, exam-guide diff, stale pages, Docker helpers'],
    ['docs/', 'Authoring guide and question-writing policy'],
    ['.github/', 'CI, deploy, weekly live sample tests, weekly freshness job'],
    ['frontend/', 'This visual lab (React + Vite), served by nginx behind the Cloudflare tunnel'],
  ],
  steps: [
    {
      title: 'Install and check the content',
      text: 'Everything runs inside Docker, so you don’t need Node or Python installed. scripts/npm.sh runs a command in a node:24-alpine container.',
      commands: ['scripts/npm.sh npm ci', 'scripts/npm.sh npm run check:content', 'scripts/npm.sh npm run typecheck'],
    },
    {
      title: 'Test the samples and the infrastructure',
      text: 'TypeScript and CDK sample tests, infra assertion tests, and the Python samples with moto.',
      commands: ['scripts/npm.sh npm test', 'scripts/pytest.sh'],
    },
    {
      title: 'Build and preview the site',
      text: 'The static site and its Pagefind search index land in site/dist.',
      commands: ['scripts/npm.sh npm run build', 'scripts/npm.sh npm run check:links', 'DOCKER_ARGS="-p 127.0.0.1:4321:4321" scripts/npm.sh npm run dev -w site -- --host'],
    },
    {
      title: 'Run this visual lab',
      text: 'One nginx container serves the built React app. The host port comes from FRONTEND_HOST_PORT in the git-ignored .env and is bound to 127.0.0.1 only.',
      commands: ['cp .env.example .env   # then set FRONTEND_HOST_PORT', 'docker network create tunnel-net   # once', 'docker compose up -d --build'],
    },
    {
      title: 'Add a concept page',
      text: 'Copy the Lambda exemplar, keep its nine blocks, put tested samples in samples/concepts/<service>/, and add at least three questions.',
      file: { name: 'content/concepts/<domain>/<service>.mdx', lang: 'yaml', code: '---\ntitle: Amazon SQS\nservice: sqs\ndomain: apis-and-messaging\nexams: [DVA-C03]\nexam_domains: [DVA-C03-D1]\ntasks: []\ndifficulty: associate\nlast_verified: 2026-10-25\nlimits: [...]\nmistakes: [...]   # 5–8, each with a source\n---\n\n## When to use it / when not to\n...' },
    },
  ],
  pros: [
    'Code on pages is the code CI tests, so samples can’t drift.',
    'Every limit and mistake is sourced and dated; stale pages are flagged automatically.',
    'Static hosting on S3 + CloudFront costs almost nothing and is itself a worked example.',
    'No AWS keys anywhere: GitHub Actions assumes roles through OIDC.',
    'Exam coverage is computed on every build, so gaps show up immediately.',
  ],
  cons: [
    'Timing: the DVA-C03 task statements publish on Oct 27, 2026; content before then is built on a summary.',
    'Competition: Skill Builder and paid courses cover the same exams; the KB has to win on decisions, mistakes and scenarios.',
    'Effort: 40+ pages with tested code in two languages needs named owners.',
    'Live sample tests need a sandbox AWS account with budget alarms before they run.',
  ],
  whenToUse: [
    'You build on AWS and want the decision, the code and the mistakes on one page.',
    'You are preparing for DVA-C03 and want questions that explain every option.',
    'You onboard engineers onto an AWS codebase.',
  ],
  whenNotToUse: [
    'You need a complete video course: use AWS Skill Builder.',
    'You need live exam questions: nobody may share them, and this KB never will.',
    'You need RAG design or model selection in depth: that is AIP-C01 material, planned for Phase 2.',
  ],
  alternatives: [
    ['AWS documentation', 'The source of truth the KB links to; complete but not organised around decisions or mistakes'],
    ['AWS Skill Builder', 'Official courses and practice exams; less focus on common mistakes and tested code'],
    ['Tutorials Dojo and similar', 'Large practice banks and cheat sheets; not tied to tested samples'],
  ],
  siteStack: SITE_STACK,
  reviewGaps: REVIEW_GAPS,
  improvements: IMPROVEMENTS,
  sources: PLAN_SOURCES,
  // How NOT to use AWS: misuses that cut across services (from the plan and the Lambda page).
  antiPatterns: [
    { dont: 'Long-lived access keys in code, environment variables or CI secrets', why: 'Keys leak to Git and are hard to rotate.', instead: 'IAM roles for Lambda, ECS tasks and EC2; OIDC roles for CI; IAM Identity Center for people.' },
    { dont: 'A public S3 bucket to host a website', why: 'Anyone can read every object over plain HTTP, around the CDN and its security headers.', instead: 'Block Public Access + CloudFront with origin access control (see the S3 + CloudFront demo).' },
    { dont: 'A DynamoDB partition key with low cardinality (status, date)', why: 'Hot partitions, throttled writes and uneven cost: the table was designed like a relational table.', instead: 'List access patterns first and design keys (often single-table) around them.' },
    { dont: 'Lambda for long-running or steady, round-the-clock work', why: 'The 15-minute limit, and constant load is often cheaper on containers.', instead: 'ECS on Fargate, or Step Functions to split the work into steps.' },
    { dont: 'AdministratorAccess on application roles', why: 'Any bug or compromised dependency can do anything in the account.', instead: 'One role per function, scoped to the actions and resources it uses.' },
    { dont: 'Attaching functions to a VPC "for security"', why: 'Calls to AWS APIs hang without endpoints or NAT, and it adds cost.', instead: 'Attach only for private resources, with gateway or interface endpoints.' },
    { dont: 'Log groups and resources created by hand without retention or budgets', why: 'Logs are kept, and billed, forever; a forgotten resource runs all month.', instead: 'Create everything in IaC with retention periods, and put budget alarms on sandbox accounts.' },
  ],
  // Errors people hit outside any single demo: credentials, permissions, networking, deploys.
  troubleshooting: [
    {
      mistake: 'Running SDK code with no credentials',
      symptom: 'botocore.exceptions.NoCredentialsError: Unable to locate credentials',
      why: 'No role, profile or environment credentials are available where the code runs.',
      fix: 'Locally: aws sso login / a named profile. In AWS: attach an execution or task role. In CI: assume a role through OIDC.',
      avoid: 'Never paste keys into code; rely on the default credential chain.',
    },
    {
      mistake: 'A role without the permission the code needs',
      symptom: 'AccessDeniedException: User: arn:aws:sts::111122223333:assumed-role/… is not authorized to perform: dynamodb:PutItem on resource: … because no identity-based policy allows the dynamodb:PutItem action',
      why: 'The identity policy doesn’t allow that action on that resource (or a Deny or permissions boundary blocks it).',
      fix: 'Add exactly that action on that resource ARN to the role; the error message names both.',
      avoid: 'Use CDK grants (table.grant(fn, "dynamodb:PutItem")) and test the unhappy path.',
    },
    {
      mistake: 'A call that hangs until the function times out',
      symptom: 'Task timed out after 3.00 seconds',
      why: 'Either the default 3 s timeout is too short, or a VPC-attached function has no route to the service.',
      fix: 'Check REPORT Duration against the timeout; for VPC functions add gateway/interface endpoints or a NAT gateway.',
      avoid: 'Set timeouts from load tests and set client timeouts below the function timeout.',
    },
    {
      mistake: 'Writes throttled under load',
      symptom: 'ProvisionedThroughputExceededException',
      why: 'A hot partition key or under-provisioned capacity.',
      fix: 'Spread writes over more partition key values, use on-demand capacity, and retry with backoff (the SDKs do).',
      avoid: 'Design keys from access patterns before building the table.',
    },
    {
      mistake: 'API Gateway returns 502 for a Lambda proxy integration',
      symptom: '{"message": "Internal server error"} and "Malformed Lambda proxy response" in the execution logs',
      why: 'The function returned something other than { statusCode, headers, body } with body as a string, or it threw.',
      fix: 'Return the proxy response shape with a string body; catch errors and return a 4xx/5xx yourself.',
      avoid: 'Unit-test the handler’s response shape.',
    },
    {
      mistake: 'Deploying a CDK stack with assets to a fresh account',
      symptom: 'This stack uses assets, so the toolkit stack must be deployed to the environment (Run "cdk bootstrap aws://<account>/<region>")',
      why: 'CDK needs its bootstrap bucket and roles in each account and Region.',
      fix: 'Run cdk bootstrap for that account and Region once, then deploy again.',
      avoid: 'Bootstrap every account (including the sandbox) as part of account setup, as the README describes.',
    },
    {
      mistake: 'GitHub Actions can’t assume the deploy role',
      symptom: 'Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity',
      why: 'The job lacks permissions: id-token: write, or the token’s sub (repo, environment) doesn’t match the trust policy.',
      fix: 'Add id-token: write and run the job in the environment the role trusts.',
      avoid: 'Bind each role to one repository and one GitHub environment.',
    },
  ],
};
