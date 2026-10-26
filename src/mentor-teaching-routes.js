const {isWorkedExampleRequest}=require('./mentor-turn-policy');
const ROUTES=Object.freeze(['concept_explanation','project_discussion','worked_example']);
function normalize(s){return s.normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').toLowerCase();}
function selectTeachingRoute(messages){
 const users=messages.filter(m=>m.role==='user').map(m=>normalize(m.content));const current=users.at(-1)||'';
 let name='concept_explanation';
 if(isWorkedExampleRequest(messages))name='worked_example';
 else if(/يعني ايه|ما هو(?!\s*(?:السبب|الحل|القرار|المطلوب))|ما هي(?!\s*(?:الخطوة|الخطوات|الاسباب|النتيجة))|(?:^|[\s،:؛])(?:عرف|عرّف)(?=\s|[،:؛]|$)|نرجع\s*(?:للشرح|للفصل|للتسويق)|اكتب.{0,20}(?:صياغة|جملة)|من المعلومة دي بس/.test(current))name='concept_explanation';
 else if(users.slice(-4).some(t=>/عندي|مشروعي|متجري|عملائي|ميزانيتي|قالوا\s*لي|سالتهم|سألتهم/.test(t)))name='project_discussion';
 return {name,selection:'server_text_rules'};
}
const instructions={
 concept_explanation:`اشرح المعنى ثم مثالًا قصيرًا عند الحاجة. في إعادة صياغة إعلان استخدم الحقيقة المعطاة وحدها؛ لا تضف «مثالي» أو سهولة أو راحة أو أداء لم يذكره الطالب. الفائدة المباشرة تشرح ما تتيحه الخاصية فقط. move=explain وfollowUp=null.`,
 project_discussion:`ناقش كلام الطالب كمستشار: ميّز الملاحظة عن تفسيرها. إذا نقص دليل مؤثر، جملتان عن المعروف ثم سؤال محايد واحد في followUp، وreply بلا أسئلة أو قائمة أسباب مخمّنة. إذا قدّم دليلًا، اقترح خطوة تعالجه حسب الواقع دون اختراع سياسة أو سعر؛ لا نعرف هل هو السبب الوحيد. عند كفاية السياق move=conclude وfollowUp=null.`,
 worked_example:`قدّم مثالًا افتراضيًا محلولًا في أربع خطوات حتى 300 كلمة: كلام عميل يصرّح بحاجته؛ تفسير محدود؛ قرار يعالجها وسببه؛ ما سنراقبه لاحقًا. الخطوة الرابعة خطة ملاحظة وليست نتيجة حدثت: لا تزعم رضا أو ثقة أو زيادة عملاء. لا تطلب من الطالب كتابة أو تطبيقًا. followUp=null.`
};
function routeInstruction(name){if(!ROUTES.includes(name))throw Error('invalid_teaching_route');return instructions[name];}
module.exports={ROUTES,selectTeachingRoute,routeInstruction};

