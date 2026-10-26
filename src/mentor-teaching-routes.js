const {isWorkedExampleRequest}=require('./mentor-turn-policy');
const ROUTES=Object.freeze(['concept_explanation','project_discussion','worked_example']);
function normalize(s){return s.normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').toLowerCase();}
function selectTeachingRoute(messages){
 const users=messages.filter(m=>m.role==='user').map(m=>normalize(m.content));const current=users.at(-1)||'';
 let name='concept_explanation';
 if(isWorkedExampleRequest(messages))name='worked_example';
 else if(/يعني ايه|ما هو|ما هي|عرف|نرجع\s*(?:للشرح|للفصل|للتسويق)|اكتب.{0,20}(?:صياغة|جملة)|من المعلومة دي بس/.test(current))name='concept_explanation';
 else if(users.slice(-4).some(t=>/عندي|مشروعي|متجري|عملائي|ميزانيتي|قالوا\s*لي|سالتهم|سألتهم/.test(t)))name='project_discussion';
 return {name,selection:'server_text_rules'};
}
const instructions={
 concept_explanation:`مسار شرح المفهوم فقط: اشرح المعنى ببساطة ثم مثالًا قريبًا واحدًا عند الحاجة. لو الطالب لم يفهم، غيّر زاوية الشرح بدل تكراره رسميًا. عند صياغة إعلان استخدم الخاصية المعطاة فقط وفائدتها المباشرة التي تدعمها، ولا تستبدل ادعاءً غير مثبت بآخر. لا تضف رضا أو شراء متكررًا أو مبيعات أو آثارًا صحية أو بيئية أو مالية بلا دليل؛ كلمة «ممكن» لا تثبتها. لا تحتاج سؤال متابعة أو تكليفًا بعد شرح مكتمل. move=explain وfollowUp=null.`,
 project_discussion:`مسار مناقشة المشروع فقط: ابنِ على ما قاله الطالب في الحوار. فرّق بوضوح بين ملاحظة العميل وافتراض سببها. لا تؤكد السعر أو أي سبب آخر ولا ترتب الأسباب أو تسرد احتمالات بلا دليل. إذا نقصت معلومة مؤثرة، ناقش المعروف باختصار ثم اسأل سؤالًا واحدًا محايدًا عن ملاحظات العملاء، لا سؤالًا يقود للسعر أو قناة مفترضة. عند ظهور دليل جديد، وضح ما يدعمه وقدّم خطوة محدودة تعالجه ولماذا، دون ادعاء أنه السبب الوحيد أو ضمان النتيجة. إذا كفى السياق، move=conclude وfollowUp=null؛ لا تطل الحوار بسؤال زائد.`,
 worked_example:`مسار HOW TO MAKE فقط: قدّم أنت مثالًا افتراضيًا معلنًا، لا تمرينًا للطالب. نظمه في أربع خطوات قصيرة مترابطة (يجوز حتى 6 خطوات إذا احتاج الطلب): 1. ملاحظة محددة أو كلام عميل داخل القصة. 2. تفسير محدود تدعمه الملاحظة، لا تخمين احتياجات. 3. قرار يعالجها مع سببه. 4. ما نلاحظه بعده، دون ضمان نتائج أو استنتاج سبب منفرد. انسب الحوار لشخصيات المثال وأجب أسئلتهم في نفس القصة؛ حتى 6 علامات استفهام. لا تخترع قواعد عامة أو منتجًا يناسب الجميع ولا تدّع نتائج حقيقية. حتى 300 كلمة، بلا علامات Markdown أو واجب أو طلب كتابة. followUp=null.`
};
function routeInstruction(name){if(!ROUTES.includes(name))throw Error('invalid_teaching_route');return instructions[name];}
module.exports={ROUTES,selectTeachingRoute,routeInstruction};
