const DIALOGUE_FORMAT = {type:'json_schema',json_schema:{name:'kero_dialogue_turn',strict:true,schema:{type:'object',properties:{reply:{type:'string'},followUp:{type:['string','null']},move:{type:'string',enum:['explain','clarify','challenge','discuss','conclude','scope','hint']}},required:['reply','followUp','move'],additionalProperties:false}}};
function parseDialogueTurn(raw) {
  const turn=JSON.parse(raw);
  if(!turn || typeof turn.reply!=='string' || !turn.reply.trim() || !['explain','clarify','challenge','discuss','conclude','scope','hint'].includes(turn.move) || !(turn.followUp===null||typeof turn.followUp==='string'))throw Error('invalid_dialogue_turn');
  const reply=turn.reply.trim(),followUp=turn.followUp?.trim()||null;
  if(reply.split(/\s+/u).length>160 || /[؟?]/u.test(reply) || /(?:^|\n)\s*(?:[-*•]|\d+[.)]|[١-٩][.)])\s+/u.test(reply))throw Error('invalid_dialogue_shape');
  if(followUp && (followUp.split(/\s+/u).length>35 || (followUp.match(/[؟?]/gu)||[]).length>1 || /\n/u.test(followUp)))throw Error('invalid_dialogue_question');
  return {reply:reply+(followUp?'\n\n'+followUp:''),move:turn.move,followUp};
}
module.exports={DIALOGUE_FORMAT,parseDialogueTurn};
