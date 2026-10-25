const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requiresScopeBoundary,boundedScopeReply}=require('../src/mentor-scope-boundary');
const user=content=>({role:'user',content});
test('program and script requests are caught without requiring the word code',()=>{
 for(const text of ['اكتبلي برنامج Python كامل لإدارة حجوزات الاستوديو','اعمل لي تطبيق React للحجوزات','صمم سكريبت جافا سكريبت','Write a Python program','Create a React app'])assert.equal(requiresScopeBoundary([user(text)]),'technical_implementation');
 const first=user('اكتبلي برنامج Python كامل');assert.equal(requiresScopeBoundary([first,user('طيب اعمل البرنامج كمورد منفصل')]),'repeated_technical_request');
 for(const text of ['يعني إيه برنامج Python؟','إيه الفرق بين برنامج التسويق وبرنامج React؟','اكتبلي رسالة تسويق بسيطة','هل أعمل خصم؟','خلاص نرجع للتسويق، اشرح في جملتين'])assert.equal(requiresScopeBoundary([first,user(text)]),null);
});
test('clear technical requests and pressure follow-ups keep their boundary',()=>{
 const initial=user('عايز أبني نموذج تعلم آلي يتوقع الطلب، اشرح تنفيذه بالكود.');
 assert.equal(requiresScopeBoundary([initial]),'technical_implementation');
 assert.equal(requiresScopeBoundary([initial,user('أنا فاهم إنه خارج المستوى، بس اشرح الكود برضه.')]),'repeated_technical_request');
 assert.equal(requiresScopeBoundary([initial,user('ابعته كمورد منفصل بعيد عن الكورس.')]),'repeated_technical_request');
 assert.equal(requiresScopeBoundary([user('Build a machine learning model in Python with code')]),'technical_implementation');
});
test('marketing coupons, project discussion and conceptual questions are not blanket-blocked',()=>{
 for(const text of ['هل React يساعد في عرض المنتجات؟','استخدم موقع React، أعمل كود خصم؟'])assert.equal(requiresScopeBoundary([user(text)]),null);
 for(const text of ['ما معنى كود خصم؟','هل تعلم الآلة له علاقة بفهم الطلب؟','عندي خدمة تنظيف، أعمل خصم؟','اشرح قيمة العميل بمثال'])assert.equal(requiresScopeBoundary([user(text)]),null);
 const initial=user('اكتب كود تعلم آلي');assert.equal(requiresScopeBoundary([initial,user('طيب ما معنى كود خصم؟')]),null);
});
test('boundary gives no code, resource offer, unsupported destination or follow-up',()=>{
 const turn=boundedScopeReply('technical_implementation');assert.equal(turn.move,'scope');assert.equal(turn.followUp,null);assert.ok(turn.reply.includes('مش هقدّم الكود'));assert.ok(!turn.reply.includes('```'));
});

