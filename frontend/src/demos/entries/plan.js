import { caseStudies, conceptMap, roadmap } from '../../lab/plan.js';
import { KB_DOMAINS } from '../../kb/repo.js';
import { CASE_STUDIES } from '../../kb/plan.js';

const CATEGORY = 'The plan and roadmap';

export default [
  {
    id: 'concept-map',
    category: CATEGORY,
    title: 'The concept map',
    tagline: '30 service pages in six domains that mirror the exam blueprints',
    description: [
      'The site gets one page per service, grouped into six domains: compute and containers, data and streaming, APIs and messaging, generative AI, security and identity, and observability and DevOps. site/src/data/domains.ts lists all 30; a page is live once its MDX file exists.',
      'Press the button to light up the map from the repository. AWS Lambda is the exemplar page; its related services show as "coming soon" until written. Decision guides (SQS vs SNS vs EventBridge vs Kinesis, Lambda vs Fargate vs ECS, SAM vs CDK vs CloudFormation, Secrets Manager vs Parameter Store) are planned for Phase 2.',
    ],
    keyApis: ['site/src/data/domains.ts', 'content/concepts/<domain>/<service>.mdx', 'related[]'],
    useCases: ['Seeing what exists', 'Picking the next page to write'],
    snippet: { lang: 'ts', name: 'site/src/data/domains.ts (excerpt)', code: `export const KB_DOMAINS: KbDomain[] = [\n${KB_DOMAINS.slice(0, 2).map((d) => `  {\n    slug: '${d.slug}',\n    title: '${d.title}',\n    examTags: [${d.examTags.map((t) => `'${t}'`).join(', ')}],\n    services: [${d.services.map((s) => `'${s.slug}'`).join(', ')}],\n  },`).join('\n')}\n  // … ${KB_DOMAINS.length - 2} more domains\n];` },
    inputs: [{ name: 'domain', label: 'Domain', type: 'select', default: 'all', options: ['all', ...KB_DOMAINS.map((d) => d.slug)] }],
    flow: [
      ['dev', 'repo', 'domains.ts + content/concepts/'],
      ['repo', 'repo', 'planned vs live, related pages'],
      ['repo', 'dev', 'the map'],
    ],
    actions: [
      { id: 'run', label: 'Draw the map', tone: 'accent', run: (i) => conceptMap(i) },
      { id: 'unknown', label: 'Do it wrong: a page for an unplanned slug', tone: 'ghost', run: (i) => conceptMap(i, { unknownService: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Adding a page without adding the service to domains.ts',
        symptom: 'error   content/concepts/…/aws-lambda.mdx: service "aws-lambda" isn\'t in site/src/data/domains.ts',
        why: 'domains.ts is the single list of planned services; slugs must match it and the file name.',
        fix: 'Use the slug from domains.ts (or add the service there first) and name the file <slug>.mdx in its domain folder.',
        avoid: 'Start every new page from docs/authoring.md step 1.',
        source: { title: 'docs/authoring.md', file: 'docs/authoring.md' },
        reproduce: 'unknown',
      },
    ],
    visual: 'conceptMap',
    test: { action: 'run' },
  },
  {
    id: 'case-studies',
    category: CATEGORY,
    title: 'Six case studies',
    tagline: 'End-to-end scenarios that, together, touch every DVA-C03 domain',
    description: [
      'Case studies combine several services and show the decisions and trade-offs. Each one has the same structure: business context, an architecture diagram with the data path drawn first, a decision log, a build walkthrough, a "what went wrong" section diagnosed with CloudWatch Logs Insights and X-Ray, a cost estimate, and 5–8 exam-style questions.',
      'Pick a case study to watch its data path animate. Case study 1 (the serverless order API) is what the order worker sample and this site’s own hosting are building toward. None is written yet; two are part of Phase 1.',
    ],
    keyApis: ['content/case-studies/<slug>.mdx', 'decision log', 'what went wrong'],
    useCases: ['Seeing services work together', 'Scenario questions'],
    snippet: { lang: 'text', name: 'aws-vl-plan.md: Case studies', code: CASE_STUDIES.map((c) => `${c.n}. ${c.title}\n   ${c.services.join(' → ')}\n   ${c.exams.join(' · ')}`).join('\n') },
    inputs: [{ name: 'study', label: 'Case study', type: 'select', default: '1', options: CASE_STUDIES.map((c) => String(c.n)) }],
    flow: [
      ['apigw', 'lambda', 'accept order'],
      ['lambda', 'sqs', 'enqueue'],
      ['sqs', 'lambda', 'worker batch'],
      ['lambda', 'ddb', 'record order'],
      ['lambda', 'cw', 'traces + logs'],
    ],
    actions: [{ id: 'run', label: 'Show the data path', tone: 'accent', run: (i) => caseStudies(i) }],
    pitfalls: [
      {
        mistake: 'Case studies that only show the happy path',
        symptom: 'Readers can build it but can’t debug it; scenario questions feel unfamiliar.',
        why: 'Real systems fail through throttling, poison messages, prompt injection and leaked keys.',
        fix: 'Write the "what went wrong" section with two or three realistic failures and how they were diagnosed.',
        avoid: 'Follow the seven-part structure for every case study.',
        source: { title: 'aws-vl-plan.md: Structure of every case study', file: 'aws-vl-plan.md' },
      },
    ],
    visual: 'caseStudies',
    test: { action: 'run' },
  },
  {
    id: 'roadmap',
    category: CATEGORY,
    title: 'Roadmap and progress',
    tagline: 'Four phases over 26 weeks; Phase 1 progress measured from the repo',
    description: [
      'Phase 0 Discovery (weeks 1–2): interviews, a competitive scan, and the DVA-C03 guide turned into the canonical objective list. Phase 1 Foundation (3–10): the site skeleton and CI, 15 DVA-C03 pages, a hub with 150 questions and 2 case studies. Phase 2 Breadth (11–18): 15 more pages, AIP-C01 and DOP-C02 hubs, decision guides, sign-in. Phase 3 Intelligence (19–26): a KB assistant on Bedrock, adaptive quizzes, search by error message, AI security labs.',
      'Slide through the weeks. The progress bars are measured from the repository right now: pages, questions and case studies against the Phase 1 targets, and the v1 success criteria.',
    ],
    keyApis: ['Phase gates', 'v1 success criteria'],
    useCases: ['Planning', 'Status reporting'],
    snippet: { lang: 'text', name: 'aws-vl-plan.md: Roadmap', code: 'Phase           Weeks  Gate to exit\n0 Discovery     1–2    Scope agreed\n1 Foundation    3–10   Every DVA-C03 task statement mapped to a page and practice questions\n2 Breadth       11–18  30 pages and 6 case studies live\n3 Intelligence  19–26  —' },
    inputs: [{ name: 'week', label: 'Week', type: 'number', default: 3, min: 1, max: 26 }],
    flow: [
      ['dev', 'repo', 'count pages, questions, case studies'],
      ['repo', 'repo', 'compare with the phase targets'],
      ['repo', 'dev', 'progress + gate status'],
    ],
    actions: [{ id: 'run', label: 'Measure progress', tone: 'accent', run: (i) => roadmap(i) }],
    pitfalls: [
      {
        mistake: 'Measuring output instead of outcome',
        symptom: '40 pages shipped, but nobody knows whether readers pass the exam or find answers faster.',
        why: 'Page and question counts are easy to measure; outcomes need telemetry and surveys.',
        fix: 'Add self-reported pass rate, time to find an answer, return visits and quiz score improvement.',
        avoid: 'Define outcome metrics before Phase 2 starts.',
        source: { title: 'aws-vl-plan.md: Gaps in the analysis', file: 'aws-vl-plan.md' },
      },
    ],
    visual: 'roadmap',
    test: { action: 'run' },
  },
];
