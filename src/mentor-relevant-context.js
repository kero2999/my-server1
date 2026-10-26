const crypto=require('node:crypto');
const RETRIEVAL_VERSION='launch-concepts-v1';
function normalize(text){return String(text||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();}
function splitConcepts(content){
 const hits=[...content.matchAll(/^MARKETING LAUNCH \/ المفهوم (\d+)\n([^\n]+)/gm)];
 return hits.map((m,i)=>{let end=hits[i+1]?.index??content.length;const how=content.indexOf('HOW TO MAKE / المثال المحلول',m.index);if(how>=0&&how<end)end=how;return{id:Number(m[1]),title:m[2].trim(),text:content.slice(m.index,end).trim()};});
}
function selectRelevantContext(source,messages,route){
 const blocks=splitConcepts(source.content),query=normalize(messages.filter(m=>m.role==='user').at(-1)?.content||'');
 const words=[...new Set(query.split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>=4))];
 const topics=[[/خاصي|مواصف|فائد|قابل.{0,15}(?:فك|تركيب|تعب)|غطاء|بطاري/,/المواصفات مقابل الفوائد/],[/قيم/,/معادلة التسويق الاساسية/],[/تسويق.{0,20}(?:بيع|مبيعات)|فرق.{0,30}اعلان/,/الفرق بين التسويق والاعلان والمبيعات/],[/عميل|احتياج|حاج/,/التسويق يبدا من العميل وليس المنتج/],[/قبل.{0,15}اعلان|يبدا.{0,15}اعلان/,/هل التسويق يبدا بالاعلان/]];
 const scored=blocks.map(block=>{const title=normalize(block.title),text=normalize(block.text);let score=words.reduce((n,w)=>n+(title.includes(w)?8:text.includes(w)?1:0),0);
 for(const [question,titleMatch]of topics)if(question.test(query)&&titleMatch.test(title))score+=60;
 if(/خاصي|مواصف|فائد|غطاء|بطاري/.test(query)&&/المواصفات مقابل الفوائد/.test(title))score+=100;
 if(route==='project_discussion'&&/كيف يفكر المسوق/.test(title))score+=100;
 if(route==='worked_example'&&/كيف يفكر المسوق|معادلة التسويق الاساسية/.test(title))score+=100;
 if(/يعني ايه تسويق|ما هو التسويق/.test(query)&&/ما هو التسويق/.test(title))score+=100;
 return {...block,score};}).sort((a,b)=>b.score-a.score||a.id-b.id);
 let selected=[],length=0;
 for(const item of scored){if(item.score<=0||item.score<scored[0].score*0.6||selected.length===2)break;if(length+item.text.length>6000)continue;selected.push(item);length+=item.text.length;}
 // Small injected or legacy sources can be used intact. Never silently send a large unrecognized chapter.
 if(!blocks.length&&source.content.length<=6000)selected=[{id:null,title:source.title,text:source.content}];
 const content=selected.map(b=>b.text).join('\n\n');
 return {content,metadata:{version:RETRIEVAL_VERSION,sourceCharacters:source.content.length,characters:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex'),sections:selected.map(({id,title})=>({id,title})),matched:selected.length>0}};
}
module.exports={RETRIEVAL_VERSION,splitConcepts,selectRelevantContext};
