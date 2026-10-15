const definitions=require('../data/chapter-templates.json');
// Public syllabus only. Never serialize answer keys, evaluation prompts or private templates.
function courseOverview(slug){
 const definition=definitions[String(slug||'')];
 if(!definition)return null;
 return {title:definition.courseTitle,chapters:definition.templates.map(item=>({number:item.chapterNumber,title:item.chapterTitle,concept:item.concept,skill:item.skill,application:item.taskTitle})),approach:'مفهوم واضح، مثال عملي، وقالب تطبّق به على مشروعك.',mentor:'Kero مساعد ذكي لفهم الدروس ومراجعة التطبيق؛ وقد يخطئ.'};
}
module.exports={courseOverview};
