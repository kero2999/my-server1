const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDialogueTurn}=require('../src/mentor-dialogue-contract');
function answer(move,followUp){return JSON.stringify({reply:'الميزة خاصية الخدمة، والفائدة ما تساعد العميل على تحقيقه.',move,followUp});}
test('scope envelope must still be valid and extra fields are rejected',()=>{
 for(const turn of [{reply:'غير متاح؟',move:'scope',followUp:42},{reply:'غير متاح',move:'scope',followUp:null,extra:'x'}])assert.throws(()=>parseDialogueTurn(JSON.stringify(turn)),/invalid_dialogue_turn/);
 assert.throws(()=>parseDialogueTurn('not JSON'));
});
test('follow-up validation retains precise failure reasons',()=>{
 for(const [followUp,reason] of [[Array(36).fill('كلمة').join(' '),'followup_too_long'],['ما السبب؟ وما الدليل؟','followup_multiple_questions'],['ما السبب\nالذي ذكرته؟','followup_multiline']])assert.throws(()=>parseDialogueTurn(answer('clarify',followUp)),new RegExp(reason));
});
test('completed explanations and conclusions do not assign an extra question',()=>{
 for(const move of ['explain','conclude']){const turn=parseDialogueTurn(answer(move,'ما الميزة التي ستقدمها في مشروعك؟'));assert.equal(turn.followUp,null);assert.equal(turn.followUpSuppressed,true);assert.ok(!turn.reply.includes('ما الميزة'));}
});
test('purposeful clarification and discussion can still ask one question',()=>{
 for(const move of ['clarify','discuss','hint']){const turn=parseDialogueTurn(answer(move,'ما السبب الذي ذكره العملاء؟'));assert.equal(turn.followUp,'ما السبب الذي ذكره العملاء؟');assert.equal(turn.followUpSuppressed,false);}
});
test('an already-complete direct response is preserved verbatim',()=>{
 const turn=parseDialogueTurn(answer('explain',null));assert.equal(turn.reply,'الميزة خاصية الخدمة، والفائدة ما تساعد العميل على تحقيقه.');assert.equal(turn.followUpSuppressed,false);
});
