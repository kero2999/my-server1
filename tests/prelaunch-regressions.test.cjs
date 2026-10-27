const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { repairAssessmentPresentation, contentErrorPage } = require('../src/course-release-repairs');
const { getChapterTemplate, publicChapterTemplate } = require('../src/chapter-templates');

function response() {
  return { code:200, headers:{}, status(n){this.code=n;return this}, json(body){this.body=body;return this},
    set(k,v){if(typeof k==='object')Object.assign(this.headers,k);else this.headers[k]=v;return this},
    type(type){this.headers.type=type;return this},send(body){this.body=body;return this},vary(){},append(){} };
}
function loadRoute(file, mocks) {
  const routes={};
  const router={get(url,...handlers){routes['GET '+url]=handlers.at(-1)},post(url,...handlers){routes['POST '+url]=handlers.at(-1)}};
  const actualRequire=require('node:module').createRequire(file);
  const sandbox={module:{exports:{}},Buffer,URL,Date,console:{log(){},warn(){},error(){}},
    require(name){if(name==='express')return {Router:()=>router};if(name in mocks)return mocks[name];return actualRequire(name)}};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
  return routes;
}
function paymentFixture({failEnrollment=0,failAffiliate=0,validHmac=true,amount=39900}={}) {
  let enrollmentCalls=0,affiliateCalls=0,active=false,enrollment=null;
  const payment={id:12,user_id:7,course_id:4,status:'pending',payment_type:'course',amount_cents:39900,currency:'EGP'};
  const db={from(table){let values=null,excludedStatus=null;const q={select(){return q},eq(){return q},neq(k,v){if(k==='status')excludedStatus=v;return q},
    maybeSingle:async()=>({data:table==='enrollments'?enrollment:{...payment},error:null}),update(v){values=v;return q},
    then(resolve){if(values&&payment.status!==excludedStatus)Object.assign(payment,values);return Promise.resolve({error:null}).then(resolve)},
    async upsert(values){enrollmentCalls++;if(enrollmentCalls<=failEnrollment)return {error:new Error('temporary enrollment failure')};active=true;enrollment={id:1,...values};return {error:null}}};return q}};
  const routes=loadRoute(path.resolve(__dirname,'../src/routes/webhooks.js'),{
    '../db':db,'../whop':null,'../paymob':{verifyHmac:()=>validHmac,callbackDetails:()=>({transactionId:'tx-12',providerOrderId:'order-12',amountCents:amount,currency:'EGP',success:true,raw:{}})},
    '../campaign-service':{},'../affiliate-service':{async recordAffiliateConversion(){affiliateCalls++;if(affiliateCalls<=failAffiliate)throw Error('temporary affiliate failure')}},
    '../audit-service':{recordAuditEvent:async()=>{}}
  });
  return {payment,revoke(){enrollment.status='revoked';active=false},get active(){return active},get enrollmentCalls(){return enrollmentCalls},get affiliateCalls(){return affiliateCalls},
    async deliver(){const res=response();await routes['POST /paymob']({body:'{}',headers:{},query:{hmac:'mocked-valid-signature'},method:'POST',path:'/paymob'},res);return res}};
}
test('paid callback retries enrollment after a temporary failure',async()=>{
  const f=paymentFixture({failEnrollment:1});assert.equal((await f.deliver()).code,500);assert.equal(f.payment.status,'paid');assert.equal(f.active,false);
  assert.equal((await f.deliver()).code,200);assert.equal(f.active,true);assert.equal(f.enrollmentCalls,2);
});
test('paid callback retries affiliate recording after temporary failure',async()=>{
  const f=paymentFixture({failAffiliate:1});assert.equal((await f.deliver()).code,500);const paidAt=f.payment.paid_at;
  assert.equal((await f.deliver()).code,200);assert.equal(f.active,true);assert.equal(f.affiliateCalls,2);assert.equal(f.payment.paid_at,paidAt);
});
test('normal duplicate callbacks retain successful access',async()=>{const f=paymentFixture();await f.deliver();await f.deliver();assert.equal(f.active,true);assert.equal(f.payment.status,'paid')});
test('old paid callback cannot reactivate a later revoked enrollment',async()=>{const f=paymentFixture();await f.deliver();f.revoke();await f.deliver();assert.equal(f.active,false);assert.equal(f.enrollmentCalls,1)});
test('invalid HMAC and mismatched amounts cannot activate access',async()=>{for(const options of [{validHmac:false},{amount:1}]){const f=paymentFixture(options);assert.equal((await f.deliver()).code,400);assert.equal(f.active,false);assert.equal(f.payment.status,'pending')}});

test('duplicate affiliate conversion preserves settled commission and captured rate',async()=>{
  const stored={status:'paid',commission_rate:25};let optionsSeen;
  const db={from(table){const q={select(){return q},eq(){return q},async maybeSingle(){return {data:table==='affiliate_attributions'?{affiliate_id:1}:table==='affiliates'?{id:1,status:'active',purchase_commission_rate:10}:stored,error:null}},upsert(payload,options){if(table==='affiliate_commissions'){optionsSeen=options;if(!options.ignoreDuplicates)Object.assign(stored,payload)}return q},then(resolve){return Promise.resolve({error:null}).then(resolve)}};return q}};
  const file=path.resolve(__dirname,'../src/affiliate-service.js'),sandbox={module:{exports:{}},require:()=>db};vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);
  await sandbox.module.exports.recordAffiliateConversion({id:12,user_id:7,course_id:4,amount_cents:39900,provider_transaction_id:'tx-12'},'affiliate_purchase');
  assert.equal(optionsSeen.ignoreDuplicates,true);assert.equal(stored.status,'paid');assert.equal(stored.commission_rate,25);
});

for(const [slug,english,arabic] of [['marketing-launch','LAUNCH','الأول'],['marketing-growth','GROWTH','الثاني'],['marketing-mastery','MASTERY','الثالث'],['marketing-leadership','LEADERSHIP','الرابع']]){
  for(let n=1;n<=12;n++)test(`${slug} chapter ${n}: correct level and task criteria`,()=>{
    const input='<div>MARKETING GROWTH / ASSESSMENT</div><span>تقييم الفصل / المستوى الثاني</span><div class="review-rubric"><h3>ما الذي يُراجع؟</h3><ul><li>wrong shared criterion</li></ul></div>';
    const output=repairAssessmentPresentation(input,`package/assessment${n}.html`,slug);
    assert.ok(output.includes(`MARKETING ${english} / ASSESSMENT`));assert.ok(output.includes('المستوى '+arabic));assert.ok(!output.includes('wrong shared criterion'));
    const criteria=getChapterTemplate(slug,n).reviewCriteria;
    assert.ok(criteria.length>=3);for(const criterion of criteria)assert.ok(output.includes(criterion));
    assert.deepEqual(publicChapterTemplate(slug,n).reviewCriteria,criteria);
    assert.equal(repairAssessmentPresentation(input,`package/ch${n}.html`,slug),input);
  });
}
test('error document escapes HTML and provides safe course navigation',()=>{
  const html=contentErrorPage('<script>alert(1)</script>','marketing-growth');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('/dashboard/marketing-growth'));
});
for(const admin of [false,true])test(`gateway gates lessons and assessments; server admin=${admin}`,async()=>{
  const course={id:4,slug:'marketing-growth',entry_file:'ch1.html',content_bucket:'private',content_prefix:'course'};
  const html='<html><head><meta name="ql-course-release" content="2026-10-17"></head><body><main><h1>Lesson</h1><p>Real content</p></main></body></html>';
  const db={storage:{from(){return {download:async()=>({data:new Blob([html]),error:null})}}}};
  const routes=loadRoute(path.resolve(__dirname,'../src/routes/content.js'),{
    '../db':db,'../middleware/auth':{authenticate:req=>req.testUserId||null},
    './courses':{findPublishedCourse:async()=>course,getAccess:async()=>({canAccess:true,admin}),resolveEntryFile:async()=>'ch1.html'},
    '../learning':{isChapterUnlocked:async()=>({unlocked:false})},'../country-service':{getUserCountry:async()=>({countryCode:'EG'}),getCourseVariants:async()=>({lessons:new Map()})},
    '../content-dialect':{injectContentDialect:x=>x,rewriteHtmlTextNodes:(_,x)=>x},'../course-presentation-performance':{optimizeAuthoredHtml:x=>x}
  });
  for(const file of ['ch3.html','assessment3.html']){
    const res=response();await routes['GET /:courseId/*']({testUserId:7,params:{courseId:'marketing-growth',0:file},headers:{},query:{},acceptsEncodings:()=>false},res);
    assert.equal(res.code,admin?200:403);if(!admin){assert.equal(res.headers.type,'html');assert.ok(String(res.body).includes('العودة إلى فهرس الكورس'));}else assert.ok(Buffer.isBuffer(res.body));
  }
  const anon=response();await routes['GET /:courseId/*']({params:{courseId:'marketing-growth',0:'ch3.html'},headers:{},query:{},get:()=>''},anon);assert.equal(anon.code,401);
});
