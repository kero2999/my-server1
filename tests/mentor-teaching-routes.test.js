const {test}=require('node:test'),assert=require('node:assert/strict');
const {selectTeachingRoute,ROUTES,routeInstruction}=require('../src/mentor-teaching-routes');
const {buildDialoguePrompt}=require('../src/mentor-consultant-pilot');
const u=content=>({role:'user',content});
test('server routes preserve project continuity and allow explicit return to explanation',()=>{
 assert.equal(selectTeachingRoute([u('عندي مركز تعليم'),u('قالوا لي المستوى مش واضح')]).name,'project_discussion');
 assert.equal(selectTeachingRoute([u('عندي مركز'),u('نرجع للشرح يعني إيه قيمة')]).name,'concept_explanation');
 assert.equal(selectTeachingRoute([u('عندي مركز'),u('HOW TO MAKE بمثال محلول')]).name,'worked_example');
 assert.equal(selectTeachingRoute([u('اكتب جملة من المعلومة دي بس')]).name,'concept_explanation');
});
test('only chosen teaching path is included with unchanged lesson content',()=>{
 const k={content:'محتوى موثق كامل',courseSlug:'marketing-launch',chapter:1,versionId:37};
 for(const route of ROUTES){const prompt=buildDialoguePrompt(null,k,route);assert.ok(prompt.includes(k.content));for(const other of ROUTES)assert.equal(prompt.includes(routeInstruction(other)),other===route);}
});
