const express = require('express');
const { DIALOGUE_PROFILE } = require('./mentor-consultant-pilot');
const crypto = require('node:crypto');
const { DIALOGUE_FORMAT, parseDialogueTurn, parseDialogueEnvelope, FORMAT_REASONS } = require('./mentor-dialogue-contract');
const { REVIEW_FORMAT, buildReviewMessages, parseReviewedTurn, reviewPromptHash, sumUsage } = require('./mentor-answer-review');
const LAB_MODELS = Object.freeze(['gpt-4o-mini','gpt-5-mini']);
const { requiresScopeBoundary, boundedScopeReply } = require('./mentor-scope-boundary');

function createMentorLab({ db, authorize, sourceLimit, chatLimit, loadKnowledge, buildPrompt, countryForUser, fetchModel = fetch }) {
  const router = express.Router();
  const busy = new Set();
  router.use(authorize);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/profile', (req,res) => res.json({ok:true,experience:DIALOGUE_PROFILE,diagnosticsVersion:1,answerReview:{version:2,maxModelCalls:2,defaultMode:'direct',comparison:{draftModel:'gpt-4o-mini',reviewerModel:'gpt-5-mini',historyPolicy:'shared_direct_history'}},modelComparison:{version:1,models:LAB_MODELS,defaultModel:'gpt-4o-mini'}}));
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
    if (!LAB_MODELS.includes(requestedModel)) return res.status(400).json({ok:false,code:'MENTOR_MODEL_NOT_ALLOWED',error:'اختر أحد النموذجين المتاحين في التجربة.'});
    const compareReview=req.body?.compareReview===true;
    if(req.body?.compareReview!==undefined&&typeof req.body.compareReview!=='boolean')return res.status(400).json({ok:false,code:'MENTOR_COMPARISON_INVALID',error:'خيار المقارنة غير صالح.'});
    const reviewerModel=req.body?.reviewerModel===undefined?'gpt-5-mini':req.body.reviewerModel;
    if(compareReview&&(!LAB_MODELS.includes(reviewerModel)||reviewerModel===requestedModel))return res.status(400).json({ok:false,code:'MENTOR_REVIEWER_INVALID',error:'اختر مراجعًا مختلفًا من النموذجين المتاحين.'});
    const expectedPrompt = req.body?.expectedPromptSha256;
    if (expectedPrompt !== undefined && (typeof expectedPrompt !== 'string' || !/^[a-f0-9]{64}$/.test(expectedPrompt))) return res.status(400).json({ok:false,code:'MENTOR_CONTEXT_INVALID',error:'معرّف المقارنة غير صالح.'});
    if (!Array.isArray(messages) || !messages.length || messages.length > 20 || messages.some(m => !m || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000) || messages[messages.length-1].role !== 'user') return res.status(400).json({ok:false,code:'MENTOR_MESSAGES_INVALID',error:'المحادثة غير صالحة؛ الحد 20 رسالة و4000 حرف للرسالة.'});
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ok:false,code:'MENTOR_NOT_CONFIGURED',error:'مفتاح النموذج غير مضبوط في إعدادات السيرفر.'});
    if (busy.has(req.userId)) return res.status(429).json({ok:false,code:'MENTOR_BUSY',error:'انتظر انتهاء الطلب الحالي.'});
    busy.add(req.userId);
    let source,stage='draft',draftUsage=null,draftElapsedMs=null,reviewStarted=null,modelCalls=0,baseline=null;
    const started = Date.now();
    try {
      source = await loadKnowledge(db,'marketing-launch',1);
      const country = await countryForUser(req.userId);
      const prompt = buildPrompt(country,source);
      const promptSha256 = crypto.createHash('sha256').update(prompt+'\n'+reviewPromptHash(prompt)+'\npaired-review-v1').digest('hex');
      if (expectedPrompt && expectedPrompt !== promptSha256) return res.status(409).json({ok:false,code:'MENTOR_CONTEXT_CHANGED',error:'تغيّر محتوى الفصل أو التعليمات أثناء المقارنة. ابدأ مقارنة جديدة.'});
      const boundaryReason=requiresScopeBoundary(messages);
      if(boundaryReason){const turn=boundedScopeReply(boundaryReason);return res.json({ok:true,reply:turn.reply,answerReview:{status:'not_needed_scope',modelCalled:false},...(compareReview?{comparison:{kind:'paired_review',evaluated:false,reason:'deterministic_scope',direct:{reply:turn.reply,modelCalled:false},reviewed:null}}:{}),dialogue:{move:'scope',hasFollowUp:false},experience:DIALOGUE_PROFILE,source:metadata(source),generation:{requestedModel,returnedModel:null,promptSha256,responseOrigin:'scope_boundary',boundaryReason,modelCalled:false,modelCalls:0},usage:null,elapsedMs:Date.now()-started,review:'requires_human_review'});}
      const signal=AbortSignal.timeout(45000);
      const draftStarted=Date.now();
      modelCalls++;
      const response = await fetchModel('https://api.openai.com/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
        body:JSON.stringify({model:requestedModel,max_completion_tokens:2400,response_format:DIALOGUE_FORMAT,messages:[{role:'system',content:prompt},...messages.map(m=>({role:m.role,content:m.content.trim()}))]}),
        signal,
      });
      if (!response.ok) return res.status(502).json({ok:false,code:'MENTOR_PROVIDER_ERROR',error:'تعذر استخدام النموذج المحدد. تحقق من إتاحته ورصيد API؛ لم نبدله بنموذج آخر.',diagnostics:{requestedModel,providerStatus:response.status,elapsedMs:Date.now()-started}});
      const data=await response.json(), choice=data.choices?.[0],reply=choice?.message?.content?.trim();
      if(!reply || choice.finish_reason!=='stop') return res.status(502).json({ok:false,code:'MENTOR_REPLY_INCOMPLETE',error:'رد النموذج لم يكتمل؛ لم نعرضه باعتباره إجابة كاملة.',diagnostics:{requestedModel,returnedModel:data.model||null,finishReason:choice?.finish_reason||null,usage:data.usage||null,elapsedMs:Date.now()-started}});
      draftUsage=data.usage||null;draftElapsedMs=Date.now()-draftStarted;
      let turn,draft;
      try { draft=parseDialogueEnvelope(reply);if(draft.move==='scope'||!compareReview)turn=parseDialogueTurn(reply); }
      catch (error) { const formatReason=FORMAT_REASONS.includes(error.message)?error.message:'invalid_json';return res.status(502).json({ok:false,code:'MENTOR_FORMAT_INVALID',error:'رد التجربة خرج عن صيغة الحوار المختصرة. لم نعرضه كأنه اجتاز الفحص.',experience:DIALOGUE_PROFILE,review:'format_failed',diagnostics:{formatReason,requestedModel,returnedModel:data.model||null,promptSha256,sourceSha256:source.sha256,usage:data.usage||null,elapsedMs:Date.now()-started}}); }
      let answerReview={status:turn?.move==='scope'?'not_needed_scope':'disabled_for_direct',modelCalled:false};
      if(compareReview){
        let directTurn=null,formatReason=null;
        try{directTurn=parseDialogueTurn(reply);}catch(error){formatReason=FORMAT_REASONS.includes(error.message)?error.message:'invalid_json';}
        baseline={promptSha256,sourceSha256:source.sha256,reply:directTurn?.reply||draft.reply+(draft.followUp?'\n\n'+draft.followUp:''),formatValid:Boolean(directTurn),formatReason,dialogue:directTurn?{move:directTurn.move,hasFollowUp:Boolean(directTurn.followUp)}:null,requestedModel,returnedModel:data.model||null,usage:draftUsage,elapsedMs:draftElapsedMs,modelCalled:true,review:'unreviewed_requires_human_review'};
      }
      if(!turn){
        stage='review';reviewStarted=Date.now();
        modelCalls++;
        const reviewedResponse=await fetchModel('https://api.openai.com/v1/chat/completions',{
          method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
          body:JSON.stringify({model:reviewerModel,max_completion_tokens:4800,response_format:REVIEW_FORMAT,messages:buildReviewMessages(prompt,source,messages,draft)}),signal,
        });
        if(!reviewedResponse.ok)return res.status(502).json({ok:false,code:'MENTOR_REVIEW_UNAVAILABLE',error:'تعذرت مراجعة دقة الرد؛ الرد المباشر محفوظ للمقارنة فقط، ولم يُعتمد كإجابة مراجعة.',diagnostics:{stage,modelCalls:2,usageComplete:false,providerStatus:reviewedResponse.status,requestedModel,reviewerModel,usage:draftUsage,...(baseline?{baseline,promptSha256,sourceSha256:source.sha256}:{}),elapsedMs:Date.now()-started}});
        const reviewedData=await reviewedResponse.json(),reviewedChoice=reviewedData.choices?.[0];
        const accountedUsage=sumUsage(draftUsage,reviewedData.usage||null);
        if(!reviewedChoice?.message?.content || reviewedChoice.finish_reason!=='stop')return res.status(502).json({ok:false,code:'MENTOR_REVIEW_INCOMPLETE',error:'مراجعة الرد لم تكتمل؛ الرد المباشر محفوظ للمقارنة فقط.',diagnostics:{stage,modelCalls:2,usageComplete:Boolean(accountedUsage),finishReason:reviewedChoice?.finish_reason||null,requestedModel,reviewerModel,usage:accountedUsage,...(baseline?{baseline,promptSha256,sourceSha256:source.sha256}:{}),elapsedMs:Date.now()-started}});
        let reviewed;
        try{reviewed=parseReviewedTurn(reviewedChoice.message.content);}
        catch(error){return res.status(502).json({ok:false,code:'MENTOR_REVIEW_FORMAT_INVALID',error:'تعذر اعتماد صيغة الرد المراجع؛ الرد المباشر محفوظ للمقارنة فقط.',review:'format_failed',diagnostics:{stage,modelCalls:2,usageComplete:Boolean(accountedUsage),formatReason:FORMAT_REASONS.includes(error.message)?error.message:'invalid_review_envelope',requestedModel,reviewerModel,usage:accountedUsage,...(baseline?{baseline,promptSha256,sourceSha256:source.sha256}:{}),elapsedMs:Date.now()-started}});}
        turn=reviewed.turn;
        answerReview={status:'model_reviewed_requires_human_review',modelCalled:true,requestedModel:reviewerModel,returnedModel:reviewedData.model||null,promptSha256:reviewPromptHash(prompt),corrections:reviewed.corrections,usage:reviewedData.usage||null,elapsedMs:Date.now()-reviewStarted};
      }
      const modelScope=turn.move==='scope';
      return res.json({ok:true,reply:turn.reply,answerReview,...(compareReview?{comparison:{kind:'paired_review',evaluated:answerReview.modelCalled,historyPolicy:'shared_direct_history',direct:baseline,reviewed:answerReview.modelCalled?{reply:turn.reply,model:answerReview.returnedModel,usage:answerReview.usage,elapsedMs:answerReview.elapsedMs}:null}}:{}),dialogue:{move:turn.move,hasFollowUp:Boolean(turn.followUp),followUpSuppressed:Boolean(turn.followUpSuppressed)},experience:DIALOGUE_PROFILE,source:metadata(source),generation:{requestedModel,returnedModel:data.model||null,promptSha256,maxCompletionTokens:2400,reasoningEffort:'model-default',responseOrigin:modelScope?'scope_boundary':'model',boundaryReason:modelScope?'model_scope':null,modelCalled:true,modelCalls,reviewerModel:compareReview?reviewerModel:null,draftElapsedMs,draftUsage},usage:answerReview.modelCalled?sumUsage(draftUsage,answerReview.usage):draftUsage,elapsedMs:Date.now()-started,review:'requires_human_review'});
    } catch (error) { const timeout=['AbortError','TimeoutError'].includes(error?.name);return res.status(503).json({ok:false,code:!source?'MENTOR_SOURCE_UNAVAILABLE':timeout?(stage==='review'?'MENTOR_REVIEW_TIMEOUT':'MENTOR_MODEL_TIMEOUT'):'MENTOR_REQUEST_INCOMPLETE',diagnostics:{stage,modelCalls,usageComplete:false,usage:draftUsage,...(baseline?{baseline,reviewerModel}:{}),elapsedMs:Date.now()-started},error:!source?'تعذر التحقق من محتوى الفصل الحالي؛ لم يتم تخمين إجابة.':timeout?(stage==='review'?'انتهت مهلة مراجعة الرد؛ الرد المباشر محفوظ للمقارنة فقط.':'انتهت مهلة طلب النموذج قبل وصول رد كامل.'):'لم يكتمل طلب المحادثة. أعد المحاولة بعد قليل.'}); }
    finally { busy.delete(req.userId); }
  });
  return router;
}
function metadata(source) { return {courseSlug:source.courseSlug,chapter:source.chapter,title:source.title,versionId:source.versionId,file:source.file,sha256:source.sha256,characters:source.content.length}; }
module.exports = { createMentorLab };









