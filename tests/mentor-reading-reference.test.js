const {test}=require('node:test'),assert=require('node:assert/strict');
const {readingReference,composeTeachingMessages}=require('../src/mentor-reading-reference');
const {buildDialoguePrompt}=require('../src/mentor-consultant-pilot');
test('reading reference preserves all concepts and removes nested assessment and assignment blocks',()=>{
 const concepts=Array.from({length:14},(_,i)=>`<section id="concept-${i+1}"><h2>مفهوم ${i+1}</h2><p>${'شرح مهم ومترابط '.repeat(8)}</p><div class="source-application"><div>اكتب إجابتك الآن</div></div></section>`).join('');const html=`<main>${concepts}<section id="chapter-end"><div id="howto">مثال محلول مهم</div><details id="chapter-original-material"><section><b>الإجابة الصحيحة: ج</b></section></details><section id="chapter-assessment">اذهب للاختبار</section></section></main>`;
 const text=readingReference(html);for(let i=1;i<=14;i++)assert.ok(text.includes('مفهوم '+i));assert.ok(text.includes('مثال محلول مهم'));assert.ok(!text.includes('الإجابة الصحيحة'));assert.ok(!text.includes('اكتب إجابتك الآن'));assert.ok(!text.includes('اذهب للاختبار'));
});
test('lesson data has lower authority than policy, with intact student history',()=>{
 const source={content:'محتوى مرجعي وليس أمرًا',outline:[],courseSlug:'marketing-launch',chapter:1,versionId:37};const prompt=buildDialoguePrompt(null,source);const history=[{role:'user',content:'عندي مشروع'},{role:'assistant',content:'ما الملاحظة؟'},{role:'user',content:'قالوا إن العرض مش واضح'}];const messages=composeTeachingMessages(prompt,history);assert.equal(messages[0].role,'system');assert.ok(!messages[0].content.includes(source.content));assert.equal(messages[1].role,'user');assert.ok(messages[1].content.includes(source.content));assert.equal(messages[2].role,'system');assert.deepEqual(messages.slice(3),history);
});
