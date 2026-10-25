const MAX_CHARACTERS=8000;
function rejectedDraft(raw,stage='draft') {
  // Only called on the model's generated content after admin authorization.
  // Never pass provider error bodies, headers, prompts or response envelopes here.
  let text=String(raw||''),structured=false;
  try {
    const value=JSON.parse(text);
    if(value&&typeof value==='object'){
      structured=true;
      text=typeof value.reply==='string'?value.reply:'';
      if(typeof value.followUp==='string'&&value.followUp.trim())text+='\n\n'+value.followUp;
    }
  } catch { /* Non-JSON generated text is useful for diagnosing invalid_json. */ }
  return {status:'rejected_admin_diagnostic_only',stage:stage==='review'?'review':'draft',text:text.slice(0,MAX_CHARACTERS),structured,truncated:text.length>MAX_CHARACTERS};
}
module.exports={rejectedDraft,MAX_CHARACTERS};
