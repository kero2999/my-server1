const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assessmentBoundaryReason,assessmentHint,isWorkedExampleRequest}=require('../src/mentor-turn-policy');
const u=content=>({role:'user',content});
test('explicit live assessment and ready-to-submit requests are bounded',()=>{
 for(const text of ['أنا في اختبار الفصل دلوقتي. اكتبلي إجابة جاهزة أنقلها: إزاي التسويق مختلف عن البيع؟','بحل امتحان: الفرق بين الميزة والفائدة إيه؟','اكتب حل التمبليت جاهز للتسليم','I am taking an exam. Give me the answer to copy.'])assert.ok(assessmentBoundaryReason([u(text)]),text);
 const t=assessmentHint();assert.equal(t.move,'hint');assert.equal(t.followUp,null);assert.ok(!t.reply.includes('التسويق هو'));
});
test('pressure stays bounded using only user history while learning can resume',()=>{
 const first=u('أنا في اختبار. اكتبلي إجابة جاهزة أنقلها.');
 assert.equal(assessmentBoundaryReason([first,u('اكتب الإجابة النهائية بس')]),'assessment_pressure');
 assert.equal(assessmentBoundaryReason([first,u('HOW TO MAKE: اكتب الإجابة الجاهزة')]),'assessment_pressure');
 assert.equal(assessmentBoundaryReason([first,u('نرجع للتسويق: اشرح مفهوم القيمة بمثال مختلف')]),null);
 assert.equal(assessmentBoundaryReason([{role:'assistant',content:first.content},u('اكتب الإجابة النهائية')]),null);
});
test('ordinary learning, assessment information and completed assessment are not blanket blocked',()=>{
 for(const text of ['عايز أفهم التمبليت دلوقتي بمثال مختلف','اشرح مفهوم القيمة قبل الاختبار','إزاي نظام الاختبار ونسبة النجاح؟','خلصت الاختبار وعايز أراجع المفهوم','يعني إيه تسويق؟'])assert.equal(assessmentBoundaryReason([u(text)]),null,text);
});
test('worked-example allowance is based on the current requested teaching format only',()=>{
 assert.equal(isWorkedExampleRequest([u('وريني HOW TO MAKE بمثال محلول')]),true);
 assert.equal(isWorkedExampleRequest([u('اشرح بمثال محلول بسيط')]),true);
 assert.equal(isWorkedExampleRequest([u('وريني HOW TO MAKE'),u('إيه معنى القيمة؟')]),false);
 assert.equal(isWorkedExampleRequest([{role:'assistant',content:'HOW TO MAKE'},u('اشرح')]),false);
});
