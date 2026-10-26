const {test}=require('node:test'),assert=require('node:assert/strict');const {inspectModelResponse}=require('../src/mentor-model-response');
const response=(content,finish_reason='stop',extra={})=>({choices:[{finish_reason,message:{content,...extra}}]});
test('separates empty, refusal, truncation and unexpected shape without exposing contents',()=>{
 assert.equal(inspectModelResponse(null).kind,'missing_choice');assert.equal(inspectModelResponse(response(null)).kind,'empty');assert.equal(inspectModelResponse(response('  ')).kind,'empty');assert.equal(inspectModelResponse(response('abc','length')).kind,'incomplete');assert.equal(inspectModelResponse(response([])).kind,'unsupported_content');const refusal=inspectModelResponse(response(null,'stop',{refusal:'PRIVATE'}));assert.equal(refusal.kind,'refusal');assert.ok(!JSON.stringify(refusal).includes('PRIVATE'));assert.equal(inspectModelResponse(response(' good ')).text,'good');
});
