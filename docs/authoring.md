# Authoring guide

## Adding a concept page

1. Pick the service slug from `site/src/data/domains.ts`. The file goes at
   `content/concepts/<domain>/<service>.mdx`.
2. Copy `content/concepts/compute-and-containers/lambda.mdx` and keep its structure.
3. Put the samples in `samples/concepts/<service>/`, with tests next to them (see below).
4. Add at least three practice questions in `content/exams/dva-c03/questions/<service>.yaml`. Five or more is better,
   because "Check yourself" shows up to five.
5. Run `npm run check:content`, then `npm run build` and `npm run check:links`.

## The nine blocks

The header (block 1) comes from frontmatter. Blocks 2–9 are H2 sections with exactly these titles, in this order.
The checker enforces both.

| # | Section | What goes in it |
| --- | --- | --- |
| 1 | Header (frontmatter) | `title`, `summary` (one line), `exams`, `exam_domains`, `tasks`, `difficulty`, `last_verified` |
| 2 | `## When to use it / when not to` | Two short lists, plus a "Compare with" line |
| 3 | `## How it works` | A mermaid diagram, then 3–5 short paragraphs on the core model |
| 4 | `## Code` | `<CodeTabs tabs={[...]} />` with Python, TypeScript and the CDK or SAM snippet |
| 5 | `## Key limits and defaults` | `<LimitsTable service="..." />`, rendered from `limits:` in frontmatter |
| 6 | `## Common mistakes` | `<MistakesTable service="..." />`, rendered from `mistakes:` (5–8 rows) |
| 7 | `## Security and cost notes` | A least-privilege policy, networking, and the setting that most often surprises the bill |
| 8 | `## Check yourself` | `<CheckYourself service="..." count={5} />` |
| 9 | `## Go deeper` | `<GoDeeper service="..." />`, rendered from `sources:` and `related:` |

The components are available in every concept page without an import.

## Frontmatter reference

| Field | Notes |
| --- | --- |
| `service` | Slug from `domains.ts`; must match the file name |
| `domain` | One of the six KB domains; must match the folder |
| `exams` | Exam codes, e.g. `[DVA-C03]` |
| `exam_domains` | e.g. `[DVA-C03-D1]`; must exist in that exam's `objectives.yaml` |
| `tasks` | Task-statement IDs, e.g. `[DVA-C03-2.3]`; must exist in `objectives.yaml`. These drive the coverage % on the hub |
| `last_verified` | The date someone last checked the page against AWS docs; reset it whenever you re-verify |
| `sources` | AWS docs the page relies on (shown under Go deeper) |
| `limits[]` | `name`, `value`, optional `note`, and `source` (URL of the AWS doc page) |
| `mistakes[]` | `mistake`, `symptom`, `why`, `fix`, `severity` (high/medium/low), optional `errors` (literal error text, indexed for search), `source` |
| `related` | Service slugs; pages that aren't written yet show as "coming soon" |

## Code samples

- Samples live in `samples/concepts/<service>/{python,typescript,cdk}/` and are shown on the page straight from the
  file, so what readers copy is what CI tests.
- Use IAM roles; never put access keys in a sample.
- A TypeScript sample `foo.ts` needs `foo.test.ts` beside it. A Python sample needs `tests/test_*.py` in its project
  folder; give the test file a unique name such as `test_<service>_<thing>.py`.
- A CDK stack goes in `samples/cdk-app.ts` so the live workflow deploys it. Add a `*.live.test.ts` that checks it
  works against real AWS.

## Diagrams

Use a fenced `mermaid` block. Start it with `accTitle:` and `accDescr:` lines; mermaid turns them into the SVG's
accessible title and description.

## Exam facts

Before an exam fact (domain, weight, task statement, date, format) goes into `content/`, check it against the
official AWS exam guide or announcement. Record the source and date under `verified:` in `exam.yaml`. When a new
exam guide publishes:

1. Add its page URLs (prefer the `.md` versions on docs.aws.amazon.com) to `guide_urls` in `exam.yaml`.
2. Copy the task statements into `objectives.yaml` and set `status: official`.
3. Tag pages and questions with the new task IDs; the hub's coverage then shows any gaps.
