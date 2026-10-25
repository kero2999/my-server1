const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDialogueTurn}=require('../src/mentor-dialogue-contract');
function answer(move,followUp){return JSON.stringify({reply:'الميزة خاصية الخدمة، والفائدة ما تساعد العميل على تحقيقه.',move,followUp});}
test('worked examples allow bounded steps while ordinary dialogue retains its limits',()=>{
 const raw=JSON.stringify({reply:'1. مخبز افتراضي يسمع أن العميل يريد شراءً سريعًا.\n2. يعرض الخيارات المتاحة بوضوح لتسهيل الاختيار.\n3. يراجع هل المعلومة أوضح، دون ضمان مبيعات.',move:'explain',followUp:'اكتب مشروعك هنا؟'});
 assert.throws(()=>parseDialogueTurn(raw),/reply_contains_list/);
 const t=parseDialogueTurn(raw,{workedExample:true});assert.ok(t.reply.includes('1.'));assert.equal(t.followUp,null);assert.equal(t.followUpSuppressed,true);
 const long=JSON.stringify({reply:Array(200).fill('شرح').join(' '),followUp:null,move:'explain'});assert.throws(()=>parseDialogueTurn(long),/reply_too_long/);assert.ok(parseDialogueTurn(long,{workedExample:true}));
 const tooMany=JSON.stringify({reply:Array.from({length:7},(_,i)=>`${i+1}. خطوة`).join('\n'),followUp:null,move:'explain'});assert.throws(()=>parseDialogueTurn(tooMany,{workedExample:true}),/reply_too_many_steps/);
});
test('one inline question does not discard a response or duplicate its follow-up',()=>{
 const turn=parseDialogueTurn(JSON.stringify({reply:'مش هنفترض إن السعر السبب. إيه اللي قاله العملاء؟',followUp:'إيه اللي قاله العملاء؟',move:'discuss'}));assert.equal(turn.followUp,null);assert.equal(turn.followUpSuppressed,true);assert.equal((turn.reply.match(/؟/g)||[]).length,1);
});
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


