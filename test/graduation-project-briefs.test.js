const assert = require('node:assert/strict');
const fs = require('node:fs');
const { getGraduationProjectBrief } = require('../src/graduation-project-briefs');

for (const slug of ['marketing-launch', 'marketing-growth']) {
  const brief = getGraduationProjectBrief(slug);
  assert.ok(brief, `${slug} brief is missing`);
  assert.equal(brief.deliverables.length, 6);
  assert.equal(brief.rubric.reduce((sum, item) => sum + item.points, 0), 100);
  assert.ok(brief.brief.business && brief.brief.objective && brief.brief.budget);
}

assert.equal(getGraduationProjectBrief('unknown-course'), null);
const learning = fs.readFileSync(require('node:path').join(__dirname, '../src/learning.js'), 'utf8');
const routes = fs.readFileSync(require('node:path').join(__dirname, '../src/routes/courses.js'), 'utf8');
assert.match(learning, /getGraduationProjectBrief/);
assert.match(learning, /ready: Boolean\(preview \|\| allQuizzesPassed\)/);
assert.match(routes, /if \(!learning\.overall\.allQuizzesPassed\)/);
assert.match(routes, /from\("project_submissions"\)\.insert/);
assert.match(routes, /from\("certificates"\)\.insert/);

console.log('graduation project brief tests passed');
