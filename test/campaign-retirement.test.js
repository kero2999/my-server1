const test=require('node:test'),assert=require('node:assert/strict');
const {applyRetirement,isRetiredCampaign,publicCampaignSettings,campaignTrialStatus,launchOfferStats}=require('../src/campaign-service');
test('retired launch campaign is disabled even when persisted enabled',()=>{
 const original={campaign_key:'marketing-launch-10-day',enabled:true,review_enabled:true,free_trial_minutes:60};
 const result=applyRetirement(original);assert.equal(result.enabled,false);assert.equal(result.review_enabled,false);assert.equal(result.free_trial_minutes,10);assert.equal(original.enabled,true);
 assert.equal(publicCampaignSettings(original).enabled,false);assert.equal(publicCampaignSettings(original).retired,true);
});
test('hour funnel is retired for any course; unrelated campaigns preserved',()=>{
 assert.equal(isRetiredCampaign({campaign_key:'growth',launch_funnel_version:'free_hour_review_v1'}),true);
 const unrelated={campaign_key:'unrelated',enabled:true};assert.equal(applyRetirement(unrelated),unrelated);assert.equal(isRetiredCampaign(null),false);assert.equal(isRetiredCampaign({campaign_key:'marketing-growth-10-day'}),true);
});
test('already granted access remains valid until its original expiry',()=>{
 assert.equal(campaignTrialStatus({status:'active',expires_at:'2030-01-01T00:00:00Z'},Date.parse('2029-12-31T00:00:00Z')).remainingSeconds,86400);
});
test('retired offer has no slots and does not query redemptions',async()=>{
 assert.deepEqual(await launchOfferStats({campaign_key:'marketing-launch-10-day',launch_funnel_version:'free_hour_review_v1'}),{totalSlots:0,usedSlots:0,remainingSlots:0});
});
test('retired checkout returns 410 before payments or provider calls',async()=>{
 const db=require('../src/db'),original=db.from;let tables=[];
 db.from=(table)=>{tables.push(table);const q={select(){return q},eq(){return q},order(){return q},limit(){return q},async maybeSingle(){return {data:table==='courses'?{id:1,status:'published'}:{campaign_key:'marketing-launch-10-day',enabled:true}}}};return q};
 try{const router=require('../src/routes/payments');const route=router.stack.find(layer=>layer.route?.path==='/course/:courseId/campaign/create').route;let status=200,body;const res={status(v){status=v;return this},json(v){body=v;return this}};await route.stack.at(-1).handle({params:{courseId:'1'},userId:9},res);assert.equal(status,410);assert.equal(body.ok,false);assert.deepEqual(tables,['courses','campaign_settings']);}finally{db.from=original}
});
test('public overview contains curriculum skills without private evaluation fields',()=>{
 const {courseOverview}=require('../src/course-overview');
 for(const slug of ['marketing-launch','marketing-growth','marketing-mastery','marketing-leadership']){const info=courseOverview(slug);assert.equal(info.chapters.length,12);assert.deepEqual(Object.keys(info.chapters[0]).sort(),['application','concept','number','skill','title']);assert(info.chapters.every(ch=>ch.title&&ch.skill));}
 assert.equal(courseOverview('unknown-course'),null);
});
test('new authenticated trials last ten minutes even if legacy course setting says sixty',async()=>{
 const db=require('../src/db'),original=db.from;let inserted=null;
 db.from=(table)=>{const q={select(){return q},eq(){return q},order(){return q},limit(){return q},async maybeSingle(){return {data:table==='courses'?{id:1,trial_minutes:60}:table==='campaign_settings'?{campaign_key:'marketing-launch-10-day',enabled:true,launch_funnel_version:'free_hour_review_v1'}:table==='course_trials'?inserted:null}},async insert(value){inserted=value;return {error:null}}};return q};
 try{const router=require('../src/routes/courses'),handler=router.stack.find(layer=>layer.route?.path==='/:courseId/trial/start').route.stack.at(-1).handle;let status=200,body;const res={status(v){status=v;return this},json(v){body=v;return this}};await handler({params:{courseId:'1'},userId:9},res);assert.equal(status,201);assert.equal(Date.parse(inserted.expires_at)-Date.parse(inserted.started_at),600000);assert.equal(body.access.accessType,'trial');}finally{db.from=original}
});
