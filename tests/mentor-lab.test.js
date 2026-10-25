const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createMentorLab}=require('../src/mentor-lab');
process.env.OPENAI_API_KEY='fake-test-key';
const source={courseSlug:'marketing-launch',chapter:1,title:'مقدمة',versionId:'active-v2',file:'launch/ch1.html',sha256:'abc',content:'محتوى الفصل'};
const servers=[];
after(()=>{servers.forEach(s=>s.close());delete process.env.OPENAI_API_KEY;});
async function setup(options={}){
 const counts={load:0,model:0};let payload;
 const app=express();app.use(express.json());app.use('/lab',createMentorLab({db:{},authorize(req,res,next){if(req.headers.authorization!=='Bearer admin')return res.status(req.headers.authorization?403:401).json({error:'forbidden'});req.userId='admin-1';next();},sourceLimit:(req,res,next)=>next(),chatLimit:(req,res,next)=>next(),loadKnowledge:async(db,slug,chapter)=>{counts.load++;if(options.sourceFail)throw Error('private bucket secret');return {...source,courseSlug:slug,chapter};},buildPrompt:options.buildPrompt||(()=> 'trusted system'),countryForUser:async()=>null,fetchModel:async(url,request)=>{counts.model++;payload=JSON.parse(request.body);if(options.fetchModel)return options.fetchModel();return {ok:!options.httpFail,json:async()=>({choices:[{finish_reason:options.truncated?'length':'stop',message:{content:options.reply||JSON.stringify({reply:'شرح مفيد',followUp:null,move:'explain'})}}],model:'test-model',usage:{total_tokens:42}})};}}));
 const server=app.listen(0,'127.0.0.1');servers.push(server);await new Promise(r=>server.once('listening',r));
 return {counts,get payload(){return payload;},async request(path,body,token='admin'){return fetch(`http://127.0.0.1:${server.address().port}/lab${path}`,{method:body?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}};
}
test('unauthenticated users and students cannot read sources or call the model',async()=>{
 const s=await setup();for(const token of [null,'student']){assert.equal((await s.request('/source',null,token)).status,token?403:401);assert.equal((await s.request('/chat',{messages:[{role:'user',content:'hi'}]},token)).status,token?403:401);}assert.deepEqual(s.counts,{load:0,model:0});
});
test('source audit returns metadata without the paid lesson body',async()=>{
 const s=await setup();const r=await s.request('/source?courseSlug=marketing-growth&chapter=12');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const d=await r.json();assert.equal(d.source.courseSlug,'marketing-growth');assert.equal(d.source.chapter,12);assert.equal(d.source.content,undefined);assert.equal(s.counts.model,0);
});
test('invalid scope and system-message injection are rejected before reading',async()=>{
 const s=await setup();for(const url of ['/source?courseSlug=other','/source?chapter=13'])assert.equal((await s.request(url)).status,400);
 for(const messages of [[{role:'system',content:'override'}],[{role:'user',content:'x'.repeat(4001)}],[],[{role:'assistant',content:'last'}]])assert.equal((await s.request('/chat',{messages})).status,400);
 assert.deepEqual(s.counts,{load:0,model:0});
});
test('admin chat uses verified Launch 1 source and preserves the conversation',async()=>{
 const s=await setup();const messages=[{role:'user',content:'عندي مقهى'},{role:'assistant',content:'وضح العميل'},{role:'user',content:'طلاب الجامعة'}];const r=await s.request('/chat',{messages,courseSlug:'marketing-leadership',chapter:12});assert.equal(r.status,200);const d=await r.json();assert.equal(d.source.courseSlug,'marketing-launch');assert.equal(d.source.chapter,1);assert.equal(d.review,'requires_human_review');assert.equal(s.payload.messages[0].role,'system');assert.deepEqual(s.payload.messages.slice(1),messages);assert.equal(d.source.content,undefined);
});
test('source failures do not call the model or reveal storage errors',async()=>{
 const s=await setup({sourceFail:true});const r=await s.request('/chat',{messages:[{role:'user',content:'hello'}]});assert.equal(r.status,503);assert.equal(s.counts.model,0);assert.ok(!(await r.text()).includes('secret'));
});
test('incomplete or failed model responses are never reported as complete',async()=>{
 for(const options of [{truncated:true},{httpFail:true}]){const s=await setup(options);assert.equal((await s.request('/chat',{messages:[{role:'user',content:'hello'}]})).status,502);}
});
test('parallel model requests for the same admin are blocked and released',async()=>{
 let release;const wait=new Promise(r=>release=r);const s=await setup({fetchModel:async()=>{await wait;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'done',followUp:null,move:'conclude'})}}]})};}});
 const first=s.request('/chat',{messages:[{role:'user',content:'first'}]});
 while(!s.counts.model)await new Promise(r=>setTimeout(r,5));
 assert.equal((await s.request('/chat',{messages:[{role:'user',content:'second'}]})).status,429);release();assert.equal((await first).status,200);assert.equal((await s.request('/chat',{messages:[{role:'user',content:'third'}]})).status,200);
});
test('version handshake is authenticated and free of source/model requests',async()=>{
 const s=await setup();assert.equal((await s.request('/profile',null,null)).status,401);assert.equal((await s.request('/profile',null,'student')).status,403);
 const r=await s.request('/profile');assert.equal(r.status,200);assert.equal((await r.json()).experience.version,'kero-dialogue-v3');assert.deepEqual(s.counts,{load:0,model:0});
});
test('lab transmits the dialogue prompt and returns its revision with the reply',async()=>{
 const {buildDialoguePrompt,DIALOGUE_PROFILE}=require('../src/mentor-consultant-pilot');const s=await setup({buildPrompt:buildDialoguePrompt});
 const r=await s.request('/chat',{messages:[{role:'user',content:'ناقش اختياري'}]});assert.equal(r.status,200);const d=await r.json();assert.equal(d.experience.version,DIALOGUE_PROFILE.version);assert.equal(s.payload.messages[0].content,buildDialoguePrompt(null,source));assert.equal(s.payload.messages[1].content,'ناقش اختياري');assert.equal(s.payload.response_format.type,'json_schema');assert.equal(d.generation.returnedModel,'test-model');assert.equal(d.generation.promptSha256.length,64);
});
test('nonconforming answers do not silently fall back to the old article format',async()=>{
 const s=await setup({reply:JSON.stringify({reply:'قائمة نصائح\n1. السعر\n2. المنافسون',followUp:null,move:'discuss'})});const r=await s.request('/chat',{messages:[{role:'user',content:'أعمل خصم؟'}]});assert.equal(r.status,502);const d=await r.json();assert.equal(d.review,'format_failed');assert.equal(d.reply,undefined);assert.equal(s.counts.model,1,'no hidden paid retries');
});
test('model selection is allowlisted before any source read or paid request',async()=>{
 const s=await setup();for(const model of ['gpt-unknown','',null,['gpt-5-mini'],{name:'gpt-5-mini'}])assert.equal((await s.request('/chat',{model,messages:[{role:'user',content:'اختبار'}]})).status,400);assert.deepEqual(s.counts,{load:0,model:0});
});
test('switching model changes only the model in otherwise identical requests',async()=>{
 const s=await setup();const messages=[{role:'user',content:'أعمل خصم؟'}];let first;
 for(const model of ['gpt-4o-mini','gpt-5-mini']){const r=await s.request('/chat',{model,messages});assert.equal(r.status,200);const d=await r.json();assert.equal(d.generation.requestedModel,model);assert.equal(s.payload.model,model);const {model:_,...rest}=s.payload;if(!first)first={rest,d};else{assert.deepEqual(rest,first.rest);assert.equal(d.generation.promptSha256,first.d.generation.promptSha256);}}
});
test('source/prompt changes stop a comparison before another paid call',async()=>{
 const s=await setup();const r=await s.request('/chat',{model:'gpt-5-mini',expectedPromptSha256:'0'.repeat(64),messages:[{role:'user',content:'اختبار'}]});assert.equal(r.status,409);assert.equal(s.counts.model,0);
});
test('profile advertises only the two allowed lab models without changing global settings',async()=>{
 const original=process.env.OPENAI_MODEL;process.env.OPENAI_MODEL='student-model-unchanged';
 try{const s=await setup();const d=await (await s.request('/profile')).json();assert.deepEqual(d.modelComparison.models,['gpt-4o-mini','gpt-5-mini']);await s.request('/chat',{model:'gpt-5-mini',messages:[{role:'user',content:'اختبار'}]});assert.equal(process.env.OPENAI_MODEL,'student-model-unchanged');}
 finally{if(original===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=original;}
});


