// The lab ports a few pieces of the repository that can't be imported in a browser (Node scripts
// that run on import, a CloudFront Function inlined in a CDK stack). These tests fail if the
// originals change and the ports don't.
import { describe, expect, it } from 'vitest';
import { LAMBDA, SOURCES, CONCEPTS, QUESTIONS } from '../kb/repo.js';
import { CHECK_YOURSELF_MIN, MISTAKES_MAX, MISTAKES_MIN, TEMPLATE_HEADINGS, toText } from '../lab/pipeline.js';
import { REWRITE_SOURCE, indexRewrite, BUDGET_ALARMS, DEPLOY_RULES, DEFAULT_REPO } from '../lab/hosting.js';
import { LIMIT_RULES } from '../lab/lambda.js';
import { readStack } from '../lab/worker.js';
import { DEMOS } from '../demos/catalog.js';

describe('ports match the repository', () => {
  it('TEMPLATE_HEADINGS and limits match scripts/check-content.ts', () => {
    const block = SOURCES.checkContentTs.match(/export const TEMPLATE_HEADINGS = \[([\s\S]*?)\];/)[1];
    expect([...block.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(TEMPLATE_HEADINGS);
    expect(SOURCES.checkContentTs).toContain(`const MISTAKES_MIN = ${MISTAKES_MIN};`);
    expect(SOURCES.checkContentTs).toContain(`const MISTAKES_MAX = ${MISTAKES_MAX};`);
    expect(SOURCES.checkContentTs).toContain(`const CHECK_YOURSELF_MIN = ${CHECK_YOURSELF_MIN};`);
  });

  it('toText() is the same code as scripts/exam-guide-diff.ts', () => {
    // Vite re-prints the function (quotes, line breaks), so compare without whitespace, quote style or types
    const norm = (src) => src.replace(/\/\/[^\n]*/g, '').replace(/: string/g, '').replace(/\s+/g, '').replace(/"/g, "'");
    const original = SOURCES.examGuideDiffTs.match(/function toText\([\s\S]*?\n\}/)[0];
    expect(norm(toText.toString())).toBe(norm(original));
  });

  it('indexRewrite() behaves like the CloudFront Function in site-stack.ts', () => {
    expect(REWRITE_SOURCE).toContain("if (uri.endsWith('/')) request.uri = uri + 'index.html';");
    expect(REWRITE_SOURCE).toContain("else if (!uri.split('/').pop().includes('.')) request.uri = uri + '/index.html';");
    expect(indexRewrite('/concepts/')).toBe('/concepts/index.html');
    expect(indexRewrite('/concepts/x')).toBe('/concepts/x/index.html');
    expect(indexRewrite('/favicon.svg')).toBe('/favicon.svg');
  });

  it('reads the settings from the infra, sample stack and workflows', () => {
    expect(BUDGET_ALARMS.length).toBe(3);
    expect(DEPLOY_RULES.assets).toMatch(/immutable/);
    expect(DEPLOY_RULES.pages).toMatch(/max-age=300/);
    expect(DEPLOY_RULES.excludesAssetsFromDelete).toBe(true);
    expect(DEFAULT_REPO).toMatch(/^[\w.-]+\/[\w.-]+$/);
    const stack = readStack();
    expect(stack.timeoutS).toBeGreaterThan(0);
    expect(stack.visibilityS).toBe(stack.timeoutS * 6);
    expect(stack.grant).toBe('dynamodb:PutItem');
  });

  it('every numeric limit rule names a limit on the Lambda page', () => {
    const names = LAMBDA.data.limits.map((l) => l.name);
    LIMIT_RULES.forEach((r) => expect(names).toContain(r.name));
  });

  it('every common mistake on the Lambda page appears in the lab', () => {
    const used = DEMOS.flatMap((d) => d.pitfalls).map((p) => p.mistake);
    LAMBDA.data.mistakes.forEach((m) => expect(used).toContain(m.mistake));
  });

  it('loads the content', () => {
    expect(CONCEPTS.length).toBeGreaterThan(0);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(3);
  });
});
