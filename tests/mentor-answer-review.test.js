const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseReviewedTurn,reviewPromptHash,sumUsage,REVIEW_FORMAT}=require('../src/mentor-answer-review');
test('review rejects missing findings, unknown codes, extra fields and unrenderable output',()=>{
 const base={reply:'شرح',followUp:null,move:'explain',corrections:[]};
 for(const value of [{reply:'شرح',followUp:null,move:'explain'},{...base,corrections:['invented']},{...base,extra:true},{...base,reply:'أول؟ ثاني؟'}])assert.throws(()=>parseReviewedTurn(JSON.stringify(value)));
 assert.equal(REVIEW_FORMAT.json_schema.schema.additionalProperties,false);
});
test('review preserves valid explanations and scope cannot expose model-written implementation',()=>{
 assert.equal(parseReviewedTurn(JSON.stringify({reply:'شرح سليم',followUp:null,move:'explain',corrections:[]})).turn.reply,'شرح سليم');
 const result=parseReviewedTurn(JSON.stringify({reply:'كود غير مسموح؟',followUp:'تبدأ؟',move:'scope',corrections:['scope']}));assert.ok(!result.turn.reply.includes('كود غير مسموح'));assert.equal(result.turn.followUp,null);
});
test('usage sums real tokens including cache and reasoning; missing usage stays unknown',()=>{
 const first={prompt_tokens:12,completion_tokens:3,total_tokens:15,prompt_tokens_details:{cached_tokens:8},completion_tokens_details:{reasoning_tokens:1}};
 const second={prompt_tokens:10,completion_tokens:4,total_tokens:14,prompt_tokens_details:{cached_tokens:6},completion_tokens_details:{reasoning_tokens:2}};
 assert.deepEqual(sumUsage(first,second),{prompt_tokens:22,completion_tokens:7,total_tokens:29,prompt_tokens_details:{cached_tokens:14},completion_tokens_details:{reasoning_tokens:3}});assert.equal(sumUsage(first,null),null);
});
test('comparison hash binds review instructions to lesson and original instruction changes',()=>{
 assert.equal(reviewPromptHash('a'),reviewPromptHash('a'));assert.notEqual(reviewPromptHash('a'),reviewPromptHash('b'));
});
