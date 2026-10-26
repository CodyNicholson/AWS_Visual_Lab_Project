// How the KB site itself is hosted and shipped (infra/ and .github/workflows/): a private S3 bucket
// behind CloudFront with origin access control, GitHub Actions assuming roles through OIDC, the deploy
// workflow's caching rules, and the sandbox budget alarms. Settings are read from those files.
import { AwsError, Demo, bool, clamp, clampInt, oneOf, round } from './lab.js';
import { CONCEPTS, EXAMS, SOURCES } from '../kb/repo.js';

// ---- S3 + CloudFront --------------------------------------------------------------------------

/** Port of the CloudFront Function inlined in infra/lib/site-stack.ts (the test suite compares the two). */
export function indexRewrite(uri) {
  if (uri.endsWith('/')) return uri + 'index.html';
  if (!uri.split('/').pop().includes('.')) return uri + '/index.html';
  return uri;
}

export const REWRITE_SOURCE = SOURCES.siteStack.match(/function handler\(event\) \{[\s\S]*?\n\}/)?.[0] || '';

/** The objects the Astro build uploads (site/dist), derived from the repo's content. */
export function siteObjects() {
  const pages = ['/', '/search/', '/concepts/', '/decide/', '/case-studies/', '/exams/', '/mistakes/'];
  CONCEPTS.forEach((c) => pages.push(`/concepts/${c.data.domain}/${c.data.service}/`));
  EXAMS.forEach((e) => pages.push(`/exams/${e.data.code.toLowerCase()}/`, `/exams/${e.data.code.toLowerCase()}/practice/`));
  return new Set([...pages.map((p) => `${p}index.html`), '/404.html', '/favicon.svg', '/_astro/client.Bx1a2b3c.js']);
}

export const SECURITY_HEADERS = {
  'strict-transport-security': `max-age=${Number(SOURCES.siteStack.match(/accessControlMaxAge: Duration\.days\((\d+)\)/)?.[1]) * 86400}; includeSubDomains`,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

const cleanPath = (p) => {
  const s = String(p ?? '');
  return /^\/[A-Za-z0-9/._-]{0,120}$/.test(s) ? s : '/concepts/compute-and-containers/lambda';
};

export function request({ path, via, bucket, rewrite }) {
  const objects = siteObjects();
  const steps = [];
  if (via === 'S3 bucket URL directly') {
    if (bucket === 'public website bucket') {
      const key = indexRewrite(path);
      steps.push(`GET http://site-bucket.s3-website…${path} (plain HTTP, no CDN, no security headers)`);
      return { status: objects.has(key) ? 200 : 404, key, steps, headers: {}, bypass: true };
    }
    steps.push(`GET https://site-bucket.s3.amazonaws.com${path}`);
    steps.push('S3: BlockPublicAccess BLOCK_ALL; only the CloudFront distribution may read (OAC)');
    return { status: 403, steps, error: '<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>', headers: {} };
  }
  steps.push(`viewer GET https://kb.example.com${path} → CloudFront (HTTP redirects to HTTPS)`);
  const key = rewrite ? indexRewrite(path) : path;
  steps.push(rewrite ? `viewer-request function IndexRewrite: ${path} → ${key}` : `no rewrite function: origin key stays ${path}`);
  steps.push(`origin request to S3 signed with SigV4 by origin access control: GetObject ${key}`);
  if (objects.has(key)) {
    steps.push('S3 200 → cached (CachingOptimized), compressed, security headers added');
    return { status: 200, key, steps, headers: SECURITY_HEADERS };
  }
  steps.push("S3 403 AccessDenied (a missing key looks like 403 when the caller can't list the bucket)");
  steps.push('errorResponses: 403/404 → 404 with /404.html (TTL 5 min)');
  return { status: 404, key, steps, headers: SECURITY_HEADERS, errorPage: '/404.html' };
}

export function hosting(inputs, { noRewrite = false, publicBucket = false } = {}) {
  const d = new Demo('s3-cloudfront');
  const path = noRewrite ? '/concepts/' : cleanPath(inputs.path);
  const via = publicBucket ? 'S3 bucket URL directly' : oneOf(inputs.via, ['CloudFront', 'S3 bucket URL directly']);
  const bucket = publicBucket ? 'public website bucket' : 'private + OAC (SiteStack)';
  const rewrite = noRewrite ? false : bool(inputs.rewrite ?? true);
  const r = request({ path, via, bucket, rewrite });
  r.steps.forEach((s) => d.cmd(s));
  d.cmd(`→ HTTP ${r.status}${r.errorPage ? ` (${r.errorPage})` : ''}${r.error ? ` ${r.error}` : ''}`);

  if (noRewrite) {
    const fixed = request({ path, via: 'CloudFront', bucket, rewrite: true });
    d.check('Without the rewrite, a directory URL misses its index.html', r.status === 404, `${path} → key ${r.key} → ${r.status}`);
    d.check('IndexRewrite fixes it', fixed.status === 200, `${path} → ${fixed.key} → ${fixed.status}`);
  } else if (publicBucket) {
    d.check('A public bucket serves the site around CloudFront', r.bypass && r.status === 200, 'no HTTPS redirect, no security headers, no CDN');
    const priv = request({ path, via: 'S3 bucket URL directly', bucket: 'private + OAC (SiteStack)', rewrite: true });
    d.check('SiteStack’s private bucket refuses the same request', priv.status === 403, 'AccessDenied: only CloudFront (OAC) can read');
  } else if (via === 'CloudFront') {
    d.check(r.status === 200 ? 'The page is served from the private bucket' : 'A missing page gets the 404 page, not an S3 error', r.status === 200 || r.errorPage === '/404.html', `HTTP ${r.status}`);
    d.check('Responses carry the security headers', Object.keys(r.headers).length === 4, Object.keys(r.headers).join(', '));
  } else {
    d.check('The bucket is never public: direct requests are refused', r.status === 403, 'BLOCK_ALL + enforceSSL');
  }
  return d.result({ ...r, path, via, bucket, rewrite, rewriteSource: REWRITE_SOURCE });
}

// ---- GitHub OIDC ------------------------------------------------------------------------------

export const DEFAULT_REPO = SOURCES.infraApp.match(/ctx\('githubRepo'\) \?\? '([^']+)'/)?.[1] || 'owner/repo';
export const TRIGGERS = ['deploy job (environment: production)', 'live samples job (environment: sandbox)', 'pull request run', 'a different repository'];

export function claimsFor(trigger, repo) {
  const sub = {
    [TRIGGERS[0]]: `repo:${repo}:environment:production`,
    [TRIGGERS[1]]: `repo:${repo}:environment:sandbox`,
    [TRIGGERS[2]]: `repo:${repo}:pull_request`,
    [TRIGGERS[3]]: 'repo:someone-else/other-repo:ref:refs/heads/main',
  }[trigger];
  return { iss: 'https://token.actions.githubusercontent.com', aud: 'sts.amazonaws.com', sub };
}

export function roles(repo, loose = false) {
  return [
    {
      name: 'SiteDeployRole',
      condition: loose ? { StringLike: { sub: 'repo:*' } } : { StringEquals: { sub: `repo:${repo}:environment:production` } },
      can: ['s3:GetObject*/PutObject*/DeleteObject* on the site bucket', 'cloudfront:CreateInvalidation on the distribution'],
    },
    {
      name: 'SamplesTestRole',
      condition: { StringEquals: { sub: `repo:${repo}:environment:sandbox` } },
      can: ['sts:AssumeRole on cdk-* bootstrap roles', 'sqs:SendMessage, dynamodb:GetItem, cloudformation:DescribeStacks in the account'],
    },
  ];
}

const like = (pattern, v) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(v);

export function assumeRoleWithWebIdentity(role, claims) {
  const [op, cond] = Object.entries(role.condition)[0];
  const ok = claims.aud === 'sts.amazonaws.com' && (op === 'StringEquals' ? claims.sub === cond.sub : like(cond.sub, claims.sub));
  if (!ok) throw new AwsError('AccessDenied', 'Not authorized to perform sts:AssumeRoleWithWebIdentity');
  return { role: role.name, durationHours: 1 };
}

export function oidc(inputs, { looseTrust = false } = {}) {
  const d = new Demo('github-oidc');
  const repo = /^[A-Za-z0-9._-]{1,60}\/[A-Za-z0-9._-]{1,60}$/.test(String(inputs.repo)) ? String(inputs.repo) : DEFAULT_REPO;
  const trigger = looseTrust ? TRIGGERS[3] : oneOf(inputs.trigger, TRIGGERS);
  const claims = claimsFor(trigger, repo);
  d.cmd(`GitHub issues an OIDC token: aud=${claims.aud} sub=${claims.sub}`);
  const results = roles(repo, looseTrust).map((role) => {
    const a = d.attempt(`AssumeRoleWithWebIdentity ${role.name}`, () => assumeRoleWithWebIdentity(role, claims));
    if (a.ok) d.cmd(`→ temporary credentials for ${role.name} (max 1 hour)`);
    return { ...role, ok: a.ok, error: a.error?.message };
  });
  const assumed = results.filter((r) => r.ok).map((r) => r.name);
  if (looseTrust) {
    d.check('A wildcard trust lets any repository on GitHub deploy your site', assumed.includes('SiteDeployRole'), `sub ${claims.sub} matched repo:*`);
    const strict = roles(repo).find((r) => r.name === 'SiteDeployRole');
    let blocked = false;
    try {
      assumeRoleWithWebIdentity(strict, claims);
    } catch {
      blocked = true;
    }
    d.check('GithubOidcStack’s StringEquals on one repo + environment blocks it', blocked, `only repo:${repo}:environment:production`);
  } else {
    const expect = { [TRIGGERS[0]]: ['SiteDeployRole'], [TRIGGERS[1]]: ['SamplesTestRole'], [TRIGGERS[2]]: [], [TRIGGERS[3]]: [] }[trigger];
    d.check(`${trigger}: ${expect.length ? `gets only ${expect.join()}` : 'gets no role'}`, assumed.join() === expect.join(), assumed.join(', ') || 'none');
    d.check('No AWS access keys are stored in GitHub', !/secrets\.AWS_/.test(SOURCES.deployYml + SOURCES.samplesLiveYml), 'deploy.yml and samples-live.yml use role-to-assume');
  }
  return d.result({ repo, trigger, claims, results, looseTrust });
}

// ---- Deploy caching ---------------------------------------------------------------------------

const dy = SOURCES.deployYml;
export const DEPLOY_RULES = {
  assets: dy.match(/_astro" --cache-control "([^"]+)"/)?.[1],
  pages: dy.match(/--exclude "_astro\/\*" --cache-control "([^"]+)"/)?.[1],
  excludesAssetsFromDelete: /--delete --exclude "_astro\/\*"/.test(dy),
  invalidation: dy.match(/--paths "([^"]+)"/)?.[1],
};

export function deployCache(inputs, { deleteAssets = false } = {}) {
  const d = new Demo('deploy-caching');
  const tabAge = clampInt(inputs.tabAgeMin, 0, 240, 30);
  const htmlCachedAgo = clampInt(inputs.htmlCachedAgoMin, 0, 30, 2);
  const keepOld = deleteAssets ? false : DEPLOY_RULES.excludesAssetsFromDelete;
  d.cmd(`deploy.yml: _astro/* → Cache-Control "${DEPLOY_RULES.assets}"; pages → "${DEPLOY_RULES.pages}"`);
  d.cmd(`t-${tabAge}m  a reader opens /concepts/…/lambda/ (HTML v1 → /_astro/practice.v1.js, not loaded yet)`);
  d.cmd(`t+0m   aws s3 sync … ${keepOld ? '--delete --exclude "_astro/*"' : '--delete (old _astro files removed)'}  +  create-invalidation --paths "${DEPLOY_RULES.invalidation}"`);
  const chunk = keepOld ? 200 : 404;
  d.cmd(`t+1m   the open tab lazy-loads /_astro/practice.v1.js → ${chunk}${chunk === 404 ? ' (the island fails: "Failed to fetch dynamically imported module")' : ''}`);
  const maxAge = Number(DEPLOY_RULES.pages?.match(/max-age=(\d+)/)?.[1] || 0);
  const staleUntil = Math.max(0, maxAge / 60 - htmlCachedAgo);
  d.cmd(`a browser that cached the HTML ${htmlCachedAgo} min before the deploy keeps it ${round(staleUntil, 1)} more min (max-age=${maxAge}), then must revalidate`);

  if (deleteAssets) {
    d.check('Deleting old hashed assets breaks tabs opened before the deploy', chunk === 404, '404 for /_astro/practice.v1.js');
    d.check('deploy.yml avoids this by excluding _astro/* from --delete', DEPLOY_RULES.excludesAssetsFromDelete, '--delete --exclude "_astro/*"');
  } else {
    d.check('Hashed assets are cached for a year and never change', /max-age=31536000/.test(DEPLOY_RULES.assets) && /immutable/.test(DEPLOY_RULES.assets), DEPLOY_RULES.assets);
    d.check('Old assets survive the deploy, so open tabs keep working', chunk === 200, '200 for /_astro/practice.v1.js');
    d.check('Pages refresh within 5 minutes even in browser caches', maxAge === 300 && /must-revalidate/.test(DEPLOY_RULES.pages), DEPLOY_RULES.pages);
  }
  return d.result({ rules: DEPLOY_RULES, tabAge, keepOld, chunk, maxAge, staleUntil: round(staleUntil, 1), htmlCachedAgo });
}

// ---- Sandbox budget ---------------------------------------------------------------------------

export const BUDGET_ALARMS = [...SOURCES.budgetStack.matchAll(/notificationType: '(\w+)', comparisonOperator: 'GREATER_THAN', threshold: (\d+)/g)].map((m) => ({
  type: m[1],
  threshold: Number(m[2]),
}));
export const DEFAULT_BUDGET = Number(SOURCES.infraApp.match(/ctx\('budgetUsd'\) \?\? (\d+)/)?.[1] || 25);

export function simulateBudget({ budget, daily, spikeDay, spikeUsd, alarms }) {
  let total = 0;
  const days = [];
  const fired = {};
  for (let day = 1; day <= 30; day++) {
    total += daily + (day === spikeDay ? spikeUsd : 0);
    const forecast = (total / day) * 30; // a simple linear forecast for the demo
    days.push({ day, total: round(total, 2), forecast: round(forecast, 2) });
    for (const a of alarms) {
      const key = `${a.type} ${a.threshold}%`;
      const value = a.type === 'ACTUAL' ? total : forecast;
      if (!fired[key] && value > (budget * a.threshold) / 100) fired[key] = day;
    }
  }
  return { days, fired, total: round(total, 2) };
}

export function budget(inputs, { onlyActual = false } = {}) {
  const d = new Demo('sandbox-budget');
  const amount = clampInt(inputs.budgetUsd, 1, 1000, DEFAULT_BUDGET);
  const daily = clamp(inputs.dailyUsd, 0, 100, 0.5);
  const spikeDay = clampInt(inputs.spikeDay, 0, 30, 8);
  const spikeUsd = clamp(inputs.spikeUsd, 0, 1000, 15);
  const alarms = onlyActual ? [{ type: 'ACTUAL', threshold: 100 }] : BUDGET_ALARMS;
  d.cmd(`sandbox-budget-stack.ts: ${BUDGET_ALARMS.map((a) => `${a.type} > ${a.threshold}%`).join(', ')} → email`);
  d.cmd(`budget $${amount}/month; spend $${daily}/day${spikeDay ? `, plus $${spikeUsd} on day ${spikeDay} (a forgotten NAT gateway, a recursive loop…)` : ''}`);
  const sim = simulateBudget({ budget: amount, daily, spikeDay, spikeUsd, alarms });
  Object.entries(sim.fired).forEach(([k, day]) => d.cmd(`day ${day}: alarm ${k} → email`));
  d.cmd(`month total $${sim.total} (${round((sim.total / amount) * 100, 0)}% of budget)`);

  const forecastDay = sim.fired['FORECASTED 100%'];
  const actualDay = sim.fired['ACTUAL 100%'];
  if (onlyActual) {
    const full = simulateBudget({ budget: amount, daily, spikeDay, spikeUsd, alarms: BUDGET_ALARMS });
    const early = full.fired['FORECASTED 100%'];
    d.check('With only an ACTUAL 100% alarm you hear about it after the money is spent', !actualDay || actualDay >= (early || 0), actualDay ? `first email on day ${actualDay}` : 'no email at all this month');
    d.check('The stack’s forecast alarm warns earlier', early != null && (!actualDay || early < actualDay), early ? `forecast alarm on day ${early}` : 'n/a');
  } else {
    d.check('The stack defines three alarms: 50% and 100% actual, 100% forecast', BUDGET_ALARMS.length === 3, BUDGET_ALARMS.map((a) => `${a.type} ${a.threshold}%`).join(', '));
    if (forecastDay && actualDay) d.check('The forecast alarm fires before the actual 100% alarm', forecastDay <= actualDay, `day ${forecastDay} vs day ${actualDay}`);
    else d.check('Spending under the budget fires at most the early alarms', !actualDay, `fired: ${Object.keys(sim.fired).join(', ') || 'none'}`);
  }
  return d.result({ ...sim, amount, alarms, onlyActual });
}
