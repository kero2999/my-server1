const test=require('node:test'),assert=require('node:assert/strict');
const {reviewedQuiz,VERSION}=require('../src/reviewed-quizzes');
test('reviewed Launch bank has valid keys, balanced options and a corrected brand definition',()=>{
 const counts=[0,0,0,0];
 for(let n=1;n<=12;n++){
  const q=reviewedQuiz({slug:'marketing-launch'},{quiz_key:'quiz-'+n});
  assert.equal(q.version,VERSION);assert.equal(q.questions.length,10);
  for(const item of q.questions){assert(item.options.length>=2 && item.options.length<=4);assert(item.q);assert(item.options[item.correctIndex]);counts[item.correctIndex]++;}
 }
 assert.deepEqual(counts,[30,31,30,29]);
 const brand=reviewedQuiz({slug:'marketing-launch'},{quiz_key:'quiz-7'}).questions[0];
 assert.notEqual(brand.options[brand.correctIndex],'اسم المنتج فقط');
 assert.match(brand.options[brand.correctIndex],/ذهن|انطباع|شعور|تجربة/);
 assert.equal(reviewedQuiz({slug:'marketing-growth'},{quiz_key:'quiz-1'}),null);
});
test('reviewed authored presentation skips legacy layout additions only',()=>{
 const {prepareCourseHtml}=require('../src/routes/content');
 const input='<html><head><meta name="ql-course-release" content="2026-10-17"></head><body><h1>شرح الفصل</h1></body></html>';
 const output=prepareCourseHtml(Buffer.from(input),'ch2.html','marketing-launch',1).toString();
 assert.equal(output,input);
 assert.match(prepareCourseHtml(Buffer.from('<html><head></head><body>قديم</body></html>'),'ch2.html','marketing-launch',1).toString(),/site-floatnav/);
});
test('HTML serializer attribute order never reintroduces legacy chapter images',()=>{
 const {prepareCourseHtml}=require('../src/routes/content');
 for(const marker of [
  '<meta content="2026-10-17" name="ql-course-release"/>',
  "<META data-other='value' content = '2026-10-17' name = 'ql-course-release'>",
  '<meta\nname="ql-course-release"\ncontent="2026-10-17">'
 ]){
  const input='<html><head>'+marker+'</head><body><h1>الفكرة</h1><img src="authored.jpg"><a href="course-home.html">الفهرس</a></body></html>';
  for(const file of ['index.html','ch2.html','ch12.html']){
   const output=prepareCourseHtml(Buffer.from(input),file,'marketing-launch',4).toString();
   assert(!output.includes('ql-chapter-visual'));assert(!output.includes('site-floatnav'));
   assert(output.includes('authored.jpg'));assert(output.includes('?activity=index'));
  }
 }
});
test('authored catalog receives live progress script without obsolete placeholder status script',()=>{
 const {prepareCourseHtml}=require('../src/routes/content');
 const input='<html><head><meta content="2026-10-17" name="ql-course-release"/></head><body><script>QLLearning.request(\'learning\',1).then(()=>{});</script><script>keepFilters()</script></body></html>';
 const output=prepareCourseHtml(Buffer.from(input),'launch-visual-20261017/course-home.html','marketing-launch',4).toString();
 assert(output.includes('launch-course-catalog.js'));assert(!output.includes("QLLearning.request('learning',1)"));assert(output.includes('keepFilters()'));
});
test('quiz endpoint rejects missing or stale versions and incomplete answers before saving attempts',async()=>{
 const db=require('../src/db'),original=db.from;let inserted=0;
 db.from=(table)=>{const q={select(){return q},eq(){return q},order(){return q},limit(){return q},async maybeSingle(){return {data:table==='courses'?{id:1,slug:'marketing-launch',price_cents:0}:table==='quizzes'?{id:1,quiz_key:'quiz-1',passing_score:70,questions:[]}:table==='users'?{id:9,role:'admin'}:null}},insert(){inserted++;return q},async single(){return {data:{score:100,passed:true}}}};return q};
 try{
  const router=require('../src/routes/courses');const handler=router.stack.find(l=>l.route?.path==='/:courseId/quizzes/:quizId/submit').route.stack.at(-1).handle;
  for(const body of [{answers:[]},{quizVersion:'old',answers:[]},{quizVersion:VERSION,answers:[null]}]){
   let status=200,payload;const res={status(s){status=s;return this},json(x){payload=x;return this}};
   await handler({params:{courseId:'1',quizId:'1'},userId:9,body},res);
   assert([400,409].includes(status),JSON.stringify({status,payload}));assert.equal(inserted,0);
  }
 }finally{db.from=original}
});
