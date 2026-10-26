import { blueprint, certifications, coverage, dates, format, practice } from '../../lab/exam.js';
import { DVA, DVA_OBJECTIVES, QUESTIONS, SOURCES, excerpt } from '../../kb/repo.js';
import { TOPIC_SCOPE } from '../../kb/plan.js';

const CATEGORY = 'Exam prep: DVA-C03';
const C02_GUIDE = 'https://docs.aws.amazon.com/aws-certification/latest/developer-associate-02/developer-associate-02.html';
const ANNOUNCEMENT = DVA.verified.against[0].url;

export default [
  {
    id: 'exam-blueprint',
    category: CATEGORY,
    title: 'The DVA-C03 blueprint',
    tagline: 'Four domains, their weights, and what changed from DVA-C02',
    description: [
      'DVA-C03 is the spine of the knowledge base: every concept page is tagged with the exam domains it teaches. The exam has four domains: Development with AWS Services (30%), Security (26%), Testing and Deployment (22%) and Troubleshooting and Optimization (22%).',
      'Press the button to read objectives.yaml and turn the weights into scored questions and study hours. The donut compares DVA-C03 with DVA-C02; the bars show where your hours go.',
      "The plan claimed the weights were unchanged from DVA-C02. They aren't: DVA-C02 was 32/26/24/18 and its Domain 3 was just \"Deployment\". The KB uses the verified numbers, and this page shows the difference.",
    ],
    keyApis: ['objectives.yaml', 'exam_domains', 'DVA-C03-D1…D4', 'status: provisional'],
    useCases: ['Plan study time by weight', 'Tag pages and questions by domain', 'Spot what moved between exam versions'],
    snippet: { lang: 'yaml', name: 'content/exams/dva-c03/objectives.yaml', code: 'exam: DVA-C03\nstatus: provisional\ndomains:\n' + DVA_OBJECTIVES.domains.map((d) => `  - id: ${d.id}\n    number: ${d.number}\n    name: ${d.name}\n    weight: ${d.weight}`).join('\n') },
    inputs: [{ name: 'studyHours', label: 'Study hours you have', type: 'number', default: 40, min: 5, max: 300 }],
    flow: [
      ['dev', 'repo', 'read objectives.yaml + exam.yaml'],
      ['repo', 'repo', 'weights → scored questions'],
      ['repo', 'docs', 'compare with the DVA-C02 guide'],
      ['docs', 'dev', 'per-domain study plan'],
    ],
    actions: [
      { id: 'run', label: 'Build the study plan', tone: 'accent', run: (i) => blueprint(i) },
      { id: 'old-weights', label: 'Do it wrong: use DVA-C02 weights', tone: 'ghost', run: (i) => blueprint(i, { useOldWeights: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Studying from DVA-C02 material and weights for DVA-C03',
        symptom: 'Troubleshooting and Optimization gets 18% of your time when it is 22% of the exam; containers, Bedrock and AI security are missing from your notes.',
        why: 'The domains kept similar names, so older courses look current. The weights and the content inside each domain changed.',
        fix: 'Re-plan with the DVA-C03 weights (30/26/22/22) and add the new topics: containers (ECR/ECS/EKS/Fargate), Bedrock, and Task 2.3 AI security.',
        avoid: 'Check the exam code on every course or question bank you use, and track the official exam guide (the KB diffs it weekly).',
        source: { title: 'AWS Certification updates, September 2026', url: ANNOUNCEMENT },
        reproduce: 'old-weights',
      },
      {
        mistake: 'Treating the objective map as final before the guide publishes',
        symptom: 'Pages tagged with made-up task IDs; check:content fails with "unknown task statement DVA-C03-2.4".',
        why: 'Only domains and weights were announced in September 2026. Task statements arrive with the full guide on October 27, 2026.',
        fix: 'Tag by domain (exam_domains) until objectives.yaml lists the official tasks with status: official.',
        avoid: 'Never invent task IDs; load them from the guide and let the content check enforce them.',
        source: { title: 'docs/authoring.md: Exam facts', file: 'docs/authoring.md' },
      },
    ],
    visual: 'blueprint',
    test: { action: 'run' },
  },
  {
    id: 'exam-dates',
    category: CATEGORY,
    title: 'Key dates: C02 → C03',
    tagline: 'Registration Oct 27, last DVA-C02 Nov 30, DVA-C03 from Dec 1, 2026',
    description: [
      'AWS replaces DVA-C02 with DVA-C03 on a fixed date. Registration for DVA-C03 and the full exam guide (with every task statement) open on October 27, 2026. The last day to sit DVA-C02 is November 30; DVA-C03 delivery begins December 1.',
      'Pick the day you plan to sit the exam. The timeline marks today and each milestone, and the lab tells you which version you would take and therefore which material to study.',
      'Candidates booked before the cutoff still need DVA-C02 content, which is why the KB keeps an archive.',
    ],
    keyApis: ['exam.yaml dates[]', 'verified.on', 'guide_urls'],
    useCases: ['Decide which version to prepare for', 'Know when the objective map can be finalised'],
    snippet: { lang: 'yaml', name: 'content/exams/dva-c03/exam.yaml', code: excerptYaml() },
    inputs: [{ name: 'examDate', label: 'Your exam day (YYYY-MM-DD)', type: 'text', default: '2026-12-05' }],
    flow: [
      ['dev', 'repo', 'read exam.yaml dates'],
      ['repo', 'repo', 'which version is on offer that day?'],
      ['repo', 'dev', 'DVA-C02 or DVA-C03 + countdown'],
    ],
    actions: [
      { id: 'run', label: 'Check my exam day', tone: 'accent', run: (i) => dates(i) },
      { id: 'book-old', label: 'Do it wrong: book DVA-C02 in December', tone: 'ghost', run: (i) => dates(i, { bookOld: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Booking the old exam version after its retirement date',
        symptom: 'No DVA-C02 appointments are offered after November 30, 2026; a December slot is DVA-C03 whatever you studied.',
        why: 'There is no overlap: DVA-C03 delivery starts the day after DVA-C02 ends.',
        fix: 'Either sit DVA-C02 by November 30 or switch your preparation to DVA-C03.',
        avoid: 'Choose the version first, from the date, then the study material.',
        source: { title: 'AWS Certification updates, September 2026', url: ANNOUNCEMENT },
        reproduce: 'book-old',
      },
    ],
    visual: 'dates',
    test: { action: 'run' },
  },
  {
    id: 'exam-format',
    category: CATEGORY,
    title: 'Format, scoring and pacing',
    tagline: '130 minutes, 65 questions (50 scored), pass at 720 of 1,000',
    description: [
      `DVA-C03 runs ${DVA.format.duration_minutes} minutes with ${DVA.format.questions_total} questions, ${DVA.format.questions_scored} of them scored, and passes at ${DVA.format.passing_score} on a ${DVA.format.score_scale.join('–')} scaled score. Questions are multiple choice (one answer of four) or multiple response (two or more of five or more).`,
      'Press the button for a pacing plan with checkpoints. The grid shows 65 questions; the 15 unscored ones are scattered and, on the real exam, not marked. Try skipping a few you think are unscored and watch how many scored questions you throw away.',
      'An unanswered question is scored as incorrect and there is no penalty for guessing, so never leave a blank. The scale and response types are from the DVA-C02 guide and get re-checked against the DVA-C03 guide when it publishes (exam.yaml notes this).',
    ],
    keyApis: ['duration_minutes', 'questions_scored', 'passing_score', 'score_scale'],
    useCases: ['Pace yourself', 'Decide when to flag and move on'],
    snippet: { lang: 'yaml', name: 'content/exams/dva-c03/exam.yaml (format)', code: `format:\n  duration_minutes: ${DVA.format.duration_minutes}\n  questions_total: ${DVA.format.questions_total}\n  questions_scored: ${DVA.format.questions_scored}\n  passing_score: ${DVA.format.passing_score}\n  score_scale: [${DVA.format.score_scale.join(', ')}]\n  question_types: [${DVA.format.question_types.join(', ')}]` },
    inputs: [
      { name: 'reviewMinutes', label: 'Minutes kept for review', type: 'number', default: 10, min: 0, max: 60 },
      { name: 'skip', label: 'Questions skipped as "unscored"', type: 'number', default: 0, min: 0, max: 30 },
    ],
    flow: [
      ['dev', 'repo', 'read exam.yaml format'],
      ['repo', 'repo', 'pace + place 15 unscored questions'],
      ['repo', 'dev', 'checkpoints + blanks that cost points'],
    ],
    actions: [
      { id: 'run', label: 'Plan my pacing', tone: 'accent', run: (i) => format(i) },
      { id: 'skip', label: 'Do it wrong: skip 10 "unscored" questions', tone: 'ghost', run: (i) => format({ ...i, skip: 10 }) },
    ],
    pitfalls: [
      {
        mistake: 'Skipping questions you think are unscored',
        symptom: 'A borderline fail: blanks count as wrong, and most of the questions you skipped were scored.',
        why: 'The 15 unscored questions are not identified; 50 of 65 (77%) are scored.',
        fix: 'Answer every question. Flag hard ones, make your best guess, and come back if time allows.',
        avoid: 'Use the checkpoint plan (question ≈ minute ÷ 2) and keep 10 minutes for flagged questions.',
        source: { title: 'DVA-C02 exam guide: response types and scoring', url: C02_GUIDE },
        reproduce: 'skip',
      },
      {
        mistake: 'Reading 720 as "72% correct"',
        symptom: 'Practice scores of 72% feel like a pass, but the result is a scaled score, not a percentage.',
        why: 'AWS reports a scaled score from 100 to 1,000; a raw percentage does not convert to it directly (the practice mode says so on its results page).',
        fix: 'Aim well above the line in practice, and use per-domain results to find weak areas.',
        avoid: 'Track per-domain accuracy over time, not one raw percentage.',
        source: { title: 'Practice exam results note', file: 'site/src/islands/PracticeExam.tsx' },
      },
    ],
    visual: 'format',
    test: { action: 'run' },
  },
  {
    id: 'certifications',
    category: CATEGORY,
    title: 'Eight certifications, one core',
    tagline: 'Which exam covers which topic, and how deep the KB goes for each',
    description: [
      'The KB targets eight AWS certifications. DVA-C03 is the core with full prep (hub, objective map, 250+ questions, labs). AIP-C01 (Generative AI Developer – Professional) and DOP-C02 (DevOps Engineer – Professional) also get full hubs; the architect exams get decision guides and case studies; the foundational ones get a glossary and quiz.',
      'Pick a topic to see which exam owns it. Prompt engineering, RAG design, model selection, SageMaker AI and AI governance frameworks are out of scope for DVA-C03: they belong to AIP-C01. Calling Bedrock from code and the new AI-security task are in DVA-C03.',
      'AIP-C01 has five domains: foundation model integration, data and compliance (31%), implementation and integration (26%), AI safety, security and governance (20%), operational efficiency (12%) and testing, validation and troubleshooting (11%).',
    ],
    keyApis: ['DVA-C03', 'AIP-C01', 'DOP-C02', 'SAA-C03', 'SAP-C03'],
    useCases: ['Scope your study', 'Pick the next certification'],
    snippet: { lang: 'text', name: 'aws-vl-plan.md: Certification coverage', code: 'Exam     Level         Prep depth\nDVA-C03  Associate     Full (core)\nAIP-C01  Professional  Full\nDOP-C02  Professional  Full\nSAA-C03  Associate     Partial: decision guides + case studies\nSAP-C03  Professional  Partial: case studies\nMLA-C02  Associate     Light until GA (Jan 14, 2027)\nAIF-C01  Foundational  Light: glossary + quiz\nCLF-C02  Foundational  Light\nDVA-C02  Retiring      Archive only' },
    inputs: [{ name: 'topic', label: 'Topic', type: 'select', default: TOPIC_SCOPE[1].topic, options: TOPIC_SCOPE.map((t) => t.topic) }],
    flow: [
      ['dev', 'repo', 'look up the topic in the plan'],
      ['repo', 'docs', 'exam scope notes'],
      ['docs', 'dev', 'the exam that covers it'],
    ],
    actions: [
      { id: 'run', label: 'Which exam covers it?', tone: 'accent', run: (i) => certifications(i) },
      { id: 'wrong-scope', label: 'Do it wrong: study RAG design for DVA-C03', tone: 'ghost', run: (i) => certifications({ ...i, topic: 'RAG design' }) },
    ],
    pitfalls: [
      {
        mistake: 'Over-studying generative-AI design for the developer exam',
        symptom: 'Weeks on RAG architectures and model selection that DVA-C03 never asks about.',
        why: 'DVA-C03 added Bedrock and AI security, so it is easy to assume all of generative AI is in scope.',
        fix: 'For DVA-C03, learn to call Bedrock from code and the AI-security skills of Task 2.3; leave RAG design and model selection for AIP-C01.',
        avoid: 'Check each topic against the exam guide before you study it.',
        source: { title: 'AIP-C01 exam guide', url: 'https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.md' },
        reproduce: 'wrong-scope',
      },
    ],
    visual: 'certifications',
    test: { action: 'run' },
  },
  {
    id: 'practice-questions',
    category: CATEGORY,
    title: 'Practice questions',
    tagline: `${QUESTIONS.length} original questions, every option explained`,
    description: [
      'The question bank lives in content/exams/dva-c03/questions/*.yaml. Every question is original (the AWS certification agreement forbids sharing live exam content), links the AWS doc it is based on, and explains why each option is right or wrong.',
      'Build a deck, then answer in the cards below: pick options, press Check, and read the explanation for every option. Options are shuffled and re-lettered the way the practice exam does it, so a question never depends on "option A".',
      'Multiple-response questions are all-or-nothing: you need every correct option and nothing else. The grading uses the site’s own isCorrect() from site/src/islands/types.ts.',
    ],
    keyApis: ['isCorrect()', 'correctIds()', 'type: single | multiple', 'why'],
    useCases: ['Check yourself after a concept page', 'Timed practice in the real format'],
    snippet: { lang: 'ts', name: 'site/src/islands/types.ts', code: "export const correctIds = (q: QuizQuestion) => q.options.filter((o) => o.correct).map((o) => o.id);\n\nexport function isCorrect(q: QuizQuestion, picked: string[]): boolean {\n  const want = correctIds(q);\n  return picked.length === want.length && want.every((id) => picked.includes(id));\n}" },
    inputs: [
      { name: 'domain', label: 'Domain', type: 'select', default: 'all', options: ['all', ...DVA_OBJECTIVES.domains.map((d) => d.id)] },
      { name: 'count', label: 'Questions', type: 'number', default: 5, min: 1, max: QUESTIONS.length },
    ],
    flow: [
      ['dev', 'repo', 'load questions/*.yaml'],
      ['repo', 'repo', 'filter by domain, shuffle, re-letter'],
      ['repo', 'dev', 'deck + explanations'],
    ],
    actions: [
      { id: 'run', label: 'Build a deck', tone: 'accent', run: (i) => practice(i) },
      { id: 'partial', label: 'Do it wrong: answer half of a "Which TWO"', tone: 'ghost', run: (i) => practice(i, { partialAnswer: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Expecting partial credit on multiple-response questions',
        symptom: 'You picked one of the two correct options and the question is marked wrong.',
        why: 'A multiple-response answer is correct only when it selects exactly the correct set.',
        fix: 'Read the stem for how many to choose, and rule options out one by one using each option’s "why".',
        avoid: 'Practise with the explanations: the distractors are the mistakes people actually make.',
        source: { title: 'isCorrect() grading', file: 'site/src/islands/types.ts' },
        reproduce: 'partial',
      },
    ],
    visual: 'practice',
    test: { action: 'run' },
  },
  {
    id: 'objective-coverage',
    category: CATEGORY,
    title: 'Objective-map coverage',
    tagline: 'A task statement counts as covered with 1+ page and 5+ questions',
    description: [
      'Each exam hub shows how much of the exam the KB covers. The rule (site/src/lib/coverage.ts) is strict: a task statement is covered only when at least one concept page and at least five practice questions are tagged with its ID. That is also the Phase 1 exit gate.',
      'The real objectives.yaml has no task statements yet (they publish on October 27, 2026), so coverage is "not measurable". Add hypothetical tasks and choose how many questions to tag, then run the site’s own computeCoverage() on them and watch the percentage react.',
      'Tagging by domain alone looks productive (the domain lists plenty of questions) but covers no task statements. Tasks drive coverage.',
    ],
    keyApis: ['computeCoverage()', 'MIN_PAGES_PER_TASK = 1', 'MIN_QUESTIONS_PER_TASK = 5', 'tasks[]'],
    useCases: ['Find gaps in the exam map', 'Gate a release on coverage'],
    snippet: { lang: 'ts', name: 'site/src/lib/coverage.ts', code: excerpt(SOURCES.coverageTs, 'export const MIN_PAGES_PER_TASK', 'export const MIN_QUESTIONS_PER_TASK') + '\n…\n' + excerpt(SOURCES.coverageTs, '        covered:', '        covered:') },
    inputs: [
      { name: 'hypotheticalTasks', label: 'Hypothetical D1 tasks', type: 'number', default: 3, min: 0, max: 8 },
      { name: 'questionsPerTask', label: 'Questions tagged per task', type: 'number', default: 5, min: 0, max: QUESTIONS.length },
    ],
    flow: [
      ['dev', 'repo', 'objectives + pages + questions'],
      ['repo', 'repo', 'computeCoverage()'],
      ['repo', 'dev', 'covered tasks and %'],
    ],
    actions: [
      { id: 'run', label: 'Compute coverage', tone: 'accent', run: (i) => coverage(i) },
      { id: 'domain-only', label: 'Do it wrong: tag by domain only', tone: 'ghost', run: (i) => coverage({ ...i, hypotheticalTasks: Math.max(1, Number(i.hypotheticalTasks) || 3) }, { domainOnly: true }) },
    ],
    pitfalls: [
      {
        mistake: 'Tagging questions with a domain but no task statement',
        symptom: 'The hub shows lots of questions per domain but 0% task coverage.',
        why: 'Coverage counts pages and questions per task ID; exam_domains only groups them.',
        fix: 'Add tasks: [DVA-C03-x.y] to the page frontmatter and each question once the guide is loaded.',
        avoid: 'Write questions against a task statement from the start.',
        source: { title: 'Coverage rule', file: 'site/src/lib/coverage.ts' },
        reproduce: 'domain-only',
      },
    ],
    visual: 'coverage',
    test: { action: 'run' },
  },
];

function excerptYaml() {
  return [
    'dates:',
    ...DVA.dates.map((d) => `  - label: ${d.label}\n    date: ${d.date instanceof Date ? d.date.toISOString().slice(0, 10) : d.date}`),
    `verified:\n  on: ${DVA.verified.on instanceof Date ? DVA.verified.on.toISOString().slice(0, 10) : DVA.verified.on}`,
  ].join('\n');
}
