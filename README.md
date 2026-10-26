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

## Deploying

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
