# AWS Dev KB

One site where every critical AWS developer service has its own page, every page maps to the current exam
objectives, and every concept is reinforced by tested code. The core track is the AWS Certified Developer –
Associate exam, **DVA-C03**, which replaces DVA-C02 on December 1, 2026.

The full plan is in [`aws-vl-plan.md`](aws-vl-plan.md).

## Status

Phase 1 (Foundation) is in progress.

| Deliverable | Status |
| --- | --- |
| Site skeleton (Astro + MDX + Tailwind + React islands + Pagefind) | Done |
| CI: content checks, typecheck, sample tests, CDK synth, build, link check | Done |
| Hosting: private S3 + CloudFront (OAC), GitHub OIDC deploy role | Written and tested with CDK assertions; not deployed yet |
| Concept pages | 1 of 15 (AWS Lambda, the template exemplar) |
| DVA-C03 hub: objective map, practice mode | Done; 9 of 150 questions |
| DVA-C03 objective map | Provisional: domains and weights only, until the exam guide publishes on Oct 27, 2026 |
| Case studies | 0 of 2 |

## Repository layout

```
site/        Astro site: layouts, components, React islands (quiz, practice exam, mistakes filter)
content/     Everything authors write, reviewed like code
  concepts/<domain>/<service>.mdx    one page per service (nine-block template)
  decide/<topic>.mdx                 decision guides
  case-studies/<slug>.mdx            case studies
  exams/<code>/exam.yaml             format, dates, where the facts were verified
  exams/<code>/objectives.yaml       domains -> task statements (the objective map)
  exams/<code>/questions/*.yaml      original practice questions
samples/     Code shown on pages, tested in CI (Python boto3, TypeScript SDK v3, CDK)
infra/       CDK app: site hosting, GitHub OIDC roles, sandbox budget alarms
scripts/     Content checks, coverage report, link check, exam-guide diff, Docker helpers
docs/        Authoring guide and question-writing policy
.github/     CI, deploy, live sample tests, weekly freshness job
frontend/    The visual lab: a React app that explains everything in this repository (see below)
```

## Working locally

The commands below run inside Docker, so you don't need Node or Python installed.
If you do have Node 24+, drop the `scripts/npm.sh` prefix.

```bash
scripts/npm.sh npm ci                      # install
scripts/npm.sh npm run check:content       # template, schema, tags, samples, freshness
scripts/npm.sh npm run typecheck
scripts/npm.sh npm test                    # TypeScript + CDK sample tests, infra tests
scripts/pytest.sh                          # Python sample tests
scripts/npm.sh npm run build               # static site + search index in site/dist
scripts/npm.sh npm run check:links
scripts/npm.sh npm run coverage            # objective-map coverage as Markdown
DOCKER_ARGS="-p 4321:4321" scripts/npm.sh npm run dev -w site -- --host   # http://localhost:4321
```

Search only works on a built site: run `npm run build`, then `npm run preview -w site -- --host` (with the same port
mapping).

## Visual lab

`frontend/` is an interactive React + Vite app that explains everything in this repository, one animated
page per topic, in the format of the other visual labs in the workspace. It is served by one unprivileged nginx
container and deployed behind the Cloudflare tunnel.

There is no backend and nothing calls real AWS (that would need an account, credentials and a bill). Each demo
runs in the visitor's browser:

- the repository's own code, imported at build time: `site/src/lib/coverage.ts`, `freshness.ts`,
  `site/src/islands/types.ts` (grading), `site/src/data/domains.ts`, and the content in `content/`;
- line-for-line ports where the original can't run in a browser (the order-worker handler from
  `samples/concepts/lambda/typescript/order-worker.ts`, the CloudFront Function in `infra/lib/site-stack.ts`, the
  template rules in `scripts/check-content.ts`, `toText()` from `scripts/exam-guide-diff.ts`). Tests fail if an
  original changes and its port doesn't;
- small simulations of the AWS behaviour the Lambda page documents (retries, concurrency, visibility timeouts,
  loop detection). Timings that are illustrative are labelled as such.

Settings shown in the lab (visibility timeout, DLQ, retention, cache headers, budget thresholds, OIDC trust,
CI jobs) are read from the CDK stacks and workflows, so the lab follows the repo when they change.

### What each page shows

An explanation, an animated request flow between the AWS services involved, buttons that run the demo, an
animated visual of the result, the real code or config from the repo, the common mistakes with sources (the
Lambda page's own seven rows included), and the steps and self-checks of the last run. Most pages have a
"Do it wrong" button that reproduces a mistake and shows the error. There is also an overview page, a searchable
"Mistakes, errors & fixes" page (paste an error message) and a "Run all demos" self-test page.

| Area | Pages |
| --- | --- |
| Exam prep: DVA-C03 | Blueprint and the C02 → C03 weight change · key dates · format, scoring and pacing · eight certifications · practice questions (interactive) · objective-map coverage |
| AWS Lambda fundamentals | Execution environments and cold starts · three ways to invoke · concurrency and throttling · versions, aliases and canaries · key limits |
| Lambda in production | VPC networking · recursive loops · execution role and least privilege · what surprises the bill |
| Order worker (SQS → Lambda → DynamoDB) | Partial batch responses · visibility timeout 6× rule · idempotent writes · the CDK stack, reviewed |
| Hosting and delivery | Private S3 + CloudFront (OAC) · GitHub Actions with OIDC · deploys and caching · sandbox budget alarms |
| Content pipeline | Nine-block template checker · question-writing policy · 90-day freshness · weekly exam-guide diff · CI and workflows |
| The plan and roadmap | Concept map (30 services) · six case studies · roadmap and Phase 1 progress |

31 pages; 47 feature pitfalls (32 with a "Reproduce it" button, 31 "Do it wrong" actions in all), 7 cross-service
anti-patterns and 7 general AWS errors (credentials, AccessDenied, timeouts, throttling, API Gateway 502,
`cdk bootstrap`, OIDC).

### Run it locally

```bash
cp .env.example .env               # set FRONTEND_HOST_PORT
docker network create tunnel-net   # once; docker-compose.yml declares it external
docker compose up -d --build       # http://127.0.0.1:<FRONTEND_HOST_PORT>
```

| Service | Container | Port |
| --- | --- | --- |
| frontend (nginx, React build) | `rixus-frontend` | `127.0.0.1:${FRONTEND_HOST_PORT}` → 80; Docker picks a free localhost port when it's empty |

Without Docker: `cd frontend && npm ci && npm run dev` (Node 22+). The dev server reads `../content`,
`../samples` and the other folders it explains.

### Configuration (`.env`, git-ignored)

| Variable | Used by | Notes |
| --- | --- | --- |
| `TUNNEL_TOKEN` | `pipeline-run.sh` | Only when it isn't set globally on the server |
| `FRONTEND_HOST_PORT` | `docker-compose.yml` | Localhost-only host port for the UI; the tunnel doesn't need it |
| `TEST_UI_PORT` | `docker-compose.test.yml` | Localhost port for the isolated test stack; Docker picks a free one when it's empty |

`.env.example` lists them with empty values. The Docker build context is the repository root, but
`.dockerignore` is an allowlist, so `.env`, `claude_logs/`, `pipeline-run.sh` and everything not needed for the
build stay out of the image.

### Tests

```bash
docker build -f frontend/Dockerfile --target test .   # Vitest: 357 tests
docker compose -p aws-visual-lab-project-test -f docker-compose.yml -f docker-compose.test.yml up -d --build
#   isolated stack on 127.0.0.1:${TEST_UI_PORT}, container aws-lab-test-frontend, not on tunnel-net
docker compose -p aws-visual-lab-project-test -f docker-compose.yml -f docker-compose.test.yml down -v
```

The Vitest suite checks that every page is complete (explanation, code, sourced pitfalls, flows of at most five
services), renders every page and every visual with a real result, runs every demo's self-test and every
"Do it wrong" action and fails on any failed check, feeds hostile inputs to every demo, and compares the ports
with their originals. In the browser, the "Run all demos" page runs the same self-tests.

### Deployment

`pipeline-run.sh` (git-ignored) deploys the lab like the other visual labs: it creates `.env` from
`.env.example` if needed, reads `TUNNEL_TOKEN`, pulls the repo (`git-pull-project.sh`), **removes every container
on the host**, starts `cloudflared-tunnel` on `tunnel-net`, then runs `docker compose up -d --build`. The tunnel
routes to `http://rixus-frontend:80`. Only one app is live in the tunnel at a time, so running it replaces
whatever is live. This is separate from the S3 + CloudFront deployment of the Astro site below.

### Notes and limits

- No AWS calls: results come from the repo's code and simulations of documented behaviour, not from a live
  account. Exact error messages are the ones AWS documents or returns; the lab raises them itself.
- The DVA-C03 task statements publish on Oct 27, 2026; until `objectives.yaml` lists them, coverage shows
  "not measurable" and the coverage page uses clearly marked hypothetical tasks.
- The diagram nodes, budget forecast (linear) and lifecycle timings are simplified on purpose.

## Deploying the KB site (S3 + CloudFront)

Nothing is deployed yet. You need an AWS account and the AWS CLI with admin credentials for the one-time setup.

1. Bootstrap CDK: `cd infra && npx cdk bootstrap`.
2. Deploy hosting and the GitHub roles: `npx cdk deploy AwsDevKb-Site AwsDevKb-GithubOidc`.
   Add `-c githubOidcProviderArn=...` if the account already has a GitHub OIDC provider, and
   `-c domainName=... -c certificateArn=...` (certificate in us-east-1) for a custom domain.
3. In the GitHub repository settings, create the `production` environment and set these repository variables from
   the stack outputs: `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET`, `DISTRIBUTION_ID`, `AWS_REGION` and `SITE_URL`.
   Pushes to `main` then deploy automatically.
4. For live sample tests, in a sandbox account: `cdk bootstrap`, deploy `AwsDevKb-GithubOidc`, deploy the budget alarm
   (`npx cdk deploy AwsDevKb-SandboxBudget -c budgetEmail=you@example.com -c budgetUsd=25`), create the `sandbox`
   environment and set `AWS_SAMPLES_ROLE_ARN`.

The deploy and live-sample workflows skip themselves until their role variables are set.

## Content rules

- Facts about exams (domains, weights, task statements, dates) come from official AWS pages and are recorded with
  their source and check date in `content/exams/<code>/exam.yaml`.
- Every limit and every common mistake links to the AWS doc it came from.
- Every page shows a "last verified" date. After 90 days the page shows a "Needs review" badge, and the weekly
  freshness job lists it in a tracking issue.
- Practice questions are original. See [docs/question-policy.md](docs/question-policy.md).

See [docs/authoring.md](docs/authoring.md) to add a page.
