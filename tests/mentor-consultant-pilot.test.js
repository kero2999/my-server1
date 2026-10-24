const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { isConsultantPilot, buildConsultantPrompt } = require('../src/mentor-consultant-pilot');
afterEach(() => { delete process.env.MENTOR_CONSULTANT_PILOT; });
test('existing behavior is preserved until the pilot is explicitly enabled', () => {
  delete process.env.MENTOR_CONSULTANT_PILOT;
  assert.equal(isConsultantPilot(1, 'marketing-launch'), false);
  process.env.MENTOR_CONSULTANT_PILOT = 'false';
  assert.equal(isConsultantPilot(1, 'marketing-launch'), false);
});
test('pilot cannot spill into another course or chapter', () => {
  process.env.MENTOR_CONSULTANT_PILOT = 'true';
  assert.equal(isConsultantPilot(1, 'marketing-launch'), true);
  for (const slug of ['marketing-growth', 'marketing-mastery', 'marketing-leadership', undefined]) assert.equal(isConsultantPilot(1, slug), false);
  for (const n of [0, 2, 12, 100, NaN]) assert.equal(isConsultantPilot(n, 'marketing-launch'), false);
});
test('all guidance outlines have 12 chapters and unique level identifiers', () => {
  const courses = Object.values(require('../data/mentor-curriculum-map.json'));
  assert.equal(courses.length, 4);
  assert.equal(new Set(courses.map(c => c.level)).size, 4);
  courses.forEach(c => { assert.equal(c.chapters.length, 12); c.chapters.forEach(t => assert.ok(t.trim())); });
});
test('source is a real chapter with explicit provenance rather than a claim of live protected access', () => {
  const source = require('../data/mentor-launch-ch1-pilot.json');
  assert.equal(source.courseSlug, 'marketing-launch');
  assert.equal(source.chapter, 1);
  assert.ok(source.content.length > 2000);
  assert.match(source.source, /not yet compared/);
  assert.ok(buildConsultantPrompt().includes(source.content.split('\n')[0]));
});
