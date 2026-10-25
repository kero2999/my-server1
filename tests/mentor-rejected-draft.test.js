const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rejectedDraft,MAX_CHARACTERS}=require('../src/mentor-rejected-draft');
test('structured diagnostics retain generated text but omit unknown model fields',()=>{
 const p=rejectedDraft(JSON.stringify({reply:'خطوة؟ مثال؟',followUp:'سؤال؟',move:'explain',secret:'omit'}));assert.equal(p.text,'خطوة؟ مثال؟\n\nسؤال؟');assert.equal(p.status,'rejected_admin_diagnostic_only');assert.equal(p.structured,true);assert.ok(!JSON.stringify(p).includes('omit'));
});
test('unstructured model content is bounded and never claimed to be a valid answer',()=>{
 const p=rejectedDraft('x'.repeat(MAX_CHARACTERS+100),'review');assert.equal(p.text.length,MAX_CHARACTERS);assert.equal(p.truncated,true);assert.equal(p.structured,false);assert.equal(p.stage,'review');
});
