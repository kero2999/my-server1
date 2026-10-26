function inspectModelResponse(data){
 const choice=data?.choices?.[0],message=choice?.message,content=message?.content;
 const flags={choicePresent:Boolean(choice),messagePresent:Boolean(message),contentType:content===null?'null':Array.isArray(content)?'array':typeof content,contentLength:typeof content==='string'?content.length:0,refusalPresent:Boolean(message?.refusal),parsedPresent:message?.parsed!=null,toolCallsPresent:Boolean(message?.tool_calls?.length)};
 const finishReason=typeof choice?.finish_reason==='string'?choice.finish_reason:null;
 let kind=!choice||!message||typeof message!=='object'||Array.isArray(message)?'missing_choice':flags.refusalPresent?'refusal':finishReason!=='stop'?'incomplete':content==null||typeof content==='string'&&!content.trim()?'empty':typeof content!=='string'?'unsupported_content':'ok';
 return {kind,flags,finishReason,...(kind==='ok'?{text:content.trim()}:{})};
}
function responseFailure(kind,review=false){const prefix=review?'MENTOR_REVIEW':'MENTOR';return kind==='refusal'?prefix+(review?'_REFUSAL':'_MODEL_REFUSAL'):kind==='empty'?prefix+'_EMPTY_CONTENT':kind==='incomplete'?prefix+(review?'_INCOMPLETE':'_REPLY_INCOMPLETE'):prefix+'_RESPONSE_SHAPE';}
module.exports={inspectModelResponse,responseFailure};
