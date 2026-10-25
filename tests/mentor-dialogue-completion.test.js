const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDialogueTurn}=require('../src/mentor-dialogue-contract');
function answer(move,followUp){return JSON.stringify({reply:'الميزة خاصية الخدمة، والفائدة ما تساعد العميل على تحقيقه.',move,followUp});}
test('completed explanations and conclusions do not assign an extra question',()=>{
 for(const move of ['explain','conclude']){const turn=parseDialogueTurn(answer(move,'ما الميزة التي ستقدمها في مشروعك؟'));assert.equal(turn.followUp,null);assert.equal(turn.followUpSuppressed,true);assert.ok(!turn.reply.includes('ما الميزة'));}
});
test('purposeful clarification and discussion can still ask one question',()=>{
 for(const move of ['clarify','discuss','hint']){const turn=parseDialogueTurn(answer(move,'ما السبب الذي ذكره العملاء؟'));assert.equal(turn.followUp,'ما السبب الذي ذكره العملاء؟');assert.equal(turn.followUpSuppressed,false);}
});
test('an already-complete direct response is preserved verbatim',()=>{
 const turn=parseDialogueTurn(answer('explain',null));assert.equal(turn.reply,'الميزة خاصية الخدمة، والفائدة ما تساعد العميل على تحقيقه.');assert.equal(turn.followUpSuppressed,false);
});
