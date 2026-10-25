function normalize(value) { return String(value||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').toLowerCase(); }
const TECH = /تعلم\s*(?:ال)?(?:الي|الة)|تعل[يّ]?م\s*(?:ال)?الة|machine\s*learning|scikit|xgboost|tensorflow|\bpython\b|بايثون/i;
const IMPLEMENT = /(?:ال)?كود|\bcode\b|برمج|تنفيذ|نفذ|ابني|نبني|بناء|در[بّ]|تدريب|implementation/i;
function requiresScopeBoundary(messages) {
  const users=(messages||[]).filter(m=>m.role==='user').map(m=>normalize(m.content));
  const current=users.at(-1)||'';
  if(TECH.test(current)&&IMPLEMENT.test(current))return 'technical_implementation';
  // A normal marketing coupon question is not a programming request.
  if(/كود\s*(?:خصم|ترويجي)|coupon|promo\s*code/.test(current))return null;
  if((IMPLEMENT.test(current)||/مورد\s*منفصل|بعيد\s*عن\s*الكورس|خارج\s*الكورس/.test(current))&&users.slice(0,-1).some(m=>TECH.test(m)&&IMPLEMENT.test(m)))return 'repeated_technical_request';
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
