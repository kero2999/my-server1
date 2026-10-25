const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDialogueTurn}=require('../src/mentor-dialogue-contract');
const turn=(reply,followUp=null,move='explain')=>JSON.stringify({reply,followUp,move});
test('allows direct explanations and a focused follow-up without forcing questions',()=>{
 assert.equal(parseDialogueTurn(turn('القيمة هي الفائدة التي تهم العميل.')).reply,'القيمة هي الفائدة التي تهم العميل.');
 assert.equal(parseDialogueTurn(turn('السعر احتمال غير مثبت.','ما الذي منع الشراء؟','clarify')).reply,'السعر احتمال غير مثبت.\n\nما الذي منع الشراء؟');
});
test('blocks the observed numbered-list article and excessive length',()=>{
 for(const reply of ['نص عام\n1. السعر\n2. المنافسون\n3. التجربة','كلمة '.repeat(161),'توضيح؟'])assert.throws(()=>parseDialogueTurn(turn(reply)));
});
test('rejects invalid JSON, missing fields and multiple follow-up questions',()=>{
 for(const raw of ['raw answer','{}',turn('توضيح','لماذا؟ وكيف؟'),turn('توضيح',null,'other'),turn('توضيح',42)])assert.throws(()=>parseDialogueTurn(raw));
});
