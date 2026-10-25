const { boundedScopeReply } = require('./mentor-scope-boundary');
const FORMAT_REASONS = Object.freeze(['invalid_json','invalid_dialogue_turn','reply_too_long','reply_contains_question','reply_contains_list','followup_too_long','followup_multiple_questions','followup_multiline']);
const DIALOGUE_FORMAT = {type:'json_schema',json_schema:{name:'kero_dialogue_turn',strict:true,schema:{type:'object',properties:{reply:{type:'string'},followUp:{type:['string','null']},move:{type:'string',enum:['explain','clarify','challenge','discuss','conclude','scope','hint']}},required:['reply','followUp','move'],additionalProperties:false}}};
function parseDialogueTurn(raw) {
  const turn=JSON.parse(raw);
  if(!turn || typeof turn.reply!=='string' || !turn.reply.trim() || !['explain','clarify','challenge','discuss','conclude','scope','hint'].includes(turn.move) || !(turn.followUp===null||typeof turn.followUp==='string'))throw Error('invalid_dialogue_turn');
  if(Object.keys(turn).length!==3)throw Error('invalid_dialogue_turn');
  // Never render a model-written refusal. Validate the envelope, then use the
  // bounded response before checking style that belongs only to displayed text.
  if(turn.move==='scope')return {...boundedScopeReply(),followUpSuppressed:Boolean(turn.followUp?.trim())};
  const reply=turn.reply.trim();
  const proposedFollowUp=turn.followUp?.trim()||null;
  // Complete explanations/conclusions do not assign another task to the learner.
  // A genuinely missing decision fact or ambiguity belongs to clarify/discuss/hint.
  const followUpSuppressed=Boolean(proposedFollowUp && ['explain','conclude'].includes(turn.move));
  const followUp=followUpSuppressed ? null : proposedFollowUp;
  if(reply.split(/\s+/u).length>160)throw Error('reply_too_long');
  if(/[؟?]/u.test(reply))throw Error('reply_contains_question');
  if(/(?:^|\n)\s*(?:[-*•]|\d+[.)]|[١-٩][.)])\s+/u.test(reply))throw Error('reply_contains_list');
  if(followUp && followUp.split(/\s+/u).length>35)throw Error('followup_too_long');
  if(followUp && (followUp.match(/[؟?]/gu)||[]).length>1)throw Error('followup_multiple_questions');
  if(followUp && /\n/u.test(followUp))throw Error('followup_multiline');
  return {reply:reply+(followUp?'\n\n'+followUp:''),move:turn.move,followUp,followUpSuppressed};
}
module.exports={DIALOGUE_FORMAT,parseDialogueTurn,FORMAT_REASONS};

