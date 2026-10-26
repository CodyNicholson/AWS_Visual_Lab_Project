// Exam-prep demos: the DVA-C03 blueprint, key dates, format and pacing, the certification map, the
// practice question bank and objective-map coverage. Facts come from content/exams/ (verified against
// AWS on the date recorded in exam.yaml) and the scoring code from site/src.
import { Demo, clampInt, oneOf, round, seeded } from './lab.js';
import { DVA, DVA_OBJECTIVES, LAMBDA, QUESTIONS, computeCoverage, correctIds, isCorrect, MIN_QUESTIONS_PER_TASK } from '../kb/repo.js';
import { AIP_C01_DOMAINS, CERTIFICATIONS, DVA_C02_DOMAINS, DVA_C03_CHANGES, TOPIC_SCOPE } from '../kb/plan.js';

// ---- Blueprint ------------------------------------------------------------------------

export function blueprint(inputs, { useOldWeights = false } = {}) {
  const d = new Demo('exam-blueprint');
  const hours = clampInt(inputs.studyHours, 5, 300, 40);
  const scored = DVA.format.questions_scored;
  d.cmd(`read content/exams/dva-c03/objectives.yaml → ${DVA_OBJECTIVES.domains.length} domains (status: ${DVA_OBJECTIVES.status})`);
  d.cmd(`read content/exams/dva-c03/exam.yaml → ${scored} scored questions of ${DVA.format.questions_total}`);

  const rows = DVA_OBJECTIVES.domains.map((dom) => {
    const old = DVA_C02_DOMAINS.find((o) => o.number === dom.number);
    return {
      number: dom.number,
      name: dom.name,
      weight: dom.weight,
      oldName: old.name,
      oldWeight: old.weight,
      delta: dom.weight - old.weight,
      scoredQuestions: round((scored * dom.weight) / 100, 1),
      hours: round((hours * dom.weight) / 100, 1),
      oldHours: round((hours * old.weight) / 100, 1),
      ...DVA_C03_CHANGES[dom.number],
    };
  });
  rows.forEach((r) => d.cmd(`D${r.number} ${r.name}: ${r.oldWeight}% → ${r.weight}% (≈ ${r.scoredQuestions} of ${scored} scored questions)`));

  const total = rows.reduce((n, r) => n + r.weight, 0);
  d.check('DVA-C03 domain weights add up to 100%', total === 100, `${total}%`);
  d.check('The exam has four domains', rows.length === 4, rows.map((r) => `D${r.number}`).join(', '));
  const changed = rows.filter((r) => r.delta !== 0);
  d.check(
    'Weights changed from DVA-C02 (the plan said they were unchanged; the guides say otherwise)',
    changed.length > 0,
    changed.map((r) => `D${r.number} ${r.delta > 0 ? '+' : ''}${r.delta}`).join(', '),
  );
  const d3 = rows.find((r) => r.number === 3);
  d.check('Domain 3 was renamed from "Deployment"', d3.name !== d3.oldName, `"${d3.oldName}" → "${d3.name}"`);

  if (useOldWeights) {
    d.cmd(`plan ${hours} study hours with the DVA-C02 weights (the mistake)`);
    const d4 = rows.find((r) => r.number === 4);
    const short = round(d4.hours - d4.oldHours, 1);
    d.check(
      'Studying by the old weights under-prepares Troubleshooting and Optimization',
      short > 0,
      `D4 gets ${d4.oldHours} h instead of ${d4.hours} h (${short} h short, ≈ ${round((scored * d4.delta) / 100, 1)} scored questions)`,
    );
  }
  return d.result({ rows, hours, scored, useOldWeights, status: DVA_OBJECTIVES.status, statusNote: DVA_OBJECTIVES.status_note });
}

// ---- Dates ----------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const parseDay = (s) => new Date(`${s}T00:00:00Z`);
const dayString = (date) => date.toISOString().slice(0, 10);
/** yaml may give a Date or a string for an unquoted date; normalise to YYYY-MM-DD. */
const asDay = (v) => (v instanceof Date ? dayString(v) : String(v));

export function milestones() {
  return DVA.dates.map((m) => ({ label: m.label, date: asDay(m.date) })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Which Developer – Associate version can be taken on a given day. */
export function versionOn(day) {
  const [, lastC02, firstC03] = milestones().map((m) => m.date);
  return { c02: day <= lastC02, c03: day >= firstC03 };
}

export function dates(inputs, { bookOld = false } = {}) {
  const d = new Demo('exam-dates');
  const input = /^\d{4}-\d{2}-\d{2}$/.test(String(inputs.examDate)) ? String(inputs.examDate) : '2026-12-05';
  const clamped = input < '2026-01-01' ? '2026-01-01' : input > '2028-12-31' ? '2028-12-31' : input;
  const ms = milestones();
  const today = dayString(new Date());
  d.cmd(`read content/exams/dva-c03/exam.yaml → ${ms.length} dates`);
  ms.forEach((m) => d.cmd(`${m.date}  ${m.label}`));

  const [registration, lastC02, firstC03] = ms.map((m) => m.date);
  d.check('Registration and the full guide come before DVA-C03 delivery', registration < firstC03, `${registration} < ${firstC03}`);
  const gap = (parseDay(firstC03) - parseDay(lastC02)) / DAY;
  d.check('No gap and no overlap: DVA-C03 starts the day after DVA-C02 ends', gap === 1, `${lastC02} → ${firstC03}`);

  const v = versionOn(clamped);
  const version = v.c03 ? 'DVA-C03' : 'DVA-C02';
  d.cmd(`exam day ${clamped} → ${version}${v.c02 && !v.c03 && clamped >= registration ? ' (DVA-C03 can be booked, delivery starts Dec 1)' : ''}`);
  d.check(`On ${clamped} the version on offer is ${version}`, v.c02 !== v.c03, v.c03 ? 'DVA-C03 content: containers, Bedrock, AI security' : 'DVA-C02 content (archive after Nov 30)');

  if (bookOld) {
    const after = clamped > lastC02 ? clamped : '2026-12-05';
    const attempt = d.attempt(`book DVA-C02 for ${after}`, () => {
      if (!versionOn(after).c02) throw new Error(`DVA-C02 is not delivered after ${lastC02}; book DVA-C03 instead`);
      return after;
    });
    d.check('Booking the old version after its last day fails', !attempt.ok, attempt.error?.message);
  }

  const countdown = ms.map((m) => ({ ...m, days: Math.round((parseDay(m.date) - parseDay(today)) / DAY) }));
  return d.result({ milestones: countdown, examDate: clamped, version, today });
}

// ---- Format and pacing -----------------------------------------------------------------

/**
 * 65 questions, 15 of them unscored and not identified. A candidate who skips the ones they think
 * are unscored loses scored questions, because unanswered questions count as incorrect.
 */
export function format(inputs) {
  const d = new Demo('exam-format');
  const f = DVA.format;
  const skipped = clampInt(inputs.skip, 0, 30, 0);
  const reviewMin = clampInt(inputs.reviewMinutes, 0, 60, 10);
  const unscored = f.questions_total - f.questions_scored;
  d.cmd(`read exam.yaml format → ${f.duration_minutes} min, ${f.questions_total} questions (${f.questions_scored} scored), pass ${f.passing_score} on ${f.score_scale.join('–')}`);

  const perQuestion = round(f.duration_minutes / f.questions_total, 2);
  const workingMinutes = f.duration_minutes - reviewMin;
  const pace = round(workingMinutes / f.questions_total, 2);
  const checkpoints = [0.25, 0.5, 0.75, 1].map((p) => ({ question: Math.round(f.questions_total * p), minute: Math.round(workingMinutes * p) }));
  d.cmd(`pace: ${perQuestion} min per question; keep ${reviewMin} min to review → ${pace} min each`);

  // Seeded: which 15 positions are unscored, and which questions the candidate skips.
  const rand = seeded(2026);
  const positions = Array.from({ length: f.questions_total }, (_, i) => i + 1);
  const shuffled = [...positions].sort(() => rand() - 0.5);
  const unscoredSet = new Set(shuffled.slice(0, unscored));
  const skipSet = new Set([...positions].sort(() => rand() - 0.5).slice(0, skipped));
  const lostScored = [...skipSet].filter((p) => !unscoredSet.has(p)).length;
  const grid = positions.map((p) => ({ n: p, unscored: unscoredSet.has(p), skipped: skipSet.has(p) }));
  if (skipped) d.cmd(`skip ${skipped} questions that "look unscored" → ${lostScored} of them were scored`);

  d.check('Two minutes per question on average', perQuestion === 2, `${f.duration_minutes} / ${f.questions_total}`);
  d.check(`${unscored} questions are unscored, and you can't tell which`, unscored === 15, `${f.questions_scored} scored + ${unscored} unscored`);
  if (skipped) {
    d.check('Skipping "unscored" questions throws away scored ones', lostScored > 0, `${lostScored} scored questions left blank, each counted wrong`);
    d.cmd(`guessing instead of skipping: a 4-option guess is right 1 time in 4 → ≈ ${round(lostScored / 4, 1)} of those back`);
  } else {
    d.check('Answering every question loses nothing', lostScored === 0, '0 blanks');
  }
  return d.result({ format: f, perQuestion, pace, reviewMin, checkpoints, grid, skipped, lostScored, unscored });
}

// ---- Certification map -----------------------------------------------------------------

export function certifications(inputs) {
  const d = new Demo('certifications');
  const topic = oneOf(inputs.topic, TOPIC_SCOPE.map((t) => t.topic));
  const entry = TOPIC_SCOPE.find((t) => t.topic === topic);
  d.cmd(`plan: ${CERTIFICATIONS.length} certifications tracked, ${CERTIFICATIONS.filter((c) => c.depth === 'Full').length} with full prep`);
  d.cmd(`topic "${topic}" → ${entry.exam}${entry.dva ? ' (in DVA-C03)' : ' (out of scope for DVA-C03)'}`);

  d.check('One core track: DVA-C03', CERTIFICATIONS.filter((c) => c.core).map((c) => c.code).join() === 'DVA-C03', 'Full: hub, objective map, 250+ questions, labs');
  d.check('DVA-C02 becomes an archive', CERTIFICATIONS.find((c) => c.code === 'DVA-C02').depth === 'Archive', 'last day Nov 30, 2026');
  const aip = AIP_C01_DOMAINS.reduce((n, x) => n + x.weight, 0);
  d.check('AIP-C01 domain weights add up to 100%', aip === 100, AIP_C01_DOMAINS.map((x) => `${x.weight}%`).join(' + '));
  d.check(`"${topic}" belongs to ${entry.exam}`, Boolean(entry.exam), entry.dva ? 'study it for DVA-C03' : 'skip it for DVA-C03; it is AIP-C01 / DOP-C02 material');
  return d.result({ certifications: CERTIFICATIONS, aip: AIP_C01_DOMAINS, topic: entry, topics: TOPIC_SCOPE });
}

// ---- Practice questions ----------------------------------------------------------------

const LETTERS = 'abcdefgh';

/** Shuffles questions and options with a seed, then re-letters options so "A" is first on screen (as PracticeExam.tsx does). */
export function buildDeck({ domain = 'all', count = 5, seed = 7 } = {}) {
  const rand = seeded(seed);
  const shuffle = (items) => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pool = QUESTIONS.filter((q) => domain === 'all' || q.exam_domains.includes(domain));
  return shuffle(pool)
    .slice(0, count)
    .map((q) => ({ ...q, options: shuffle(q.options).map((o, i) => ({ ...o, originalId: o.id, id: LETTERS[i] })) }));
}

export function practice(inputs, { partialAnswer = false } = {}) {
  const d = new Demo('practice-questions');
  const domains = ['all', ...DVA_OBJECTIVES.domains.map((x) => x.id)];
  const domain = oneOf(inputs.domain, domains);
  const count = clampInt(inputs.count, 1, QUESTIONS.length, 5);
  d.cmd(`read content/exams/*/questions/*.yaml → ${QUESTIONS.length} original questions`);
  const deck = buildDeck({ domain, count, seed: 7 });
  d.cmd(`deck: ${deck.length} questions (${domain}), options shuffled and re-lettered`);

  const everyWhy = QUESTIONS.every((q) => q.options.every((o) => o.why && o.why.length > 10));
  d.check('Every option explains why it is right or wrong', everyWhy, `${QUESTIONS.reduce((n, q) => n + q.options.length, 0)} options`);
  const formatOk = QUESTIONS.every((q) => {
    const c = correctIds(q).length;
    return q.type === 'single' ? c === 1 && q.options.length === 4 : c >= 2 && q.options.length >= 5;
  });
  d.check('Exam format: single = 1 of 4, multiple = 2+ of 5+', formatOk, `${QUESTIONS.filter((q) => q.type === 'multiple').length} multiple-response questions`);
  const kept = deck.every((q) => {
    const orig = QUESTIONS.find((x) => x.id === q.id);
    return q.options.filter((o) => o.correct).map((o) => o.text).sort().join('|') === orig.options.filter((o) => o.correct).map((o) => o.text).sort().join('|');
  });
  d.check('Shuffling keeps the correct answers attached to their text', kept, 'graded by site/src/islands/types.ts isCorrect()');

  if (partialAnswer) {
    const multi = QUESTIONS.find((q) => q.type === 'multiple');
    const [first] = correctIds(multi);
    d.cmd(`answer ${multi.id} ("Which TWO…") with only one correct option: [${first}]`);
    const right = isCorrect(multi, [first]);
    d.check('Half of a multiple-response answer scores nothing', !right, `isCorrect(${multi.id}, ['${first}']) = ${right}`);
    const full = isCorrect(multi, correctIds(multi));
    d.check('All the correct options, and only those, score the point', full, `isCorrect(${multi.id}, [${correctIds(multi).join(', ')}]) = ${full}`);
  }
  return d.result({ deck, domain, total: QUESTIONS.length });
}

// ---- Objective-map coverage --------------------------------------------------------------

/**
 * Runs the site's own computeCoverage() on the real objectives, pages and questions. The DVA-C03 task
 * statements aren't loaded yet, so the visitor can add hypothetical ones to watch the rule work.
 */
export function coverage(inputs, { domainOnly = false } = {}) {
  const d = new Demo('objective-coverage');
  const tasksToAdd = clampInt(inputs.hypotheticalTasks, 0, 8, 0);
  const perTask = clampInt(inputs.questionsPerTask, 0, QUESTIONS.length, 5);
  const pages = [{ id: LAMBDA.data.service, exam_domains: LAMBDA.data.exam_domains, tasks: LAMBDA.data.tasks || [] }];
  const questions = QUESTIONS.map((q) => ({ id: q.id, exam_domains: q.exam_domains, tasks: q.tasks || [] }));

  const real = computeCoverage(DVA_OBJECTIVES, pages, questions);
  d.cmd(`computeCoverage(objectives.yaml, ${pages.length} page, ${questions.length} questions) → ${real.taskCount} task statements, percent = ${real.percent}`);
  d.check('Real coverage is "not yet measurable" until task statements are loaded', real.taskCount > 0 || real.percent === null, `status: ${DVA_OBJECTIVES.status}`);

  let sim = null;
  if (tasksToAdd > 0) {
    const ids = Array.from({ length: tasksToAdd }, (_, i) => `DVA-C03-1.${i + 1}`);
    const objectives = {
      ...DVA_OBJECTIVES,
      domains: DVA_OBJECTIVES.domains.map((dom) => (dom.number === 1 ? { ...dom, tasks: ids.map((id) => ({ id, title: `Hypothetical task ${id}` })) } : dom)),
    };
    const tag = (list, n) => list.map((x, i) => (domainOnly ? x : { ...x, tasks: i < n ? ids : [] }));
    sim = computeCoverage(objectives, domainOnly ? pages : tag(pages, 1), tag(questions, perTask));
    d.cmd(`add ${tasksToAdd} hypothetical D1 tasks; tag ${domainOnly ? 'by domain only' : `lambda + ${perTask} questions with each task`}`);
    d.cmd(`computeCoverage(...) → ${sim.coveredTasks}/${sim.taskCount} covered (${sim.percent}%)`);
    if (domainOnly) {
      d.check('Tagging by domain only covers no task statements', sim.percent === 0, `D1 still lists ${sim.domains[0].questions.length} questions, but 0 tasks are covered`);
    } else {
      const want = perTask >= MIN_QUESTIONS_PER_TASK;
      d.check(
        `A task is covered with ≥1 page and ≥${MIN_QUESTIONS_PER_TASK} questions`,
        want ? sim.percent === 100 : sim.percent === 0,
        `${perTask} questions per task → ${sim.percent}%`,
      );
    }
  }
  return d.result({ real, sim, perTask, tasksToAdd, domainOnly, minQuestions: MIN_QUESTIONS_PER_TASK });
}
