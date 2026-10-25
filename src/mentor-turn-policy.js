function normalize(value) {return String(value||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').toLowerCase();}
const ASSESSMENT=/اختبار|امتحان|كويز|\bquiz\b|\bexam\b|\bassessment\b|تمبليت|\btemplate\b/;
const ACTIVE=/انا\s*(?:في|داخل)\s*(?:ال)?(?:اختبار|امتحان|كويز)|(?:بحل|بجاوب|بامتحن).{0,20}(?:اختبار|امتحان|كويز)|(?:اختبار|امتحان|كويز).{0,16}(?:شغال|حاليا|الان)|\b(?:taking|in).{0,20}(?:exam|quiz|assessment)/;
const COPY=/اجاب[ةه]\s*(?:جاهز[ةه]|نهائي[ةه])|انقل|انسخ|اكتب.{0,35}(?:اجاب|الحل)|(?:حل|جاوب).{0,12}(?:لي|السوال)|جاهز.{0,30}(?:تسليم|اسلم)|\b(?:copy|submit|solve)\b|\b(?:give|write).{0,25}answer\b/;
const FINISHED=/خلصت\s*(?:ال)?(?:اختبار|امتحان|كويز)|انتهيت\s*من\s*(?:ال)?(?:اختبار|امتحان)|\bfinished (?:the |my )?(?:exam|quiz|assessment)\b/;
const STUDY_RETURN=/نرجع\s*(?:للشرح|للتسويق|للفصل|للتعلم)|مثال\s*(?:مختلف|تاني)|راجع\s*معايا\s*المفهوم/;
function assessmentBoundaryReason(messages) {
  const users=(messages||[]).filter(m=>m.role==='user').map(m=>normalize(m.content));
  const current=users.at(-1)||'';
  // Text-based protection in the admin pilot, not a trusted assessment-state check.
  if(FINISHED.test(current)&&!COPY.test(current))return null;
  if(ASSESSMENT.test(current)&&(COPY.test(current)||ACTIVE.test(current)))return COPY.test(current)?'assessment_ready_answer':'active_assessment';
  let active=false;
  for(const text of users.slice(0,-1)){if(FINISHED.test(text))active=false;else if(ASSESSMENT.test(text)&&(COPY.test(text)||ACTIVE.test(text)))active=true;}
  if(active&&COPY.test(current))return 'assessment_pressure';
  if(active&&!STUDY_RETURN.test(current)&&/اختار|اختر|الاجاب[ةه]\s*(?:ايه|ا|ب|ج)|\bwhich option\b/.test(current))return 'assessment_pressure';
  return null;
}
function assessmentHint() {
  return {reply:'طالما ده سؤال في اختبار أو تطبيق للتسليم، مش هكتب إجابة جاهزة تنقلها. أقدر أساعدك بطريقة الحل: حدّد المطلوب في السؤال، وارجع للفكرة المرتبطة به في الفصل، ثم اربطها بالموقف المذكور بدل نقل تعريف محفوظ. نقدر نراجع الفهم بمثال مختلف، من غير حل السؤال اللي هتسلّمه.',move:'hint',followUp:null};
}
function isWorkedExampleRequest(messages) {
  const current=normalize((messages||[]).filter(m=>m.role==='user').at(-1)?.content);
  return /how\s*to\s*make|هاو\s*تو\s*ميك|مثال.{0,30}محلول|مثال\s*افتراضي\s*كامل/.test(current);
}
module.exports={assessmentBoundaryReason,assessmentHint,isWorkedExampleRequest};
