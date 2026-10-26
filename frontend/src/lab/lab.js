// The browser-side equivalent of a lab backend. A public lab can't call real AWS (it would need an
// account, credentials and a bill), so every demo runs in this page: the repository's own logic
// (imported from site/src/lib, or ported line for line where the original is a Node script) and
// small simulations of the AWS behaviour the knowledge base documents. Each returns a DemoResult
// { demo, commands, data, checks, elapsedMs }; `checks` prove the behaviour the page explains.

export const clamp = (value, min, max, fallback = min) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export const clampInt = (value, min, max, fallback = min) => Math.round(clamp(value, min, max, fallback));

/** Picks `value` if it is one of `options`, otherwise the first option. Inputs never reach code as-is. */
export const oneOf = (value, options) => (options.includes(value) ? value : options[0]);

export const bool = (value) => value === true || value === 'true' || value === 1 || value === '1';

export const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export const fmtMs = (ms) => (ms < 1 ? `${ms.toFixed(2)} ms` : ms < 100 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`);

/** Deterministic random numbers, so a demo and its self-test see the same run. */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An error shaped like the one the AWS SDK throws: `name` is the exception, `message` the text. */
export class AwsError extends Error {
  constructor(name, message, extra = {}) {
    super(message);
    this.name = name;
    Object.assign(this, extra);
  }
}

export class Demo {
  constructor(id) {
    this.id = id;
    this.commands = [];
    this.checks = [];
    this.started = performance.now();
  }

  cmd(text) {
    this.commands.push(text);
  }

  check(name, passed, detail) {
    this.checks.push({ name, passed: Boolean(passed), detail: detail == null ? '' : String(detail) });
    return Boolean(passed);
  }

  /** Runs a deliberate mistake and records the error it raised. Returns { ok, error, value }. */
  attempt(label, fn) {
    try {
      const value = fn();
      this.cmd(`${label} → no error raised (the failure is silent)`);
      return { ok: true, error: null, value };
    } catch (error) {
      this.cmd(`✗ ${label} → ${error.name}: ${error.message}`);
      return { ok: false, error };
    }
  }

  result(data = {}) {
    return {
      demo: this.id,
      commands: this.commands,
      data,
      checks: this.checks,
      elapsedMs: Math.round((performance.now() - this.started) * 10) / 10,
    };
  }
}
