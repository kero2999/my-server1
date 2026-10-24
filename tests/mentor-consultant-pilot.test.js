const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { isConsultantPilot, buildConsultantPrompt } = require('../src/mentor-consultant-pilot');
afterEach(() => { delete process.env.MENTOR_CONSULTANT_PILOT; });
test('existing behavior is preserved until explicitly enabled', () => {
  delete process.env.MENTOR_CONSULTANT_PILOT; assert.equal(isConsultantPilot(1,'marketing-launch'),false);
  process.env.MENTOR_CONSULTANT_PILOT='false'; assert.equal(isConsultantPilot(1,'marketing-launch'),false);
});
test('activation is isolated to Launch chapter one', () => {
  process.env.MENTOR_CONSULTANT_PILOT='true'; assert.equal(isConsultantPilot(1,'marketing-launch'),true);
  for(const slug of ['marketing-growth','marketing-mastery','marketing-leadership',undefined]) assert.equal(isConsultantPilot(1,slug),false);
  for(const chapter of [0,2,12,100,NaN]) assert.equal(isConsultantPilot(chapter,'marketing-launch'),false);
});
test('unverified or other-course text cannot build a pilot prompt',()=>{
  assert.throws(()=>buildConsultantPrompt());
  for(const courseSlug of ['marketing-growth',undefined]) assert.throws(()=>buildConsultantPrompt(null,{courseSlug,chapter:1,versionId:'v1',content:'text'}));
  const prompt=buildConsultantPrompt(null,{courseSlug:'marketing-launch',chapter:1,versionId:'live-v2',title:'مقدمة',content:'نص النسخة الحالية',outline:[]});
  assert.ok(prompt.includes('نص النسخة الحالية'));assert.ok(prompt.includes('live-v2'));
});
