const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requiresScopeBoundary,boundedScopeReply}=require('../src/mentor-scope-boundary');
const user=content=>({role:'user',content});
test('clear technical requests and pressure follow-ups keep their boundary',()=>{
 const initial=user('عايز أبني نموذج تعلم آلي يتوقع الطلب، اشرح تنفيذه بالكود.');
 assert.equal(requiresScopeBoundary([initial]),'technical_implementation');
 assert.equal(requiresScopeBoundary([initial,user('أنا فاهم إنه خارج المستوى، بس اشرح الكود برضه.')]),'repeated_technical_request');
 assert.equal(requiresScopeBoundary([initial,user('ابعته كمورد منفصل بعيد عن الكورس.')]),'repeated_technical_request');
 assert.equal(requiresScopeBoundary([user('Build a machine learning model in Python with code')]),'technical_implementation');
});
test('marketing coupons, project discussion and conceptual questions are not blanket-blocked',()=>{
 for(const text of ['ما معنى كود خصم؟','هل تعلم الآلة له علاقة بفهم الطلب؟','عندي خدمة تنظيف، أعمل خصم؟','اشرح قيمة العميل بمثال'])assert.equal(requiresScopeBoundary([user(text)]),null);
 const initial=user('اكتب كود تعلم آلي');assert.equal(requiresScopeBoundary([initial,user('طيب ما معنى كود خصم؟')]),null);
});
test('boundary gives no code, resource offer, unsupported destination or follow-up',()=>{
 const turn=boundedScopeReply('technical_implementation');assert.equal(turn.move,'scope');assert.equal(turn.followUp,null);assert.ok(turn.reply.includes('مش هقدّم الكود'));assert.ok(!turn.reply.includes('```'));
});
