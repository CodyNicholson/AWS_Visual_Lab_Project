# Instructions for Claude Code

Use the project plan below as the specification for this repository. Before writing code:

1. Propose a repo structure (Astro + MDX site, `samples/`, `infra/` CDK app, CI workflows) and wait for my confirmation.
2. Scope the first pass to **Phase 1 — Foundation** in the Roadmap section, unless I say otherwise.
3. Treat exam facts (domains, weights, task statements, dates) as needing verification against the official AWS exam guides before they go into site content. The full DVA-C03 exam guide publishes October 27, 2026.

---

# AWS Developer Knowledge Base — Project Plan

As of Oct 23, 2026

Build "AWS Dev KB": one site where every critical AWS developer service has its own page, every page maps to the current exam objectives, and every concept is reinforced by a case study. The plan centres on the new Developer – Associate exam, DVA-C03, which replaces DVA-C02 on December 1, 2026 and adds containers, Amazon Bedrock and AI security.

## Overview

**Purpose.** One place to learn, look up, and practise AWS software development: what a service is, when to pick it, how to call it from code, and where people go wrong.

**Audience.**

- Working developers who need a fast reference while building on AWS
- Exam candidates preparing for DVA-C03, AIP-C01, DOP-C02 and related certifications
- Team leads onboarding engineers onto an AWS codebase

**Three pillars of content.**

1. **Concept pages** — one page per service or cross-cutting concept, each with explanation, code, and common mistakes.
2. **Exam prep** — per-certification hubs that link objectives to concept pages, plus quizzes, flashcards and practice exams.
3. **Case studies** — end-to-end scenarios that combine several services and show the decisions and trade-offs.

**Success criteria for v1.**

- 100% of DVA-C03 task statements mapped to at least one concept page and five practice questions
- 40+ concept pages live, each passing the page template checklist
- 6 case studies with working reference code in a public repo
- Every page shows a "last verified" date no older than 90 days

## Certification coverage

The KB targets eight AWS certifications, with [Developer – Associate](https://aws.amazon.com/certification/certified-developer-associate/) as the core. Per [AWS's September 2026 update](https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/), DVA-C03 registration opens October 27, 2026, the last day for DVA-C02 is November 30, and DVA-C03 launches December 1. Build exam content for DVA-C03 only; DVA-C02 material becomes an archive.

| Exam | Certification | Level | Role in the KB | Prep depth |
| --- | --- | --- | --- | --- |
| DVA-C03 | Developer – Associate | Associate | Core developer track; replaces DVA-C02 Dec 1, 2026 | Full: hub, objective map, 250+ questions, labs |
| [AIP-C01](https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.md) | Generative AI Developer – Professional | Professional | Bedrock, RAG, agents, guardrails in production | Full |
| DOP-C02 | DevOps Engineer – Professional | Professional | CI/CD, IaC, monitoring, incident response | Full |
| SAA-C03 | Solutions Architect – Associate | Associate | Design trade-offs behind case studies | Partial: decision guides + case studies |
| SAP-C03 | Solutions Architect – Professional | Professional | Replaced SAP-C02 Nov 17, 2026; advanced design | Partial: case studies |
| MLA-C02 | Machine Learning Engineer – Associate | Associate | In beta; GA January 14, 2027 | Light until GA |
| AIF-C01 | AI Practitioner | Foundational | On-ramp for AI concepts | Light: glossary + quiz |
| CLF-C02 | Cloud Practitioner | Foundational | On-ramp for cloud concepts | Light |
| DVA-C02 | Developer – Associate (old version) | Retiring Nov 30, 2026 | Archive for candidates booked before cutoff | Archive only |

**DVA-C03 blueprint (the spine of the KB).** Domains and weights are unchanged from DVA-C02; the content inside them changed. The exam runs 130 minutes with 65 questions (50 scored), and passes at 720/1,000.

| Domain | Weight | Services that get concept pages | What's new in C03 |
| --- | --- | --- | --- |
| Development with AWS Services | 30% | Lambda, API Gateway, DynamoDB, SQS, SNS, EventBridge, Step Functions, S3, ECR/ECS/EKS/Fargate, Bedrock, Data Firehose | Containers and Bedrock in scope; DynamoDB cut from 4 skills to 1 |
| Security | 26% | IAM, Cognito, KMS, Secrets Manager, Parameter Store, PrivateLink, Bedrock AgentCore | New Task 2.3 on AI security: prompt injection, agent permissions, keeping sensitive data out of logs |
| Testing and Deployment | 22% | SAM, CDK, CloudFormation, CodePipeline / CodeBuild / CodeDeploy, Lambda versions and aliases | Testing cut from 11 skills to 5 |
| Troubleshooting and Optimization | 22% | CloudWatch, X-Ray, CloudWatch Logs Insights, Amazon Q, Kiro | AI-assisted development across domains |

**Out of scope for DVA-C03 (covered by AIP-C01 instead):** prompt engineering, RAG design, model selection, SageMaker AI, and AI governance frameworks.

**AIP-C01 blueprint.** Five domains: foundation model integration, data and compliance (31%); implementation and integration (26%); AI safety, security and governance (20%); operational efficiency (12%); testing, validation and troubleshooting (11%). 65 scored questions, passing score 750.

**Exam prep materials per certification hub.**

- Objective map: every task statement links to the concept page(s) that teach it, with a coverage % shown at the top
- Question bank: multiple choice and multiple response, each with a "why the wrong answers are wrong" explanation
- Timed practice exam in the real format and time limit
- Flashcards with spaced repetition for limits, quotas and defaults
- Hands-on labs using CDK or SAM templates in a sandbox account with budget alarms
- Study planners (4-week and 8-week) and a "what changed from DVA-C02" diff page

Open question: the full DVA-C03 exam guide with every task statement publishes October 27, 2026. The objective map waits on it, so Phase 1 should start after that date.

## Concept map

The site gets one page per service (30 total), grouped into six domains that mirror the exam blueprints, plus cross-cutting guides that span domains.

| Domain | Exam tags | Service pages |
| --- | --- | --- |
| Compute and containers | DVA-C03 D1 | AWS Lambda, Amazon ECR, ECS on Fargate, Amazon EKS, Elastic Beanstalk |
| Data and streaming | DVA-C03 D1 | Amazon DynamoDB, Amazon S3, Aurora and RDS Proxy, Amazon ElastiCache, Kinesis + Data Firehose |
| APIs and messaging | DVA-C03 D1 | API Gateway, Amazon SQS, Amazon SNS, Amazon EventBridge, AWS Step Functions |
| Generative AI | AIP-C01, DVA-C03 D2 | Amazon Bedrock, Bedrock Knowledge Bases, Bedrock Guardrails, Bedrock AgentCore, Amazon Q and Kiro |
| Security and identity | DVA-C03 D2 | IAM roles and policies, Amazon Cognito, AWS KMS, Secrets Manager, PrivateLink endpoints |
| Observability and DevOps | DVA-C03 D3, D4, DOP-C02 | CloudWatch + Logs, AWS X-Ray, AWS SAM and CDK, CloudFormation, CodePipeline + CodeBuild |

Cross-cutting pages: decision guides, AI security, networking, cost, glossary.

## Concept page template

Every concept page follows the same nine blocks, in this order, so readers always know where to look and authors can be checked against a checklist.

1. **Header** — service name, one-line definition, exam tags (DVA-C03 domain 1, AIP-C01, …), difficulty, "last verified" date.
2. **When to use it / when not to** — two short lists, plus a "compare with" link to the nearest alternative (SQS vs SNS vs EventBridge vs Kinesis).
3. **How it works** — a diagram and 3–5 short paragraphs on the core model (partitions, concurrency, invocation types, visibility timeout).
4. **Code** — minimal working samples in Python (boto3) and TypeScript (AWS SDK v3), using IAM roles rather than access keys, plus the CDK or SAM snippet that creates the resource.
5. **Key limits and defaults** — a small table of the numbers exams and production both care about (Lambda timeout and payload size, SQS message size, DynamoDB item size), each linked to the AWS doc it came from.
6. **Common mistakes** — the signature section (format below).
7. **Security and cost notes** — least-privilege policy example, networking, and the setting that most often surprises the bill.
8. **Check yourself** — 3–5 quiz questions drawn from the exam bank.
9. **Go deeper** — AWS Skill Builder courses, AWS docs, related case studies, related pages.

**Common-mistakes format.** Each mistake is one row, written so a reader can recognise it in their own code:

| Mistake | Symptom you see | Why it happens | Fix |
| --- | --- | --- | --- |
| Long-lived access keys in code or environment variables | Keys leak to Git; hard to rotate | Tutorials paste `aws configure` credentials | Use IAM roles for Lambda, ECS tasks and EC2; IAM Identity Center for people |
| DynamoDB partition key with low cardinality (e.g. `status`, `date`) | Hot partitions, throttled writes, uneven cost | Table designed like a relational table | List access patterns first; design single-table keys around them |
| SQS visibility timeout shorter than Lambda timeout | Same message processed twice, duplicates downstream | Defaults left in place | Set visibility timeout to at least 6× the function timeout; make handlers idempotent; add a dead-letter queue |
| SDK clients created inside the Lambda handler | Slow invocations, connection churn | Client built per request | Create clients outside the handler so warm starts reuse them |
| Lambda in a VPC with no route to AWS APIs | Calls to S3 or DynamoDB hang until timeout | VPC attached without NAT or VPC endpoints | Add gateway or interface endpoints (PrivateLink), or a NAT gateway |

These rows show the format; each page targets 5–8 mistakes, sourced from AWS docs, re:Post threads and GitHub issues, with the source linked.

## Case studies

Six case studies in v1, chosen so that together they touch every DVA-C03 domain and most AIP-C01 and DOP-C02 topics. Each ships with reference code and a CDK deployment.

| # | Case study | Scenario | Core services | Exams exercised |
| --- | --- | --- | --- | --- |
| 1 | Serverless order API | Accept orders, process them asynchronously, survive traffic spikes | API Gateway, Lambda, SQS + DLQ, DynamoDB, Step Functions, X-Ray | DVA-C03 D1, D3, D4 |
| 2 | Event-driven image pipeline | Resize and tag uploaded images, notify subscribers | S3 events, EventBridge, Lambda, SNS, Rekognition, CloudWatch | DVA-C03 D1, D4 |
| 3 | RAG support assistant | Answer customer questions from product manuals with citations | Bedrock Knowledge Bases, Bedrock Guardrails, OpenSearch Serverless, Lambda, Cognito | AIP-C01 · DVA-C03 D2 (AI security) |
| 4 | Containerised API migration | Move a legacy web API to containers with blue/green releases | ECR, ECS on Fargate, ALB, CodeDeploy, Secrets Manager | DVA-C03 D1, D3 · DOP-C02 |
| 5 | Agentic order assistant | An agent that looks up and amends orders through tools, safely | Bedrock AgentCore, Lambda tools, IAM least privilege, CloudWatch Logs data protection | AIP-C01 · DVA-C03 D2 |
| 6 | Secure CI/CD platform | Ship all of the above with gated, auditable pipelines | CodePipeline / GitHub Actions with OIDC, CDK, CodeBuild, Parameter Store, AppConfig feature flags | DOP-C02 · DVA-C03 D3 |

**Structure of every case study.**

1. Business context and requirements, including non-functional ones (latency, cost ceiling, compliance)
2. Architecture diagram with the data path drawn first
3. Decision log: each service choice, the alternatives rejected, and why
4. Build walkthrough linked to the concept pages it uses
5. "What went wrong": two or three realistic failures (throttling, poison messages, a prompt-injection attempt, a leaked key) and how they were diagnosed with CloudWatch Logs Insights and X-Ray
6. Cost estimate at small and large scale, using the AWS Pricing Calculator
7. Exam-style scenario question set (5–8 questions) written against the case

## Frontend app

Ship a statically generated site from S3 behind CloudFront, with a thin API Gateway + Lambda backend only for signed-in features. Hosting on the services the KB teaches keeps costs near zero and turns the site itself into a reference implementation (it is case study 1 in miniature).

**Architecture (data flow).**

- Content repo (MDX + code samples) → GitHub Actions (build, test, OIDC role assumption) → deploys to S3 + CloudFront (Astro site + CDN)
- Reader's browser (React islands) → HTTPS → CloudFront
- CloudFront → `/api` → API Gateway → Lambda (progress + quiz API) → DynamoDB (quiz attempts, progress, bookmarks)
- Reader's browser → sign-in → Amazon Cognito user pool
- Lambda → CloudWatch (logs, metrics) + X-Ray traces

Pages are built at deploy time and served from the CDN; only progress tracking and quiz scoring call the API. GitHub Actions deploys with OIDC role assumption, so no AWS keys are stored in the repo.

**Stack.**

| Layer | Choice | Why |
| --- | --- | --- |
| Site framework | Astro + MDX, React islands for interactive parts | Content-first, ships little JavaScript, MDX lets authors embed quizzes and diagrams |
| Styling | Tailwind CSS, light and dark themes | Fast to build a consistent page template |
| Hosting | S3 (private bucket) + CloudFront with origin access control | Cheap, fast, and a good worked example of a common mistake (public buckets) |
| Search | Pagefind (static index) in v1; Bedrock Knowledge Bases when the assistant ships | Zero-cost search first, semantic search later |
| Diagrams | Mermaid in MDX, exported SVG for complex architecture | Diagrams stay editable in Git |
| Code samples | Tabbed Python / TypeScript blocks with copy button, sourced from tested `samples/` | Samples can't drift from what CI runs |
| Auth | Amazon Cognito user pool (optional sign-in) | Progress sync across devices; anonymous reading stays free |
| API + data | API Gateway (HTTP API) + Lambda + DynamoDB | Quiz attempts, progress, bookmarks, feedback |
| Infrastructure | AWS CDK in TypeScript | Same tool the labs teach |
| Telemetry | CloudWatch Logs, metrics and X-Ray tracing | Which pages and questions people struggle with |

**Site map and routes.**

- `/` — home: search bar, "start by exam" and "start by service" entry points
- `/concepts/{domain}/{service}` — one page per service, built from the template above
- `/decide/{topic}` — decision guides such as "SQS vs SNS vs EventBridge vs Kinesis"
- `/exams/{code}` — certification hub: objective map with coverage, study plan, practice exam
- `/exams/{code}/practice` — timed exam mode and study mode
- `/case-studies/{slug}` — case studies with architecture, decision log and question set
- `/mistakes` — every common-mistake row across the site, filterable by service and severity
- `/me` — signed-in progress dashboard: task statements mastered, weak areas, bookmarks

**Key UI features.** Global search with filters (exam, domain, service), a per-page "exam tags" bar, a progress ring per certification, flashcards with spaced repetition, keyboard navigation, and WCAG 2.2 AA accessibility.

## Content pipeline

Content lives as MDX files in Git with typed frontmatter, so every change is reviewed like code and freshness can be checked automatically.

**Frontmatter per page:** `title`, `service`, `domain`, `exams[]`, `tasks[]` (task-statement IDs from the exam guides, e.g. `DVA-C03-2.3`), `last_verified`, `sources[]`, `related[]`.

**Authoring flow.**

1. Author drafts from the template; code samples live in a `samples/` folder and are deployed and tested in CI against a sandbox AWS account with budget alarms.
2. Automated checks: frontmatter schema, broken links, every task ID valid, every mistake row has a source, `last_verified` within 90 days.
3. Technical review by someone who has run the service in production.
4. Exam-alignment review: the question writer confirms the page covers its tagged task statements.
5. Merge publishes to a preview, then production.

**Freshness tracking.**

- A weekly job diffs the AWS exam guides on docs.aws.amazon.com for each tracked exam and opens an issue when task statements change
- A watch list on the AWS What's New feed and the Training and Certification blog, filtered to tracked services, flags launches, renames and exam version changes
- Pages older than 90 days since verification show a visible "needs review" badge to readers
- The objective map recalculates coverage on every build, so a new task statement shows as a gap immediately

## Roadmap

Four phases over roughly 26 weeks, ordered so the most-demanded content (DVA-C03) is useful on its own before anything else ships. Estimates assume 2 authors and 1 engineer. Each gate is a go/no-go check.

| Phase | Weeks | Deliverables | Gate to exit |
| --- | --- | --- | --- |
| 0 Discovery | 1–2 | User interviews (5–10), competitive scan, DVA-C03 exam guide (Oct 27) turned into the canonical objective list, final page template | Scope agreed |
| 1 Foundation | 3–10 | Site skeleton + CI, 15 DVA-C03 pages, DVA-C03 hub with 150 questions, 2 case studies | Every DVA-C03 task statement mapped to a page and practice questions |
| 2 Breadth | 11–18 | 15 more service pages, AIP-C01 + DOP-C02 hubs, decision guides, sign-in + progress, 4 more case studies | 30 pages and 6 case studies live |
| 3 Intelligence | 19–26 | KB assistant on Bedrock, adaptive quizzes, search by error message, AI security labs | — |

Ongoing: 90-day page checks, weekly exam-guide diff, quiz analytics review.

## Review: how could this be improved?

The biggest risk is timing, not technology: DVA-C03's full exam guide publishes October 27, 2026 and the exam goes live December 1, so content written before then is built on a summary. The second risk is competition: AWS Skill Builder and many paid courses already cover these exams, so the KB must win on decisions, mistakes and real scenarios.

### Gaps in the analysis

- **DVA-C03 detail is incomplete.** Domain weights, new services and the new AI-security task come from AWS's own announcement, but individual task statements were not yet published when this plan was written. Rebuild the objective map from the official guide after October 27.
- **Some exam statuses were not re-checked.** DOP-C02, SAA-C03, AIF-C01 and CLF-C02 are listed as current from AWS exam-guide pages and third-party summaries; confirm each on the AWS certification site before publishing hubs. The refreshed Security – Specialty, with expanded AI security, was left out and may deserve a hub.
- **Scope was set by judgment.** Data Engineer – Associate, the AI Business Strategist exam and MLA-C02 are light or absent; the right cut depends on the audience.
- **No user validation or competitive scan.** Five to ten interviews and a look at Skill Builder, Tutorials Dojo and similar sites would show what is missing and whether people want a reference, an exam tool, or both.
- **Effort and ownership are unstated.** 40+ pages with tested code in two languages needs named owners and an authoring rate per page.
- **Success metrics measure output, not outcome.** Add self-reported pass rate, time to find an answer, return visits and quiz score improvement.
- **Exam-content rules aren't addressed.** AWS's certification agreement forbids sharing live exam content; questions must be original, with a written authoring policy.

### Improvements to the knowledge base, in priority order

1. **Decision guides as first-class pages.** "SQS vs SNS vs EventBridge vs Kinesis", "Lambda vs Fargate vs ECS on EC2", "SAM vs CDK vs CloudFormation", "Secrets Manager vs Parameter Store". These are where exam questions and real projects both get stuck.
2. **Search by symptom.** Index pages by error messages (`ProvisionedThroughputExceededException`, `AccessDeniedException`, `Task timed out after 3.00 seconds`, 502 from API Gateway) so a pasted error lands on the right mistake row.
3. **Hands-on, not just read.** One-command CDK labs with automatic teardown and budget alarms, plus Logs Insights query exercises against sample logs.
4. **An "AI security" track.** DVA-C03 Task 2.3 is new and thinly covered elsewhere: prompt injection, agent permissions, Guardrails, and log data protection deserve their own pages and labs.
5. **Adaptive exam prep.** A diagnostic quiz that maps weak task statements to pages, with spaced repetition driven by each reader's misses.
6. **An AI assistant over the KB.** Build case study 3 for real on Bedrock: retrieval over the site with citations back to pages.
7. **Map to the Well-Architected Framework.** Tag pages and case studies with the six pillars they touch, for SAA and SAP candidates.
8. **Cross-cloud bridge with the Azure KB.** A "same concept, other cloud" link on every page (SQS ↔ Service Bus, Lambda ↔ Functions, DynamoDB ↔ Cosmos DB); both KBs share one template and pipeline, so the second costs far less than the first.
9. **Version content by exam revision.** Keep a changelog per hub (DVA-C02 → C03, SAP-C02 → C03) so candidates know what moved.
10. **Accessibility and reach.** WCAG 2.2 AA from day one, offline reading as a PWA, and translation of top pages later.

**Recommended next step:** run discovery now, but start Phase 1 authoring only after the DVA-C03 exam guide is published on October 27.

## Sources

- [AWS Training and Certification blog — Certification updates, September 2026](https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/)
- [AWS — Certified Developer – Associate](https://aws.amazon.com/certification/certified-developer-associate/)
- [AWS — Generative AI Developer – Professional (AIP-C01) exam guide](https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.md)
- [AWS — DevOps Engineer – Professional (DOP-C02) exam guide](https://docs.aws.amazon.com/de_de/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02.html)
- [Tutorials Dojo — What's new with DVA-C03](https://tutorialsdojo.com/whats-new-with-the-aws-certified-developer-associate-dva-c03/)
- [CertCrush — SAP-C03 and DVA-C03 release dates](https://www.certcrush.app/blog/aws-sap-c03-dva-c03-release-dates-2026)

