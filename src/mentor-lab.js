const express = require('express');
const { DIALOGUE_PROFILE } = require('./mentor-consultant-pilot');
const crypto = require('node:crypto');
const { DIALOGUE_FORMAT, parseDialogueTurn } = require('./mentor-dialogue-contract');
const LAB_MODELS = Object.freeze(['gpt-4o-mini','gpt-5-mini']);
const { requiresScopeBoundary, boundedScopeReply } = require('./mentor-scope-boundary');

function createMentorLab({ db, authorize, sourceLimit, chatLimit, loadKnowledge, buildPrompt, countryForUser, fetchModel = fetch }) {
  const router = express.Router();
  const busy = new Set();
  router.use(authorize);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/profile', (req,res) => res.json({ok:true,experience:DIALOGUE_PROFILE,modelComparison:{version:1,models:LAB_MODELS,defaultModel:'gpt-4o-mini'}}));
  router.get('/source', sourceLimit, async (req, res) => {
    const slug = String(req.query.courseSlug || 'marketing-launch');
    const chapter = Number(req.query.chapter || 1);
    if (!['marketing-launch','marketing-growth','marketing-mastery','marketing-leadership'].includes(slug) || !Number.isInteger(chapter) || chapter < 1 || chapter > 12) return res.status(400).json({ok:false,error:'الكورس أو الفصل غير صالح.'});
    try {
      const source = await loadKnowledge(db,slug,chapter);
      return res.json({ok:true,source:metadata(source),studentPilotEnabled:process.env.MENTOR_CONSULTANT_PILOT==='true'});
    } catch { return res.status(503).json({ok:false,error:'تعذر التحقق من ملف الفصل في النسخة النشطة. لم نستخدم مرجعًا قديمًا بدلًا منه.'}); }
  });
  router.post('/chat', chatLimit, async (req,res) => {
    const messages = req.body?.messages;
    const requestedModel = req.body?.model === undefined ? 'gpt-4o-mini' : req.body.model;
    if (!LAB_MODELS.includes(requestedModel)) return res.status(400).json({ok:false,error:'اختر أحد النموذجين المتاحين في التجربة.'});
    const expectedPrompt = req.body?.expectedPromptSha256;
    if (expectedPrompt !== undefined && (typeof expectedPrompt !== 'string' || !/^[a-f0-9]{64}$/.test(expectedPrompt))) return res.status(400).json({ok:false,error:'معرّف المقارنة غير صالح.'});
    if (!Array.isArray(messages) || !messages.length || messages.length > 20 || messages.some(m => !m || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000) || messages[messages.length-1].role !== 'user') return res.status(400).json({ok:false,error:'المحادثة غير صالحة؛ الحد 20 رسالة و4000 حرف للرسالة.'});
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ok:false,error:'مفتاح النموذج غير مضبوط في إعدادات السيرفر.'});
    if (busy.has(req.userId)) return res.status(429).json({ok:false,error:'انتظر انتهاء الطلب الحالي.'});
    busy.add(req.userId);
    let source;
    const started = Date.now();
    try {
      source = await loadKnowledge(db,'marketing-launch',1);
      const country = await countryForUser(req.userId);
      const prompt = buildPrompt(country,source);
      const promptSha256 = crypto.createHash('sha256').update(prompt).digest('hex');
      if (expectedPrompt && expectedPrompt !== promptSha256) return res.status(409).json({ok:false,error:'تغيّر محتوى الفصل أو التعليمات أثناء المقارنة. ابدأ مقارنة جديدة.'});
      const boundaryReason=requiresScopeBoundary(messages);
      if(boundaryReason){const turn=boundedScopeReply(boundaryReason);return res.json({ok:true,reply:turn.reply,dialogue:{move:'scope',hasFollowUp:false},experience:DIALOGUE_PROFILE,source:metadata(source),generation:{requestedModel,returnedModel:null,promptSha256,responseOrigin:'scope_boundary',boundaryReason,modelCalled:false},usage:null,elapsedMs:Date.now()-started,review:'requires_human_review'});}
      const response = await fetchModel('https://api.openai.com/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
        body:JSON.stringify({model:requestedModel,max_completion_tokens:2400,response_format:DIALOGUE_FORMAT,messages:[{role:'system',content:prompt},...messages.map(m=>({role:m.role,content:m.content.trim()}))]}),
        signal:AbortSignal.timeout(45000),
      });
      if (!response.ok) return res.status(502).json({ok:false,error:'تعذر استخدام النموذج المحدد. تحقق من إتاحته ورصيد API؛ لم نبدله بنموذج آخر.',requestedModel});
      const data=await response.json(), choice=data.choices?.[0],reply=choice?.message?.content?.trim();
      if(!reply || choice.finish_reason!=='stop') return res.status(502).json({ok:false,error:'رد النموذج لم يكتمل؛ لم نعرضه باعتباره إجابة كاملة.'});
      let turn;
      try { turn=parseDialogueTurn(reply); }
      catch { return res.status(502).json({ok:false,error:'رد التجربة خرج عن صيغة الحوار المختصرة. أعد المحاولة؛ لم نعرضه كأنه اجتاز الفحص.',experience:DIALOGUE_PROFILE,review:'format_failed'}); }
      const modelScope=turn.move==='scope';
      if(modelScope)turn=boundedScopeReply();
      return res.json({ok:true,reply:turn.reply,dialogue:{move:turn.move,hasFollowUp:Boolean(turn.followUp)},experience:DIALOGUE_PROFILE,source:metadata(source),generation:{requestedModel,returnedModel:data.model||null,promptSha256,maxCompletionTokens:2400,reasoningEffort:'model-default',responseOrigin:modelScope?'scope_boundary':'model',boundaryReason:modelScope?'model_scope':null,modelCalled:true},usage:data.usage,elapsedMs:Date.now()-started,review:'requires_human_review'});
    } catch { return res.status(503).json({ok:false,error:source?'لم يكتمل طلب المحادثة. أعد المحاولة بعد قليل.':'تعذر التحقق من محتوى الفصل الحالي؛ لم يتم تخمين إجابة.'}); }
    finally { busy.delete(req.userId); }
  });
  return router;
}
function metadata(source) { return {courseSlug:source.courseSlug,chapter:source.chapter,title:source.title,versionId:source.versionId,file:source.file,sha256:source.sha256,characters:source.content.length}; }
module.exports = { createMentorLab };




