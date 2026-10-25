function normalize(value) { return String(value||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').toLowerCase(); }
const TECH = /تعلم\s*(?:ال)?(?:الي|الة)|تعل[يّ]?م\s*(?:ال)?الة|machine\s*learning|scikit|xgboost|tensorflow|\bpython\b|بايثون|\breact\b|رياكت|جافا\s*سكريبت|\bjavascript\b/i;
const IMPLEMENT = /(?:ال)?كود|\bcode\b|برمج|تنفيذ|نفذ|ابني|نبني|بناء|در[بّ]|تدريب|implementation/i;
const BUILD = /اكتب(?:لي)?|اعمل(?:لي)?|تعمل(?:لي)?|صمم|انش[ئي]|طور|\b(?:write|build|create|develop)\b/i;
const ARTIFACT = /برنامج|تطبيق|سكربت|سكريبت|\b(?:program|app|script|application)\b/i;
function implementationRequest(text) {
  const clean=text.replace(/كود\s*(?:خصم|ترويجي)|coupon|promo\s*code/g,'');
  return TECH.test(clean)&&(IMPLEMENT.test(clean)||(BUILD.test(clean)&&ARTIFACT.test(clean)));
}
function requiresScopeBoundary(messages) {
  const users=(messages||[]).filter(m=>m.role==='user').map(m=>normalize(m.content));
  const current=users.at(-1)||'';
  if(implementationRequest(current))return 'technical_implementation';
  // A normal marketing coupon question is not a programming request.
  if(/كود\s*(?:خصم|ترويجي)|coupon|promo\s*code/.test(current))return null;
  if((IMPLEMENT.test(current)||(BUILD.test(current)&&ARTIFACT.test(current))||/مورد\s*منفصل|بعيد\s*عن\s*الكورس|خارج\s*الكورس/.test(current))&&users.slice(0,-1).some(implementationRequest))return 'repeated_technical_request';
  return null;
}
function boundedScopeReply(reason='model_scope') {
  const technical=reason==='technical_implementation'||reason==='repeated_technical_request';
  return {reply:technical
    ? 'التنفيذ التقني المتقدم المطلوب خارج نطاق تجربة المستوى الأول. نقدر نفهم المفهوم التسويقي المرتبط بسؤالك على قدر محتوى الفصل، لكن مش هقدّم الكود أو التدريب المتقدم، حتى كمورد منفصل. ومش عندي دليل موثّق يحدد مستوى آخر بيشرح التنفيذ ده.'
    : 'مش متاح لي شرح موثّق للتفاصيل دي ضمن مصادر المستوى الحالي. هلتزم بالجزء اللي نقدر نفهمه من محتوى الكورس، ومش هقدّم تنفيذًا متقدمًا أو موردًا منفصلًا خارج المنهج. ولا هحدد مكان التفاصيل في مستوى آخر من غير دليل موثّق.',
    move:'scope',followUp:null};
}
module.exports={requiresScopeBoundary,boundedScopeReply};


