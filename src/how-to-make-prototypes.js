const BUYER_PERSONA_DEMO = {
  courseSlug: 'marketing-launch', chapterNumber: 1,
  product: 'Online English Course',
  productDescription: 'كورس يساعد الشباب على تطوير مهارات التحدث باللغة الإنجليزية، والاستعداد لمقابلات العمل بثقة.',
  productProblem: 'المشكلة التي يحاول حلّها: ضعف الثقة في التحدث',
  personaName: 'Ahmed — The Career Starter',
  personaRole: '23 سنة · خريج جديد · يبحث عن وظيفة في شركة دولية',
  steps: [
    { number:'01', icon:'fa-user-check', title:'نحدد الشخص', whatWeDo:'قبل أي شيء، نبحث عن شخص حقيقي واحد يمثل العميل الذي نريد الوصول إليه — مش فكرة عامة عن جمهور واسع.', why:'لأن أحمد لديه بالضبط المشكلة التي يمكن لمنتجنا حلها، وده بيخلّينا نبدأ من نقطة دقيقة بدل التخمين.', example:'أحمد — 23 سنة، خريج جديد يبحث عن وظيفة في شركة دولية.', result:'بداية ملف الـ Persona: اسم واحد فقط، والباقي هنبنيه خطوة بخطوة.' },
    { number:'02', icon:'fa-magnifying-glass', title:'نكتشف المشكلة', whatWeDo:'نلاحظ سلوك أحمد ونسأله أسئلة بسيطة لنفهم أين بالضبط بيواجه صعوبة حقيقية — مش مشكلة عامة.', why:'لأن تحديد المشكلة بدقة، مش بشكل عام، هو اللي بيخلّي الحل بعد كده فعّال فعلاً.', example:'أحمد بيفهم الإنجليزية كويس، لكن لما يتكلم في مقابلة شغل، بيتوتر وبيفقد ثقته فجأة.', result:'المشكلة الحقيقية: ضعف الثقة أثناء الـ Speaking.' },
    { number:'03', icon:'fa-fire', title:'نكتشف الدافع', whatWeDo:'نسأل: ليه أحمد أصلاً عايز يحل المشكلة دي؟ الدافع هو اللي بيحرك قرار الشراء الفعلي، مش المشكلة لوحدها.', why:'لأن الناس مش بتشتري الحل لذاته، بتشتريه لأنه بيقربهم من حاجة هما عايزينها فعلاً.', example:'سألنا أحمد: «ليه مهم بالنسبالك تتحسن في الـ Speaking؟» فأجاب: عايز أعدّي المقابلات وأحصل على فرصة أفضل.', result:'English Speaking → Interview Confidence → Better Job Opportunity.' },
    { number:'04', icon:'fa-hand', title:'نكتشف الاعتراض', whatWeDo:'نسمع كويس إيه اللي بيوقف أحمد فعليًا عن اتخاذ القرار — الأسباب اللي بتخليه يتردد رغم إن احتياجه واضح.', why:'لأن تجاهل الاعتراض معناه إننا هنبني منتج ورسالة تسويقية بتتجاهل السبب الحقيقي للتردد.', example:'«جربت كورسات قبل كده ومكملتش.» و«معنديش وقت لكورس طويل.»', result:'اعتراضات العميل: تجربة سابقة فاشلة وضيق الوقت.' },
    { number:'05', icon:'fa-layer-group', title:'نجمع الصورة الكاملة', whatWeDo:'نحط كل حاجة اكتشفناها في مكان واحد: مين هو، مشكلته إيه، دافعه إيه، وإيه اللي بيوقفه.', why:'لأن Buyer Persona الكويسة مش قائمة معلومات متفرقة، هي صورة واحدة مترابطة لشخص حقيقي.', example:'الهدف: وظيفة أفضل | المشكلة: ثقة الـ Speaking | الدافع: اجتياز المقابلات | الاعتراض: الوقت وتجربة سابقة.', result:'Visual Profile مكتمل يمكن للفريق كله الرجوع إليه.' },
    { number:'06', icon:'fa-id-card', title:'نصنع Buyer Persona', whatWeDo:'نحوّل كل المعلومات اللي جمعناها لبطاقة واحدة واضحة، أي حد في الفريق يقدر يرجعلها بسرعة.', why:'لأن القرارات التسويقية بتتاخد أسرع وأدق لما يكون فيه شخص محدد إحنا بنصمم من أجله، مش جمهور مبهم.', example:'Ahmed — The Career Starter: خريج جديد يريد وظيفة أفضل، مشكلته الثقة في التحدث، ودافعه اجتياز المقابلات.', result:'Buyer Persona جاهزة للاستخدام في الرسائل والإعلانات واختيار القنوات.' }
  ]
};
function getHowToMakePrototype(courseSlug, chapterNumber) {
  return String(courseSlug).toLowerCase() === BUYER_PERSONA_DEMO.courseSlug && Number(chapterNumber) === BUYER_PERSONA_DEMO.chapterNumber ? BUYER_PERSONA_DEMO : null;
}
module.exports = { BUYER_PERSONA_DEMO, getHowToMakePrototype };
