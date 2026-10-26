// The Lambda page's own "Common mistakes" rows (lambda.mdx frontmatter), reused as demo pitfalls so
// the lab shows exactly what the KB says, with its source. `extra` adds what the page doesn't have:
// how to avoid it, Don't/Do code, and the action that reproduces it.
import { LAMBDA } from '../kb/repo.js';

export function kbMistake(fragment, extra = {}) {
  const m = LAMBDA.data.mistakes.find((x) => x.mistake.includes(fragment));
  if (!m) throw new Error(`lambda.mdx has no common mistake matching "${fragment}"`);
  return {
    mistake: m.mistake,
    symptom: m.errors?.length ? `${m.errors.join('\n')}\n${m.symptom}` : m.symptom,
    why: m.why,
    fix: m.fix,
    severity: m.severity,
    source: m.source,
    fromKb: true,
    ...extra,
  };
}
