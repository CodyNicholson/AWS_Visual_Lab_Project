// The project plan (aws-vl-plan.md) as data. The plan is prose, so it is transcribed here rather than
// parsed; exam facts that the previous session re-verified (see exam.yaml) override the plan where they
// disagree, and the disagreement itself is shown in the lab (DVA-C02 → C03 weights).

export const PURPOSE =
  'One place to learn, look up, and practise AWS software development: what a service is, when to pick it, how to call it from code, and where people go wrong.';

export const AUDIENCE = [
  'Working developers who need a fast reference while building on AWS',
  'Exam candidates preparing for DVA-C03, AIP-C01, DOP-C02 and related certifications',
  'Team leads onboarding engineers onto an AWS codebase',
];

export const PILLARS = [
  { name: 'Concept pages', text: 'One page per service or cross-cutting concept, each with explanation, code, and common mistakes.' },
  { name: 'Exam prep', text: 'Per-certification hubs that link objectives to concept pages, plus quizzes, flashcards and practice exams.' },
  { name: 'Case studies', text: 'End-to-end scenarios that combine several services and show the decisions and trade-offs.' },
];

/** v1 success criteria. `measure` is filled from the repository by the roadmap demo. */
export const SUCCESS_CRITERIA = [
  { id: 'tasks', text: '100% of DVA-C03 task statements mapped to at least one concept page and five practice questions' },
  { id: 'pages', text: '40+ concept pages live, each passing the page template checklist', target: 40 },
  { id: 'cases', text: '6 case studies with working reference code in a public repo', target: 6 },
  { id: 'fresh', text: 'Every page shows a "last verified" date no older than 90 days' },
];

export const CERTIFICATIONS = [
  { code: 'DVA-C03', name: 'Developer – Associate', level: 'Associate', role: 'Core developer track; replaces DVA-C02 Dec 1, 2026', depth: 'Full', core: true },
  { code: 'AIP-C01', name: 'Generative AI Developer – Professional', level: 'Professional', role: 'Bedrock, RAG, agents, guardrails in production', depth: 'Full' },
  { code: 'DOP-C02', name: 'DevOps Engineer – Professional', level: 'Professional', role: 'CI/CD, IaC, monitoring, incident response', depth: 'Full' },
  { code: 'SAA-C03', name: 'Solutions Architect – Associate', level: 'Associate', role: 'Design trade-offs behind case studies', depth: 'Partial' },
  { code: 'SAP-C03', name: 'Solutions Architect – Professional', level: 'Professional', role: 'Replaced SAP-C02 Nov 17, 2026; advanced design', depth: 'Partial' },
  { code: 'MLA-C02', name: 'Machine Learning Engineer – Associate', level: 'Associate', role: 'In beta; GA January 14, 2027', depth: 'Light' },
  { code: 'AIF-C01', name: 'AI Practitioner', level: 'Foundational', role: 'On-ramp for AI concepts', depth: 'Light' },
  { code: 'CLF-C02', name: 'Cloud Practitioner', level: 'Foundational', role: 'On-ramp for cloud concepts', depth: 'Light' },
  { code: 'DVA-C02', name: 'Developer – Associate (old version)', level: 'Retiring Nov 30, 2026', role: 'Archive for candidates booked before cutoff', depth: 'Archive' },
];

/** DVA-C02 domains, from the DVA-C02 exam guide (verified 2026-10-23, see the session log and exam.yaml). */
export const DVA_C02_DOMAINS = [
  { number: 1, name: 'Development with AWS Services', weight: 32 },
  { number: 2, name: 'Security', weight: 26 },
  { number: 3, name: 'Deployment', weight: 24 },
  { number: 4, name: 'Troubleshooting and Optimization', weight: 18 },
];

/** What the plan says changed inside each DVA-C03 domain, and which services get concept pages. */
export const DVA_C03_CHANGES = {
  1: { services: ['Lambda', 'API Gateway', 'DynamoDB', 'SQS', 'SNS', 'EventBridge', 'Step Functions', 'S3', 'ECR/ECS/EKS/Fargate', 'Bedrock', 'Data Firehose'], whatsNew: 'Containers and Bedrock in scope; DynamoDB cut from 4 skills to 1' },
  2: { services: ['IAM', 'Cognito', 'KMS', 'Secrets Manager', 'Parameter Store', 'PrivateLink', 'Bedrock AgentCore'], whatsNew: 'New Task 2.3 on AI security: prompt injection, agent permissions, keeping sensitive data out of logs' },
  3: { services: ['SAM', 'CDK', 'CloudFormation', 'CodePipeline / CodeBuild / CodeDeploy', 'Lambda versions and aliases'], whatsNew: 'Testing cut from 11 skills to 5' },
  4: { services: ['CloudWatch', 'X-Ray', 'CloudWatch Logs Insights', 'Amazon Q', 'Kiro'], whatsNew: 'AI-assisted development across domains' },
};

export const AIP_C01_DOMAINS = [
  { name: 'Foundation model integration, data and compliance', weight: 31 },
  { name: 'Implementation and integration', weight: 26 },
  { name: 'AI safety, security and governance', weight: 20 },
  { name: 'Operational efficiency', weight: 12 },
  { name: 'Testing, validation and troubleshooting', weight: 11 },
];

/** Topic → the exam that covers it, per the plan's scope notes. */
export const TOPIC_SCOPE = [
  { topic: 'Prompt engineering', exam: 'AIP-C01', dva: false },
  { topic: 'RAG design', exam: 'AIP-C01', dva: false },
  { topic: 'Model selection', exam: 'AIP-C01', dva: false },
  { topic: 'SageMaker AI', exam: 'AIP-C01', dva: false },
  { topic: 'AI governance frameworks', exam: 'AIP-C01', dva: false },
  { topic: 'Calling Amazon Bedrock from code', exam: 'DVA-C03', dva: true },
  { topic: 'Prompt injection and agent permissions (Task 2.3)', exam: 'DVA-C03', dva: true },
  { topic: 'Containers (ECR, ECS, EKS, Fargate)', exam: 'DVA-C03', dva: true },
  { topic: 'Lambda versions and aliases', exam: 'DVA-C03', dva: true },
  { topic: 'CI/CD pipelines and incident response in depth', exam: 'DOP-C02', dva: false },
];

export const CASE_STUDIES = [
  { n: 1, title: 'Serverless order API', scenario: 'Accept orders, process them asynchronously, survive traffic spikes', services: ['API Gateway', 'Lambda', 'SQS + DLQ', 'DynamoDB', 'Step Functions', 'X-Ray'], exams: ['DVA-C03 D1', 'DVA-C03 D3', 'DVA-C03 D4'] },
  { n: 2, title: 'Event-driven image pipeline', scenario: 'Resize and tag uploaded images, notify subscribers', services: ['S3 events', 'EventBridge', 'Lambda', 'SNS', 'Rekognition', 'CloudWatch'], exams: ['DVA-C03 D1', 'DVA-C03 D4'] },
  { n: 3, title: 'RAG support assistant', scenario: 'Answer customer questions from product manuals with citations', services: ['Cognito', 'Lambda', 'Bedrock Knowledge Bases', 'OpenSearch Serverless', 'Bedrock Guardrails'], exams: ['AIP-C01', 'DVA-C03 D2'] },
  { n: 4, title: 'Containerised API migration', scenario: 'Move a legacy web API to containers with blue/green releases', services: ['ECR', 'ALB', 'ECS on Fargate', 'CodeDeploy', 'Secrets Manager'], exams: ['DVA-C03 D1', 'DVA-C03 D3', 'DOP-C02'] },
  { n: 5, title: 'Agentic order assistant', scenario: 'An agent that looks up and amends orders through tools, safely', services: ['Bedrock AgentCore', 'Lambda tools', 'IAM least privilege', 'CloudWatch Logs data protection'], exams: ['AIP-C01', 'DVA-C03 D2'] },
  { n: 6, title: 'Secure CI/CD platform', scenario: 'Ship all of the above with gated, auditable pipelines', services: ['GitHub Actions + OIDC', 'CodePipeline', 'CodeBuild', 'CDK', 'Parameter Store', 'AppConfig flags'], exams: ['DOP-C02', 'DVA-C03 D3'] },
];

export const CASE_STUDY_STRUCTURE = [
  'Business context and requirements, including non-functional ones (latency, cost ceiling, compliance)',
  'Architecture diagram with the data path drawn first',
  'Decision log: each service choice, the alternatives rejected, and why',
  'Build walkthrough linked to the concept pages it uses',
  '"What went wrong": two or three realistic failures and how they were diagnosed with CloudWatch Logs Insights and X-Ray',
  'Cost estimate at small and large scale, using the AWS Pricing Calculator',
  'Exam-style scenario question set (5–8 questions) written against the case',
];

export const TEMPLATE_BLOCKS = [
  { n: 1, title: 'Header', what: 'Service name, one-line definition, exam tags, difficulty, "last verified" date (from frontmatter)' },
  { n: 2, title: 'When to use it / when not to', what: 'Two short lists plus a "compare with" link to the nearest alternative' },
  { n: 3, title: 'How it works', what: 'A diagram and 3–5 short paragraphs on the core model' },
  { n: 4, title: 'Code', what: 'Python (boto3) and TypeScript (SDK v3) samples using IAM roles, plus the CDK or SAM snippet' },
  { n: 5, title: 'Key limits and defaults', what: 'The numbers exams and production both care about, each linked to its AWS doc' },
  { n: 6, title: 'Common mistakes', what: 'The signature section: mistake, symptom, why, fix, with a source' },
  { n: 7, title: 'Security and cost notes', what: 'Least-privilege policy, networking, and the setting that most often surprises the bill' },
  { n: 8, title: 'Check yourself', what: '3–5 quiz questions drawn from the exam bank' },
  { n: 9, title: 'Go deeper', what: 'Skill Builder courses, AWS docs, related case studies and pages' },
];

export const ROADMAP = [
  { phase: 0, name: 'Discovery', weeks: [1, 2], deliverables: ['User interviews (5–10)', 'Competitive scan', 'DVA-C03 exam guide (Oct 27) turned into the canonical objective list', 'Final page template'], gate: 'Scope agreed' },
  { phase: 1, name: 'Foundation', weeks: [3, 10], deliverables: ['Site skeleton + CI', '15 DVA-C03 pages', 'DVA-C03 hub with 150 questions', '2 case studies'], gate: 'Every DVA-C03 task statement mapped to a page and practice questions' },
  { phase: 2, name: 'Breadth', weeks: [11, 18], deliverables: ['15 more service pages', 'AIP-C01 + DOP-C02 hubs', 'Decision guides', 'Sign-in + progress', '4 more case studies'], gate: '30 pages and 6 case studies live' },
  { phase: 3, name: 'Intelligence', weeks: [19, 26], deliverables: ['KB assistant on Bedrock', 'Adaptive quizzes', 'Search by error message', 'AI security labs'], gate: '—' },
];

/** Phase 1 targets, measured against the repository by the roadmap demo. */
export const PHASE1_TARGETS = { pages: 15, questions: 150, caseStudies: 2 };

export const DECISION_GUIDES = [
  'SQS vs SNS vs EventBridge vs Kinesis',
  'Lambda vs Fargate vs ECS on EC2',
  'SAM vs CDK vs CloudFormation',
  'Secrets Manager vs Parameter Store',
];

export const SITE_STACK = [
  ['Site framework', 'Astro + MDX, React islands for interactive parts', 'Content-first, ships little JavaScript, MDX lets authors embed quizzes and diagrams'],
  ['Styling', 'Tailwind CSS, light and dark themes', 'Fast to build a consistent page template'],
  ['Hosting', 'S3 (private bucket) + CloudFront with origin access control', 'Cheap, fast, and a worked example of a common mistake (public buckets)'],
  ['Search', 'Pagefind (static index) in v1; Bedrock Knowledge Bases later', 'Zero-cost search first, semantic search later'],
  ['Diagrams', 'Mermaid in MDX', 'Diagrams stay editable in Git'],
  ['Code samples', 'Tabbed Python / TypeScript blocks sourced from tested samples/', "Samples can't drift from what CI runs"],
  ['Auth', 'Amazon Cognito user pool (optional sign-in)', 'Progress sync across devices; anonymous reading stays free'],
  ['API + data', 'API Gateway (HTTP API) + Lambda + DynamoDB', 'Quiz attempts, progress, bookmarks, feedback'],
  ['Infrastructure', 'AWS CDK in TypeScript', 'Same tool the labs teach'],
  ['Telemetry', 'CloudWatch Logs, metrics and X-Ray tracing', 'Which pages and questions people struggle with'],
];

export const REVIEW_GAPS = [
  'DVA-C03 detail is incomplete: task statements publish with the full guide on Oct 27, 2026; rebuild the objective map from it.',
  'Some exam statuses (DOP-C02, SAA-C03, AIF-C01, CLF-C02) need re-checking on the AWS certification site before hubs publish.',
  'Scope was set by judgment: Data Engineer – Associate and MLA-C02 are light or absent.',
  'No user validation or competitive scan yet (Skill Builder, Tutorials Dojo and similar).',
  'Effort and ownership are unstated: 40+ pages with tested code in two languages needs named owners.',
  'Success metrics measure output, not outcome: add pass rate, time to answer, return visits, quiz improvement.',
  "AWS's certification agreement forbids sharing live exam content; questions must be original (see docs/question-policy.md).",
];

export const IMPROVEMENTS = [
  'Decision guides as first-class pages',
  'Search by symptom: index pages by error messages',
  'Hands-on, not just read: one-command CDK labs with teardown and budget alarms',
  'An "AI security" track for DVA-C03 Task 2.3',
  'Adaptive exam prep with spaced repetition',
  'An AI assistant over the KB (case study 3 built for real)',
  'Map pages to the Well-Architected Framework pillars',
  'Cross-cloud bridge with the Azure KB (SQS ↔ Service Bus, Lambda ↔ Functions)',
  'Version content by exam revision, with a changelog per hub',
  'Accessibility and reach: WCAG 2.2 AA, offline PWA, translation later',
];

export const PLAN_SOURCES = [
  { title: 'AWS Training and Certification blog — Certification updates, September 2026', url: 'https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/' },
  { title: 'AWS — Certified Developer – Associate', url: 'https://aws.amazon.com/certification/certified-developer-associate/' },
  { title: 'AWS — Generative AI Developer – Professional (AIP-C01) exam guide', url: 'https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.md' },
  { title: 'AWS — DevOps Engineer – Professional (DOP-C02) exam guide', url: 'https://docs.aws.amazon.com/de_de/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02.html' },
  { title: 'Tutorials Dojo — What’s new with DVA-C03', url: 'https://tutorialsdojo.com/whats-new-with-the-aws-certified-developer-associate-dva-c03/' },
  { title: 'CertCrush — SAP-C03 and DVA-C03 release dates', url: 'https://www.certcrush.app/blog/aws-sap-c03-dva-c03-release-dates-2026' },
];

/** The question-writing policy (docs/question-policy.md). */
export const QUESTION_RULES = [
  'Write from the docs, not from memory of an exam; link the source.',
  'Explain every option, including the correct ones.',
  "Match the exam's format: single = 1 correct of 4; multiple = 2+ correct of 5+, and say how many to choose.",
  'One idea per question.',
  'Distractors must be plausible: use the mistakes people actually make.',
  "Don't refer to option letters: the practice exam shuffles the options.",
  'Tag accurately: services, exam_domains and (once published) tasks.',
];
