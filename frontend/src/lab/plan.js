// The plan itself: the concept map (site/src/data/domains.ts vs the pages that exist), the six case
// studies, and the roadmap with Phase 1 progress measured from the repository.
import { Demo, clampInt, oneOf } from './lab.js';
import { CASE_STUDY_PAGES, CONCEPTS, DECISION_PAGES, DVA_OBJECTIVES, KB_DOMAINS, LAMBDA, MAX_AGE_DAYS, PLANNED_SERVICES, QUESTIONS, ageInDays } from '../kb/repo.js';
import { CASE_STUDIES, CASE_STUDY_STRUCTURE, DECISION_GUIDES, PHASE1_TARGETS, ROADMAP, SUCCESS_CRITERIA } from '../kb/plan.js';
import { checkConcept } from './pipeline.js';

// ---- Concept map ----------------------------------------------------------------------------

export function conceptMap(inputs, { unknownService = false } = {}) {
  const d = new Demo('concept-map');
  const domain = oneOf(inputs.domain, ['all', ...KB_DOMAINS.map((x) => x.slug)]);
  const live = new Map(CONCEPTS.map((c) => [c.data.service, c]));
  const grid = KB_DOMAINS.map((dom) => ({
    ...dom,
    services: dom.services.map((s) => ({
      ...s,
      live: live.has(s.slug),
      questions: QUESTIONS.filter((q) => q.services.includes(s.slug)).length,
      relatedToLambda: (LAMBDA.data.related || []).includes(s.slug),
    })),
  }));
  const total = grid.reduce((n, g) => n + g.services.length, 0);
  d.cmd(`site/src/data/domains.ts → ${KB_DOMAINS.length} domains, ${total} planned service pages`);
  d.cmd(`content/concepts/**/*.mdx → ${live.size} live: ${[...live.keys()].join(', ')}`);
  d.cmd(`lambda.mdx related: ${LAMBDA.data.related.map((r) => `${r}${live.has(r) ? '' : ' (coming soon)'}`).join(', ')}`);
  d.check('Six domains of five services: 30 planned pages', KB_DOMAINS.length === 6 && total === 30 && grid.every((g) => g.services.length === 5), `${total} services`);
  d.check('Every live page is a planned service in the right domain', CONCEPTS.every((c) => PLANNED_SERVICES.get(c.data.service)?.domain === c.data.domain), CONCEPTS.map((c) => `${c.data.domain}/${c.data.service}`).join(', '));
  d.check('Pages that aren’t written yet show as "coming soon"', LAMBDA.data.related.some((r) => !live.has(r)), `${LAMBDA.data.related.filter((r) => !live.has(r)).length} related pages pending`);
  if (unknownService) {
    const page = { ...LAMBDA, file: 'content/concepts/compute-and-containers/aws-lambda.mdx', data: { ...LAMBDA.data, service: 'aws-lambda' } };
    const problems = checkConcept(page).filter((p) => p.message.includes('domains.ts') || p.message.includes('file name'));
    problems.forEach((p) => d.cmd(`error   ${p.file}: ${p.message}`));
    d.check('A page for a service that isn’t in domains.ts fails the content check', problems.some((p) => p.message.includes("isn't in site/src/data/domains.ts")), problems[0]?.message);
  }
  return d.result({ grid, domain, live: [...live.keys()], total, decisionGuides: DECISION_GUIDES, decisionPages: DECISION_PAGES.length });
}

// ---- Case studies ---------------------------------------------------------------------------

export function caseStudies(inputs) {
  const d = new Demo('case-studies');
  const n = clampInt(inputs.study, 1, CASE_STUDIES.length, 1);
  const study = CASE_STUDIES.find((c) => c.n === n);
  d.cmd(`case study ${n}: ${study.title} (${CASE_STUDY_PAGES.length} of ${CASE_STUDIES.length} written in content/case-studies/)`);
  d.cmd(`data path: ${study.services.join(' → ')}`);
  const dvaDomains = new Set(CASE_STUDIES.flatMap((c) => c.exams).filter((e) => e.startsWith('DVA-C03')).map((e) => e.split(' ')[1]));
  d.check('Together the six case studies exercise every DVA-C03 domain', ['D1', 'D2', 'D3', 'D4'].every((x) => dvaDomains.has(x)), [...dvaDomains].sort().join(', '));
  d.check('They also reach AIP-C01 and DOP-C02', CASE_STUDIES.some((c) => c.exams.includes('AIP-C01')) && CASE_STUDIES.some((c) => c.exams.includes('DOP-C02')), 'cases 3, 5 (AIP-C01) and 4, 6 (DOP-C02)');
  d.check('Every case study follows the same seven-part structure', CASE_STUDY_STRUCTURE.length === 7, CASE_STUDY_STRUCTURE.map((s) => s.split(/[:,]/)[0]).join(' · '));
  return d.result({ study, studies: CASE_STUDIES, structure: CASE_STUDY_STRUCTURE, written: CASE_STUDY_PAGES.length });
}

// ---- Roadmap ----------------------------------------------------------------------------------

export function phaseAt(week) {
  return ROADMAP.find((p) => week >= p.weeks[0] && week <= p.weeks[1]);
}

export function progress() {
  const taskCount = DVA_OBJECTIVES.domains.reduce((n, x) => n + x.tasks.length, 0);
  return {
    pages: CONCEPTS.length,
    questions: QUESTIONS.length,
    caseStudies: CASE_STUDY_PAGES.length,
    tasksLoaded: taskCount,
    fresh: CONCEPTS.every((c) => ageInDays(new Date(c.data.last_verified)) <= MAX_AGE_DAYS),
  };
}

export function roadmap(inputs) {
  const d = new Demo('roadmap');
  const week = clampInt(inputs.week, 1, 26, 3);
  const phase = phaseAt(week);
  const p = progress();
  d.cmd(`week ${week} → Phase ${phase.phase} ${phase.name} (weeks ${phase.weeks.join('–')}); gate: ${phase.gate}`);
  d.cmd(`Phase 1 from the repo: ${p.pages}/${PHASE1_TARGETS.pages} pages, ${p.questions}/${PHASE1_TARGETS.questions} questions, ${p.caseStudies}/${PHASE1_TARGETS.caseStudies} case studies, ${p.tasksLoaded} task statements loaded`);
  const contiguous = ROADMAP.every((ph, i) => i === 0 || ph.weeks[0] === ROADMAP[i - 1].weeks[1] + 1);
  d.check('Four phases cover weeks 1–26 with no gaps', contiguous && ROADMAP[0].weeks[0] === 1 && ROADMAP[ROADMAP.length - 1].weeks[1] === 26, ROADMAP.map((ph) => `P${ph.phase} ${ph.weeks.join('–')}`).join(', '));
  const gateMet = p.tasksLoaded > 0 && p.pages >= PHASE1_TARGETS.pages && p.questions >= PHASE1_TARGETS.questions;
  d.check(
    p.tasksLoaded ? 'Phase 1 gate measured against the loaded task statements' : "With no task statements loaded, the Phase 1 gate can't be met yet",
    p.tasksLoaded > 0 || !gateMet,
    gateMet ? 'met' : 'not met: task statements, pages and questions still to come',
  );
  const criteria = SUCCESS_CRITERIA.map((c) => ({
    ...c,
    value:
      c.id === 'pages' ? `${p.pages}/${c.target}` : c.id === 'cases' ? `${p.caseStudies}/${c.target}` : c.id === 'fresh' ? (p.fresh ? 'all pages fresh' : 'some pages stale') : p.tasksLoaded ? `${p.tasksLoaded} tasks loaded` : 'waiting for the exam guide',
    pct: c.id === 'pages' ? p.pages / c.target : c.id === 'cases' ? p.caseStudies / c.target : c.id === 'fresh' ? (p.fresh ? 1 : 0) : 0,
  }));
  return d.result({ week, phase, roadmap: ROADMAP, progress: p, targets: PHASE1_TARGETS, criteria });
}
