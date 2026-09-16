-- Marketing Leadership course setup for QuadraLevel
-- Generated from the reviewed 12-chapter ZIP. Safe to rerun.
-- Creates/updates the draft course, 12 lessons, 12 official quizzes, and one capstone project.
-- Run in Supabase SQL Editor before uploading and publishing the ZIP.

begin;

insert into courses (slug, title, description, thumbnail_url, price_cents, currency, category_id, instructor, status, trial_minutes, entry_file, updated_at)
values (
  'marketing-leadership',
  'Marketing Leadership',
  'المستوى الرابع المتقدم من مسار التسويق في QuadraLevel. يطوّر قدرة المتعلم على قيادة التسويق كمنظومة نمو وربحية، من التفكير الاستراتيجي وذكاء السوق والتموضع، إلى اقتصاديات التسويق، إدارة الفرق والعمليات، الحملات المتكاملة، التوسع، الذكاء الاصطناعي، وإدارة السمعة والمخاطر.',
  'https://www.quadralevel.com/images/course-marketing-leadership.jpg',
  39900,
  'EGP',
  null,
  'Kero',
  'draft',
  10,
  'index.html',
  now()
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  thumbnail_url = excluded.thumbnail_url,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  instructor = excluded.instructor,
  trial_minutes = excluded.trial_minutes,
  entry_file = excluded.entry_file,
  updated_at = now();

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, seed.lesson_key, seed.title, seed.position, seed.is_preview
from course_row
cross join (values
  ('ch1', 'القيادة التسويقية والتفكير الاستراتيجي', 1, true),
  ('ch2', 'استراتيجية الأعمال للمسوّق', 2, false),
  ('ch3', 'ذكاء السوق والاستراتيجية التنافسية', 3, false),
  ('ch4', 'Brand Strategy & Market Positioning', 4, false),
  ('ch5', 'علم نفس العميل المتقدم', 5, false),
  ('ch6', 'Marketing Finance & Economics', 6, false),
  ('ch7', 'Marketing Operations & Team Management', 7, false),
  ('ch8', 'Omnichannel Marketing & Integrated Campaigns', 8, false),
  ('ch9', 'Advanced Growth, Scaling & Expansion', 9, false),
  ('ch10', 'Marketing Technology, AI & Automation', 10, false),
  ('ch11', 'Crisis Management, Reputation & Risk', 11, false),
  ('ch12', 'بناء وقيادة منظمة التسويق', 12, false)
) as seed(lesson_key, title, position, is_preview)
on conflict (course_id, lesson_key) do update set
  title = excluded.title,
  position = excluded.position,
  is_preview = excluded.is_preview;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-1', 'اختبار الفصل 1: القيادة التسويقية والتفكير الاستراتيجي', 70, $json$[{"q":"الفرق الأساسي بين Marketing Manager وMarketing Leader:","options":["لا فرق بينهما","Manager يدير الحملات والفريق، Leader يجعل Marketing محركًا لنمو الشركة وربحيتها","Leader ينفذ الإعلانات فقط","Manager أعلى رتبة من Leader دائمًا"],"correctIndex":1},{"q":"مراحل التطور من Marketer إلى Leader هي:","options":["Executor → Specialist → Strategist → Leader","Leader → Strategist → Specialist → Executor","لا يوجد تدرج محدد","Specialist → Leader فقط"],"correctIndex":0},{"q":"عند ارتفاع CAC، رد فعل الـLeader الحقيقي يكون:","options":["تغيير الـCreative فورًا فقط","التساؤل: هل المشكلة في Marketing أصلًا أم في Product-Market Fit أو Pricing؟","تجاهل الأمر","زيادة الميزانية مباشرة"],"correctIndex":1},{"q":"العلاقة الصحيحة بين Strategy وPlan وTactics:","options":["Tactics بدون Strategy = نشاط عشوائي، وStrategy+Execution = اتجاه ونتائج","Tactics أهم من Strategy دائمًا","لا علاقة بينهما","Plan يسبق Strategy دائمًا"],"correctIndex":0},{"q":"Bottleneck Thinking تعني:","options":["تحسين كل شيء في نفس الوقت","إزالة أكبر قيد يحد من نمو النظام كله بدلًا من تحسين كل التفاصيل","تجاهل المشاكل الصغيرة فقط","زيادة الإنفاق الإعلاني دائمًا"],"correctIndex":1},{"q":"Second-Order Thinking يعني:","options":["التفكير في الأثر الأول فقط","التفكير في الآثار المتتابعة للقرار وليس النتيجة المباشرة فقط","تجاهل عواقب القرار","اتخاذ القرار بالحدس فقط"],"correctIndex":1},{"q":"Marketing كاستثمار يعني أن القائد يهتم بفهم:","options":["فقط عدد الإعجابات","Revenue وGross Margin وContribution Margin وCAC وLTV","الشكل الجمالي للإعلان فقط","عدد المتابعين فقط"],"correctIndex":1},{"q":"القرارات القابلة للعكس (Reversible) مقابل غير القابلة للعكس تستلزم:","options":["نفس مستوى الحذر دائمًا","أن تحتاج القرارات الكبرى غير القابلة للعكس إلى بيانات وScenario Planning أكثر","تجاهل الفرق بينهما","اتخاذها بسرعة دائمًا بدون تحليل"],"correctIndex":1},{"q":"Ownership وKPI Ownership الجيدة تعني:","options":["كل KPI مسؤولية الجميع","كل نتيجة مهمة لها Owner واضح يقود التحسين","لا حاجة لتحديد المسؤوليات","المدير فقط يمتلك كل الـKPIs"],"correctIndex":1},{"q":"القاعدة الذهبية للفصل هي:","options":["Observe → Understand → Prioritize → Decide → Align → Execute → Measure → Learn → Adapt","التركيز على تنفيذ المهام فقط","تجنب اتخاذ القرارات الاستراتيجية","الاعتماد فقط على الحدس بدون بيانات"],"correctIndex":0}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-2', 'اختبار الفصل 2: استراتيجية الأعمال للمسوّق', 70, $json$[{"q":"Business Model يختلف عن Business Strategy في أن:","options":["لا فرق بينهما","Model يوضح كيف يعمل البيزنس، والStrategy يوضح كيف يفوز","Strategy أقل أهمية من Model","Model يخص التسويق فقط"],"correctIndex":1},{"q":"لماذا يجب أن يفهم المسوّق الـBusiness؟","options":["لأن Marketing يجب أن يخدم Business Model وليس العكس","لأن التسويق لا علاقة له بالبيزنس","لتجاهل استراتيجية الشركة","لزيادة الميزانية فقط"],"correctIndex":0},{"q":"نموذج الإيرادات (One-Time مقابل Subscription) يؤثر على:","options":["لا شيء في التسويق","تركيز Marketing على مقاييس مختلفة مثل الحاجة لمتابعة Retention وChurn في الاشتراكات","السعر فقط","الشعار والألوان فقط"],"correctIndex":1},{"q":"Payback Period يقيس:","options":["إجمالي الإيرادات","المدة اللازمة لاسترداد تكلفة اكتساب العميل من المساهمة الشهرية","عدد العملاء الكلي","هامش الربح الإجمالي فقط"],"correctIndex":1},{"q":"Efficiency تختلف عن Effectiveness في أن:","options":["لا فرق بينهما","Efficiency تقيس استخدام الموارد، وEffectiveness تقيس تحقيق الهدف الحقيقي مثل عملاء مربحين","Effectiveness تعني دائمًا تكلفة أقل","Efficiency أهم من Effectiveness دائمًا"],"correctIndex":1},{"q":"Strategic Fit يشمل التوافق بين:","options":["السعر فقط","Product وMarket وBrand وFinance وOperations وCustomer Experience معًا","الشعار فقط","عدد الموظفين فقط"],"correctIndex":1},{"q":"استراتيجية Focus في المنافسة تعني:","options":["خدمة كل الشركات بلا تمييز","التركيز على عميل ومشكلة وقيمة محددة بدلًا من استهداف الجميع","خفض الأسعار دائمًا","تجاهل تحديد الجمهور"],"correctIndex":1},{"q":"Market Attractiveness تعتمد على معادلة تشمل:","options":["الحجم فقط","Size × Growth × Profitability × Accessibility ناقص Competition وRisk","عدد المنافسين فقط","لا معادلة محددة"],"correctIndex":1},{"q":"Marketing لا يستطيع إصلاح مشكلة Product-Market Fit لأن:","options":["Marketing قادر دائمًا على حل أي مشكلة","منتج ضعيف مع إعلانات أكثر يؤدي لشكاوى أكثر وسمعة أسوأ","لا علاقة بين المنتج والتسويق","المنتج لا يؤثر على النتائج التسويقية"],"correctIndex":1},{"q":"القاعدة الذهبية للفصل:","options":["Marketing Success = Profitable, Sustainable Business Growth","النجاح يقاس بعدد الإعلانات فقط","الهدف الوحيد هو زيادة المتابعين","لا علاقة بين التسويق والربحية"],"correctIndex":0}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-3', 'اختبار الفصل 3: ذكاء السوق والاستراتيجية التنافسية', 70, $json$[{"q":"الفرق بين Market Analysis وMarket Intelligence:","options":["لا فرق بينهما","Analysis يصف الوضع الحالي، وIntelligence يجيب أيضًا عن لماذا وماذا قد يحدث وماذا يجب أن نفعل","Intelligence أقل تعمقًا من Analysis","Analysis يخص المنافسين فقط"],"correctIndex":1},{"q":"TAM/SAM/SOM تساعد على:","options":["تحديد الشعار المناسب","تقدير حجم السوق الكلي والقابل للخدمة والقابل للوصول الواقعي","حساب سعر المنتج فقط","لا علاقة لها بالسوق"],"correctIndex":1},{"q":"الفرق بين Trend وHype:","options":["لا فرق بينهما","Trend له مؤشرات مستمرة تؤثر في السوق، بينما Hype قد ينتشر ويختفي بسرعة","Hype أهم للاستراتيجية طويلة المدى","كلاهما يجب تجاهله"],"correctIndex":1},{"q":"Customer Behavior أهم من Customer Opinion لأن:","options":["الناس قد يقولون شيئًا ويفعلون شيئًا آخر","الرأي دائمًا أدق من السلوك","لا علاقة بينهما","السلوك غير قابل للقياس"],"correctIndex":0},{"q":"أنواع المنافسة تشمل بالإضافة إلى Direct وIndirect وSubstitutes:","options":["لا يوجد نوع رابع","Status Quo — أي أن العميل يقرر ألا يفعل شيئًا","المنافسة الحكومية فقط","المنافسة الدولية فقط"],"correctIndex":1},{"q":"استراتيجية 'لا تحارب المنافس في نقطة قوته الأكبر' تعني:","options":["يجب دائمًا منافسة الأقوى مباشرة","اختيار Niche أو Positioning مختلف بدلًا من المواجهة المباشرة مع منافس ضخم","تجاهل تحليل المنافسين","خفض الأسعار دائمًا لمجاراة المنافس"],"correctIndex":1},{"q":"Strategic White Space يعني:","options":["منطقة في السوق لا يخدمها أحد بقوة لكن يوجد طلب حقيقي عليها","أي فراغ في السوق بغض النظر عن الطلب","نسخ استراتيجية المنافس","تجاهل الفجوات في السوق"],"correctIndex":0},{"q":"PESTEL يغطي عوامل مثل:","options":["Political, Economic, Social, Technological, Environmental, Legal","فقط العوامل الاقتصادية","فقط العوامل التقنية","لا علاقة له بتحليل البيئة الخارجية"],"correctIndex":0},{"q":"Intelligence Bias مثل Confirmation Bias يعني:","options":["البحث عن بيانات تؤكد رأيك المسبق بدلًا من الحقيقة الموضوعية","الاعتماد الكامل على البيانات الموضوعية دائمًا","لا وجود لتحيزات في تحليل البيانات","تجاهل كل البيانات المتاحة"],"correctIndex":0},{"q":"عند تحرك منافس، الاستجابة الأفضل تعتمد على:","options":["مطابقة كل تحرك للمنافس تلقائيًا","الاستراتيجية والاقتصاديات والعميل، وليس المطابقة التلقائية","تجاهل أي تحرك من المنافس دائمًا","تقليد المنافس فورًا بدون تحليل"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-4', 'اختبار الفصل 4: Brand Strategy & Market Positioning', 70, $json$[{"q":"Brand يختلف عن Logo لأن:","options":["لا فرق بينهما","Logo هو ما نُظهره، بينما Brand هو ما يراه ويدركه العميل فعليًا","Logo أهم من Brand دائمًا","Brand هو مجرد الألوان المستخدمة"],"correctIndex":1},{"q":"Meaningful Differentiation تختلف عن الاختلاف العادي في أنها:","options":["مجرد اختلاف شكلي كاللون","مهمة للعميل، ذات قيمة، وصعبة التقليد","لا تحتاج إثباتًا","دائمًا الأغلى سعرًا"],"correctIndex":1},{"q":"Functional Positioning يركز على:","options":["المشاعر والمكانة فقط","خصائص عملية مثل أسرع وأرخص وأسهل","القيم الشخصية للعميل فقط","لا علاقة له بالمنتج"],"correctIndex":1},{"q":"Brand Promise يجب أن:","options":["يعد بأي شيء يجذب الانتباه","لا يعد بما لا يستطيع المنتج تحقيقه فعليًا","يكون مبالغًا فيه دائمًا لجذب العملاء","لا علاقة له بتجربة العميل"],"correctIndex":1},{"q":"Perception Gap تحدث عندما:","options":["يتطابق الوعد مع التجربة الفعلية","الصورة التي تريدها الشركة عن نفسها تختلف عن الصورة الفعلية لدى العملاء","الشركة ليس لديها براند أصلًا","العملاء يعرفون الشركة جيدًا فقط"],"correctIndex":1},{"q":"Brand Equity الحقيقية تعني:","options":["أن يعرف الناس اسم الشركة فقط بغض النظر عن أي شيء آخر","أن يعرف الناس البراند بشيء محدد يثقون فيه ويفضلونه بسببه","عدد المتابعين فقط","الشعار الجذاب فقط"],"correctIndex":1},{"q":"Mental Availability وDistinctive Brand Assets تساعد على:","options":["ظهور البراند في ذهن العميل عند الحاجة إليه","تقليل الوعي بالبراند","لا علاقة لهما بالتسويق","زيادة تعقيد التواصل مع العميل"],"correctIndex":0},{"q":"Positioning Map يستخدم عادة محورين مثل:","options":["السعر ومستوى التطبيق العملي كمثال","لا يستخدم أي محاور","اسم الشركة فقط","عدد الموظفين فقط"],"correctIndex":0},{"q":"رفع السعر وحده لا يجعل البراند Premium لأن:","options":["السعر هو العامل الوحيد المهم","Premium يحتاج توافق Product وExperience وBranding مع الادعاء وليس السعر فقط","السعر لا علاقة له بالـPositioning إطلاقًا","خفض السعر يجعل البراند Premium دائمًا"],"correctIndex":1},{"q":"Brand is a Business System تعني:","options":["البراند مسؤولية قسم التسويق فقط","البراند يجب أن يظهر في كل نقاط التماس: المنتج والخدمة والتجربة، لا الإعلانات فقط","البراند غير مرتبط بالمنتج","البراند فقط هو الشعار"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-5', 'اختبار الفصل 5: علم نفس العميل المتقدم', 70, $json$[{"q":"الفكرة الأساسية لعلم نفس العميل تقول إن الناس:","options":["يشترون المنتج فقط بغض النظر عن أي شيء","يشترون القيمة المدركة والنتائج التي يحصلون عليها","لا يتأثرون بالمشاعر إطلاقًا","يشترون بناءً على السعر فقط دائمًا"],"correctIndex":1},{"q":"طبقات الـPain Point تتدرج من:","options":["Identity Pain إلى Surface Pain فقط","Surface إلى Functional إلى Emotional إلى Identity Pain","لا يوجد تدرج للألم","كلها نفس المستوى"],"correctIndex":1},{"q":"Loss Aversion تعني أن:","options":["الناس تحب الخسارة أكثر من الكسب","ألم فقدان شيء غالبًا أقوى نفسيًا من متعة الحصول على نفس القيمة","لا علاقة للخسارة بقرار الشراء","المكاسب دائمًا أقوى تأثيرًا من الخسائر"],"correctIndex":1},{"q":"من أنواع Perceived Risk الخمسة:","options":["Financial, Performance, Time, Social, Psychological","فقط النوع المالي","فقط النوع الاجتماعي","لا يوجد تصنيف لأنواع المخاطر المدركة"],"correctIndex":0},{"q":"Fake Scarcity تُعد خطيرة لأنها:","options":["تزيد المبيعات دائمًا بدون أي ضرر","تضر بالثقة وBrand Equity على المدى الطويل عند اكتشافها","لا تؤثر على سمعة الشركة إطلاقًا","مطلوبة في كل استراتيجية تسويقية"],"correctIndex":1},{"q":"Jobs to Be Done يغير السؤال من 'من هو العميل؟' إلى:","options":["ما لون العميل المفضل؟","ما الـJob الذي يحاول العميل إنجازه فعليًا؟","كم عمر العميل؟","أين يسكن العميل؟"],"correctIndex":1},{"q":"Anchoring كتقنية نفسية تعمل من خلال:","options":["عرض سعر مرجعي أعلى يجعل السعر الفعلي يبدو معقولًا","إخفاء السعر تمامًا","تجاهل مقارنة الأسعار","تقديم خيار واحد فقط بدون مرجع"],"correctIndex":0},{"q":"Conversion الفعلي يحتاج معادلة:","options":["الثقة فقط بدون أي عوامل أخرى","Motivation + Ability + Trust + Timing","السعر المنخفض فقط","الإعلان القوي فقط"],"correctIndex":1},{"q":"Ethical Psychology في التسويق تعني تجنب:","options":["استخدام أي تقنيات نفسية إطلاقًا","Fake Scarcity وFake Reviews والوعود غير الحقيقية حتى لو رفعت التحويل قصير المدى","تقديم قيمة مجانية للعملاء","فهم دوافع العميل"],"correctIndex":1},{"q":"Objection Mapping يهدف إلى:","options":["تجاهل اعتراضات العملاء","ربط كل اعتراض ظاهري بسببه الحقيقي وحل مناسب له","الرد على كل اعتراض بنفس الطريقة","خفض السعر عند أي اعتراض"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-6', 'اختبار الفصل 6: Marketing Finance & Economics', 70, $json$[{"q":"Contribution Margin تختلف عن Gross Margin في أنها:","options":["نفس الشيء تمامًا","تأخذ في الاعتبار تكاليف متغيرة إضافية مثل CAC عند تقييم الربحية الفعلية للعميل","لا علاقة لها بالتكاليف","دائمًا أعلى من Gross Margin"],"correctIndex":1},{"q":"Marginal CAC يختلف عن Average CAC في أنه يقيس:","options":["نفس الشيء بالضبط","تكلفة العميل الإضافي الناتج عن زيادة الإنفاق تحديدًا","متوسط تكلفة جميع العملاء منذ البداية","لا علاقة له بزيادة الميزانية"],"correctIndex":1},{"q":"ROAS مرتفع قد يكون مضللًا لأنه:","options":["يعكس الربح الصافي دائمًا بدقة","لا يأخذ في الاعتبار هامش الربح والتكاليف المتغيرة الأخرى","لا علاقة له بالإيرادات إطلاقًا","دائمًا يساوي نسبة الربح الفعلية"],"correctIndex":1},{"q":"Break-Even ROAS يحسب تقريبًا من خلال:","options":["1 ÷ Contribution Margin","Revenue × 2","عدد العملاء الكلي","لا علاقة له بهامش الربح"],"correctIndex":0},{"q":"Payback Period يهمّ القائد لأنه يوضح:","options":["عدد المتابعين على السوشيال ميديا","المدة اللازمة لاسترداد تكلفة اكتساب العميل، وهذا يرتبط بالسيولة","لون الإعلان الأنسب","لا علاقة له بالتدفق النقدي"],"correctIndex":1},{"q":"Incrementality تسأل بشكل أساسي:","options":["كم عدد المشاهدات؟","هل الإعلان تسبب فعلًا في مبيعات إضافية لم تكن ستحدث بدونه؟","ما لون الإعلان الأفضل؟","كم عدد الموظفين في الفريق؟"],"correctIndex":1},{"q":"Diminishing Returns في الإنفاق الإعلاني تعني:","options":["كل زيادة في الميزانية تجلب نفس عدد العملاء دائمًا","كل زيادة في الإنفاق قد تجلب عملاء إضافيين أقل تدريجيًا","زيادة الإنفاق تخفض التكلفة دائمًا","لا علاقة بين الإنفاق وعدد العملاء"],"correctIndex":1},{"q":"Revenue = Customers × Frequency × AOV توضح أن النمو يمكن أن يأتي من:","options":["زيادة عدد العملاء فقط لا غير","عدة روافع مثل عدد العملاء وتكرار الشراء ومتوسط قيمة الطلب معًا","خفض الأسعار فقط","تقليل جودة المنتج"],"correctIndex":1},{"q":"Price Elasticity تدرس تحديدًا:","options":["كيف يتغير الطلب عند تغيير السعر","لون التغليف المناسب","عدد الموظفين المطلوب","لا علاقة لها بسلوك الشراء"],"correctIndex":0},{"q":"الفرق بين Campaign Manager وMarketing Leader في التفكير المالي:","options":["لا فرق بينهما","Campaign Manager يقول 'ROAS ارتفع'، بينما Leader يسأل 'هل Profitability ارتفعت فعلًا؟'","Campaign Manager يهتم بالربحية أكثر من Leader","كلاهما يتجاهل الأرقام المالية"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-7', 'اختبار الفصل 7: Marketing Operations & Team Management', 70, $json$[{"q":"الفرق بين Marketing Strategy وMarketing Operations:","options":["لا فرق بينهما","Strategy تحدد ماذا نريد تحقيقه، وOperations تحدد كيف يعمل الفريق لتحقيقه باستمرار","Operations أهم من Strategy دائمًا","كلاهما يخص التنفيذ اليومي فقط"],"correctIndex":1},{"q":"القاعدة 'Good People ≠ Good System' تعني أن:","options":["الأشخاص الجيدون كافون دائمًا لتحقيق النتائج","فريق جيد قد يفشل بسبب غياب Process أو وضوح المسؤوليات","الأنظمة أهم من الأشخاص تمامًا","لا علاقة بين الأنظمة والأداء"],"correctIndex":1},{"q":"في RACI Framework، يشير حرف A إلى:","options":["Responsible - من ينفذ","Accountable - من يتحمل المسؤولية النهائية عن النتيجة","Consulted - من تتم استشارته","Informed - من يتم إبلاغه فقط"],"correctIndex":1},{"q":"لا يجب محاسبة شخص على KPI معين إذا:","options":["كان يستطيع التحكم في كل مدخلاته","لا يستطيع التحكم في كل العوامل المؤثرة على هذا المؤشر","كان مسؤولًا رسميًا عنه","كان جزءًا من فريقه"],"correctIndex":1},{"q":"SOP (Standard Operating Procedure) يهدف إلى:","options":["جعل النظام يعتمد على ذاكرة شخص واحد","توثيق طريقة تنفيذ عملية متكررة حتى لا يعتمد النظام على شخص بعينه","تعقيد العمليات أكثر","إلغاء الحاجة لأي توثيق"],"correctIndex":1},{"q":"Management by Exception يعني أن القائد يركز على:","options":["مراقبة كل تفصيلة صغيرة يوميًا","الانحرافات الكبيرة عن الهدف بدلًا من التفاصيل الصغيرة","تجاهل كل المشاكل","اتخاذ كل القرارات بنفسه دائمًا"],"correctIndex":1},{"q":"Micromanagement يضر بشكل أساسي بـ:","options":["السرعة والملكية والإبداع والمساءلة","زيادة الإنتاجية دائمًا","لا يوجد أي أثر سلبي له","تحسين الثقة داخل الفريق"],"correctIndex":0},{"q":"قرار Hiring مقابل Training مقابل Outsourcing يعتمد على:","options":["دائمًا التوظيف هو الخيار الأفضل","طبيعة الحاجة: أساسية طويلة الأجل أم قابلة للتطوير أم متخصصة ومؤقتة","لا فرق بين الخيارات الثلاثة","التكلفة فقط بغض النظر عن الحاجة"],"correctIndex":1},{"q":"القاعدة الصحيحة لتبني الأتمتة هي:","options":["أتمتة أي عملية فورًا بغض النظر عن وضوحها","First Standardize → Then Automate","الأتمتة لا تحتاج لعملية واضحة مسبقًا","تجنب الأتمتة نهائيًا"],"correctIndex":1},{"q":"Theory of Constraints في العمليات التسويقية تعني:","options":["تحسين كل خطوة في نفس الوقت","البحث عن الحلقة (Bottleneck) التي تحد قدرة النظام كله والتركيز عليها","زيادة عدد الموظفين دائمًا كحل وحيد","تجاهل نقاط الاختناق"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-8', 'اختبار الفصل 8: Omnichannel Marketing & Integrated Campaigns', 70, $json$[{"q":"Omnichannel يختلف عن Multichannel في أن:","options":["لا فرق بينهما","Omnichannel يخلق تجربة موحدة للعميل عبر كل القنوات بدلًا من قنوات منفصلة","Multichannel أكثر تطورًا من Omnichannel","Omnichannel يعني استخدام قناة واحدة فقط"],"correctIndex":1},{"q":"المشكلة الحقيقية في التسويق متعدد القنوات غالبًا تكون:","options":["قلة عدد القنوات المستخدمة","كل قناة لها هدف مختلف بدون نظام موحد يخدم استراتيجية واحدة","استخدام قناة واحدة فقط","عدم وجود ميزانية كافية"],"correctIndex":1},{"q":"اختيار القناة المناسبة يجب أن يعتمد على:","options":["شعبية القناة فقط","أين يوجد العميل، ماذا يفعل، ونوع الرسالة المناسبة لمرحلته","استخدام نفس القناة لكل الأعمال دائمًا","الأرخص سعرًا فقط بغض النظر عن الملاءمة"],"correctIndex":1},{"q":"Big Idea في الحملة المتكاملة تعمل على:","options":["تفريق الرسائل بين القنوات المختلفة تمامًا","ربط كل المحتوى والقنوات حول فكرة مركزية واحدة","استبدال الحاجة لاستراتيجية واضحة","التركيز على قناة واحدة فقط"],"correctIndex":1},{"q":"Message Consistency لا تعني:","options":["نفس المعنى الاستراتيجي عبر القنوات","تكرار نفس الجملة حرفيًا في كل مكان","التكيف مع طبيعة كل قناة","الحفاظ على جوهر الرسالة"],"correctIndex":1},{"q":"Attribution في البيئة متعددة القنوات يجب ألا يعتمد فقط على:","options":["تحليل شامل لكل نقاط التماس","Last Click فقط","دراسة رحلة العميل الكاملة","نماذج تقديرية متعددة"],"correctIndex":1},{"q":"Incrementality تختلف عن Attribution في أنها تسأل:","options":["أي قناة ظهرت أولًا فقط","هل هذه القناة تسببت فعلًا في نتيجة إضافية حقيقية؟","كم عدد النقرات الكلي","ما لون الإعلان الأنسب"],"correctIndex":1},{"q":"Integrated KPI Structure تتكون من مستويات:","options":["مستوى واحد فقط لكل القنوات","Business KPI ثم Marketing KPI ثم Channel KPI بشكل متسلسل ومترابط","لا علاقة بين مستويات المؤشرات","Channel KPI فقط هو المهم"],"correctIndex":1},{"q":"Channel Cannibalization تحدث عندما:","options":["تخلق القناة عملاء جدد بالكامل","تأخذ إحدى القنوات مبيعات كانت ستحدث من قناة أخرى دون قيمة إضافية حقيقية","تزيد كل القنوات المبيعات الإجمالية بالتساوي","لا علاقة بين القنوات المختلفة"],"correctIndex":1},{"q":"أحد أهم أخطاء الـOmnichannel الشائعة هو:","options":["التركيز على نتائج البزنس الكلية","التركيز على Channel Metrics المعزولة بدلاً من التأثير الفعلي على البزنس","بناء استراتيجية واحدة موحدة","دمج البيانات بين القنوات"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-9', 'اختبار الفصل 9: Advanced Growth, Scaling & Expansion', 70, $json$[{"q":"الفرق بين Growth وScaling:","options":["لا فرق بينهما","Growth يعني النمو بشكل عام، وScaling يعني النمو بمعدل أكبر من نمو الموارد والتكاليف","Scaling أبطأ من Growth دائمًا","Growth يتطلب دائمًا مضاعفة الموظفين"],"correctIndex":1},{"q":"لماذا لا تعني مضاعفة الميزانية مضاعفة عدد العملاء؟","options":["بسبب عوامل مثل Diminishing Returns وAudience Saturation وارتفاع CAC","لأن الميزانية دائمًا تتضاعف مع النتائج بنفس النسبة","لا علاقة بين الميزانية والنتائج إطلاقًا","لأن السوق يتوسع تلقائيًا مع أي زيادة في الإنفاق"],"correctIndex":0},{"q":"Marginal CAC مهم عند اتخاذ قرار التوسع لأنه:","options":["يعادل دائمًا الـAverage CAC","يوضح تكلفة العميل الإضافي الناتج عن زيادة الإنفاق تحديدًا","لا علاقة له بقرار التوسع","يقيس فقط تكلفة العملاء الأوائل"],"correctIndex":1},{"q":"يجب تجنب الـScale قبل التأكد من:","options":["وجود مؤشرات قوية على Product-Market Fit","توفر ميزانية كبيرة فقط","وجود فريق كبير فقط","شهرة العلامة التجارية فقط"],"correctIndex":0},{"q":"Growth Loop يختلف عن الـFunnel التقليدي في أن:","options":["لا فرق بينهما","نتيجة المرحلة الأخيرة تغذي بداية دورة جديدة من النمو بدلاً من الانتهاء","الـLoop لا يشمل عملاء حقيقيين","الـFunnel أقوى من الـLoop دائمًا"],"correctIndex":1},{"q":"North Star Metric لمنصة تعليمية يمكن أن تكون:","options":["عدد زيارات الموقع فقط","Activated Learners الذين بدأوا التعلم فعليًا وحققوا قيمة حقيقية","عدد الإعجابات على السوشيال ميديا","عدد الموظفين في الفريق"],"correctIndex":1},{"q":"Retention تعتبر Growth Lever لأن:","options":["لا علاقة لها بنمو الأعمال","خفض معدل فقدان العملاء يمكن أن ينمي البزنس دون زيادة ضخمة في الاكتساب","زيادة عدد العملاء الجدد فقط هي طريقة النمو الوحيدة","الاحتفاظ بالعملاء لا يؤثر على الإيرادات"],"correctIndex":1},{"q":"قبل دخول سوق جديد، يجب دراسة:","options":["الترجمة اللغوية فقط","Customer وCulture وCompetition وPricing وRegulation والاقتصاديات معًا","لا حاجة لأي دراسة مسبقة","فقط حجم السوق الإجمالي"],"correctIndex":1},{"q":"Beachhead Market تعني:","options":["محاولة السيطرة على السوق بالكامل من البداية","اختيار شريحة صغيرة ذات احتمال نجاح مرتفع للبدء بها ثم التوسع","تجاهل اختبار السوق قبل التوسع الكامل","الدخول لكل الأسواق في نفس الوقت"],"correctIndex":1},{"q":"أفضل استراتيجية نمو هي التي:","options":["تحقق نموًا سريعًا بغض النظر عن الربحية","تنمو وتبني Moat تنافسيًا في نفس الوقت مع الحفاظ على التوازن المالي والتشغيلي","تعتمد فقط على قناة تسويقية واحدة","تتجاهل قدرة العمليات على التوسع"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-10', 'اختبار الفصل 10: Marketing Technology, AI & Automation', 70, $json$[{"q":"MarTech الحقيقي يعني:","options":["شراء أكبر عدد ممكن من الأدوات","استخدام التكنولوجيا لبناء Marketing System أفضل يخدم الاستراتيجية","استبدال الفريق بالكامل بأدوات آلية","لا علاقة له بالبيانات"],"correctIndex":1},{"q":"الترتيب الصحيح لتبني التكنولوجيا هو:","options":["Tool → Tool → Tool بدون استراتيجية","Strategy → Process → Data → Technology → Automation","شراء الأداة أولًا ثم البحث عن استخدام لها","الأتمتة أولًا ثم تحديد المشكلة"],"correctIndex":1},{"q":"أهم قيمة لـAI في التسويق ليست فقط:","options":["توليد المحتوى فقط، بل تحويل Data إلى Insight ثم Decision وAction","تحليل البيانات فقط بدون أي فائدة أخرى","لا فائدة حقيقية لاستخدام AI","استبدال القرار البشري بالكامل"],"correctIndex":0},{"q":"الفرق بين Predictive وPrescriptive AI:","options":["لا فرق بينهما","Predictive يتوقع ماذا قد يحدث، وPrescriptive يقترح ماذا يجب أن نفعل حيال ذلك","Prescriptive أقل تطورًا من Predictive","كلاهما يعني نفس الشيء بالضبط"],"correctIndex":1},{"q":"قاعدة استخدام Automation الصحيحة هي:","options":["أتمتة أي عملية فورًا بغض النظر عن وضوحها","توحيد العملية (Standardize) أولًا ثم أتمتتها","الأتمتة تلغي الحاجة لتوثيق العمليات","لا داعي لمعرفة العملية قبل أتمتتها"],"correctIndex":1},{"q":"Human-in-the-Loop في القرارات عالية المخاطر مثل تغيير الـPositioning يعني:","options":["ترك القرار بالكامل لـAI بدون أي تدخل بشري","ضرورة اتخاذ القرار النهائي من قبل إنسان وليس AI بمفرده","تجاهل مساعدة AI بالكامل","أتمتة القرار تلقائيًا دون مراجعة"],"correctIndex":1},{"q":"Single Customer View تهدف إلى:","options":["التعامل مع كل قناة بيانات بشكل منفصل تمامًا","بناء رؤية موحدة للعميل عبر كل نقاط التماس مثل الموقع والـCRM والبريد","تجاهل ربط البيانات بين المصادر المختلفة","الاحتفاظ ببيانات كل قناة بمعزل عن الأخرى"],"correctIndex":1},{"q":"AI Guardrails تشمل عناصر مثل:","options":["عدم وجود أي قيود على تصرفات AI","حدود الميزانية وقواعد الموافقة والإجراءات المسموحة والممنوعة ومراقبة السجل","منح AI صلاحيات غير محدودة دائمًا","تجاهل مراقبة قرارات AI"],"correctIndex":1},{"q":"قرار Build مقابل Buy يعتمد على:","options":["الشراء هو الخيار الأفضل دائمًا بغض النظر عن الحالة","ما إذا كانت المشكلة استراتيجية وتحتاج تخصيصًا أم أن حلًا جاهزًا يكفي","البناء الداخلي مستحيل دائمًا","لا علاقة بطبيعة المشكلة بهذا القرار"],"correctIndex":1},{"q":"دور Marketing Leader الحقيقي في التكنولوجيا هو:","options":["أن يصبح Tool Manager يدير الأدوات فقط","تصميم النظام الذي يجعل Technology تخدم الاستراتيجية","شراء أكبر عدد من الأدوات المتاحة","تجاهل التكنولوجيا بالكامل"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-11', 'اختبار الفصل 11: Crisis Management, Reputation & Risk', 70, $json$[{"q":"الفرق بين Problem وIncident وCrisis:","options":["كلها نفس الشيء","تتدرج في الخطورة من مشكلة عادية إلى حادث أكبر إلى تهديد حقيقي للسمعة والثقة والإيرادات","لا يوجد فرق في طريقة التعامل معها","Crisis أقل خطورة من Problem"],"correctIndex":1},{"q":"Brand يختلف عن Reputation في أن:","options":["لا فرق بينهما","Brand هو ما تريد أن يعتقده الناس، وReputation هو ما يعتقدونه بالفعل","Reputation أقل أهمية من Brand","كلاهما يعنيان الشعار فقط"],"correctIndex":1},{"q":"أفضل وقت لإدارة الأزمة هو:","options":["بعد انتشارها على نطاق واسع","قبل حدوثها من خلال التخطيط المسبق (Pre-Crisis)","لا يوجد وقت مثالي لذلك","فقط أثناء ذروة الأزمة"],"correctIndex":1},{"q":"قاعدة Risk تقاس عادة من خلال:","options":["Probability × Impact","عدد الموظفين فقط","لون الشعار","حجم الميزانية فقط"],"correctIndex":0},{"q":"عند حدوث أزمة، مبدأ 'Speed ≠ Hurry' يعني:","options":["التسرع بالإجابة حتى لو كانت معلومات غير مؤكدة","الاعتراف بسرعة بالمشكلة، لكن التحقق من الدقة قبل تقديم تفاصيل نهائية","الصمت التام لحين اكتمال كل التفاصيل","لا داعي للاستجابة السريعة إطلاقًا"],"correctIndex":1},{"q":"الاعتذار القوي يجب أن يتضمن:","options":["الاعتراف والمسؤولية والإجراء والوقاية من التكرار","فقط عبارة 'نأسف إذا شعر أحد بالإزعاج'","إنكار المشكلة","لوم العميل على الموضوع"],"correctIndex":0},{"q":"عند حدوث موجة تعليقات سلبية على السوشيال ميديا، الأفضل هو:","options":["حذف كل التعليقات السلبية فورًا","تصنيف التعليقات (شكوى حقيقية، سوء فهم، Troll) والاستجابة المناسبة لكل نوع","تجاهل كل التعليقات نهائيًا","مهاجمة أصحاب التعليقات السلبية"],"correctIndex":1},{"q":"Root Cause Analysis تهدف إلى:","options":["إيجاد شخص يمكن لومه فقط","إصلاح النظام الذي سمح بحدوث المشكلة، وليس فقط معاقبة الفرد","تجاهل أسباب المشكلة الحقيقية","إنهاء التحقيق بمجرد حل الأزمة ظاهريًا"],"correctIndex":1},{"q":"الاعتماد الكبير على قناة اكتساب واحدة (Platform Risk) يعتبر:","options":["استراتيجية آمنة تمامًا دائمًا","مخاطرة حقيقية على مستوى البزنس ككل وليس فقط قرارًا تسويقيًا","لا علاقة له بإدارة المخاطر","أفضل استراتيجية ممكنة بدون استثناء"],"correctIndex":1},{"q":"دور AI في إدارة الأزمات يكون بشكل أساسي في:","options":["اتخاذ القرارات الحساسة بشكل كامل بدون أي إشراف بشري","المساعدة في المراقبة والاكتشاف المبكر وتحليل المشاعر مع ضرورة مراجعة بشرية للرسائل الحساسة","استبدال فريق إدارة الأزمات بالكامل","لا فائدة له في هذا السياق"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-12', 'اختبار الفصل 12: بناء وقيادة منظمة التسويق', 70, $json$[{"q":"Marketing Organization تختلف عن Marketing Team في أنها تشمل:","options":["فقط مجموعة من الأشخاص المنفذين","People + Strategy + Structure + Processes + Technology + Culture + Governance معًا","لا فرق بين المفهومين","الأدوات التقنية فقط"],"correctIndex":1},{"q":"القاعدة الصحيحة لبناء الفريق هي:","options":["توظيف الأشخاص أولًا ثم محاولة إيجاد عمل لهم","تحديد الاستراتيجية والقدرات المطلوبة (Capability) أولًا، ثم تحديد الأدوار والأشخاص","التوظيف بناءً على الوظائف الشائعة فقط بدون تحليل الحاجة","لا علاقة بين الاستراتيجية وبناء الفريق"],"correctIndex":1},{"q":"في RACI، من يتحمل Accountability عن نتيجة معينة يعني:","options":["الشخص الذي ينفذ المهمة فقط دون مسؤولية عن النتيجة","الشخص الذي يتحمل المسؤولية النهائية عن تحقيق النتيجة","الشخص الذي يتم إبلاغه فقط بالنتائج","لا أحد يتحمل المسؤولية النهائية عادة"],"correctIndex":1},{"q":"الفرق بين Marketing Leader وCMO عادة يكمن في:","options":["لا فرق بينهما إطلاقًا","CMO عضو في القيادة التنفيذية ويحتاج فهم Finance وProduct وSales والاستراتيجية الشاملة للشركة","CMO مسؤول فقط عن الإعلانات","Marketing Leader دائمًا أعلى رتبة من CMO"],"correctIndex":1},{"q":"التواصل الفعال مع الإدارة التنفيذية (Executive Communication) يعتمد على إطار:","options":["ذكر الأرقام التقنية فقط مثل CTR وCPC","What happened? → Why? → So What? → Now What؟","تجنب شرح أي تفاصيل للإدارة","التركيز فقط على المصطلحات التسويقية الداخلية"],"correctIndex":1},{"q":"الثقافة التنظيمية الحقيقية تتحدد من خلال:","options":["الشعارات المكتوبة على الحائط فقط","السلوكيات التي يتم تشجيعها ومكافأتها وتكرارها فعليًا داخل المنظمة","عدد ساعات العمل فقط","لا علاقة للثقافة بالسلوك الفعلي للفريق"],"correctIndex":1},{"q":"ربط الحوافز بعدد الـLeads فقط دون جودة قد يؤدي إلى:","options":["نتائج مثالية دائمًا بدون أي مشاكل","الحصول على عدد كبير من الـLeads ذات جودة رديئة","تحسين جودة العملاء تلقائيًا","لا علاقة بين الحوافز وسلوك الفريق"],"correctIndex":1},{"q":"قرار Build مقابل Buy مقابل Partner لكل قدرة (Capability) يعتمد على:","options":["اختيار البناء الداخلي دائمًا بغض النظر عن الحالة","طبيعة القدرة المطلوبة ومدى ارتباطها بالميزة التنافسية والتكلفة والوقت","الشراء هو الخيار الوحيد المتاح دائمًا","لا فرق بين الخيارات الثلاثة في أي حالة"],"correctIndex":1},{"q":"القاعدة الخاصة بالتوثيق التنظيمي تقول إن:","options":["الاعتماد على ذاكرة الأشخاص فقط هو الأفضل دائمًا","المعرفة التي توجد فقط في ذهن شخص واحد تمثل مخاطرة تنظيمية حقيقية","لا حاجة لتوثيق أي عمليات أو قرارات","التوثيق يبطئ العمل بدون أي فائدة"],"correctIndex":1},{"q":"الفرق الجوهري النهائي بين Marketer وMarketing Leader هو أن الأخير:","options":["ينفذ المهام اليومية فقط بشكل أفضل","يبني Strategy وPeople وSystems وCulture وEconomics وTechnology معًا كنظام متكامل","لا يهتم بنتائج الأعمال إطلاقًا","يركز فقط على الإعلانات المدفوعة"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-leadership'
)
insert into projects (course_id, project_key, title, instructions, passing_score)
select course_row.id, 'marketing-leadership-capstone', 'مشروع التخرج: خطة قيادة وتحول تسويقي خلال 90 يومًا', 'أنت مدير التسويق الجديد في شركة مصرية متوسطة تبيع منتجاتها عبر المتجر الإلكتروني والفروع. خلال آخر ستة أشهر زادت تكلفة اكتساب العميل، تباطأ النمو، اختلفت رسائل العلامة التجارية بين القنوات، وأصبح فريق التسويق يعمل في جزر منفصلة دون ملكية واضحة للنتائج. الإدارة تريد خطة تحول قابلة للتنفيذ خلال 90 يومًا قبل التوسع في سوق جديد.

المطلوب إعداد وثيقة قيادة تسويقية متكاملة تتضمن:
1. تشخيص المشكلة على مستوى الأعمال والتسويق، مع تحديد أهم Bottleneck وثلاثة افتراضات يجب اختبارها.
2. تحليل السوق والعملاء والمنافسة، مع TAM/SAM/SOM أو تقدير منطقي للسوق وWhite Space قابل للدفاع.
3. Positioning ووعد علامة تجارية ورسائل أساسية مرتبطة باحتياج العميل وليست شعارات عامة.
4. نموذج مالي مبسط يوضح Revenue Drivers وCAC وLTV وContribution Margin وBreak-even ROAS وافتراضاتك.
5. تصميم فريق وتشغيل يشمل الأدوار وRACI وKPI Ownership واجتماعات المتابعة والـSOPs الأساسية.
6. خطة Omnichannel واختبارات نمو مرتبة بالأولوية، مع تعريف North Star Metric ومؤشرات Leading وLagging.
7. خطة استخدام MarTech وAI والأتمتة مع Human-in-the-Loop وحدود صلاحيات ومخاطر واضحة.
8. سجل مخاطر وأزمات، وخطة 30/60/90 يومًا، وقرارات واضحة: ما الذي ستوقفه، تبدأه، وتستمر فيه.

يجب أن تكون الإجابة عملية ومترابطة، وأن تذكر افتراضاتها بوضوح. لا يكفي تجميع تعريفات أو كتابة خطة عامة غير مرتبطة بالسيناريو.

Rubric التقييم (100 نقطة):
- التشخيص الاستراتيجي وتحديد الـBottleneck: 15 نقطة.
- ذكاء السوق والمنافسة واختيار الفرصة: 10 نقاط.
- فهم العميل والتموضع ووعد البراند: 15 نقطة.
- الاقتصاديات والميزانية ومنطق الربحية: 15 نقطة.
- هيكل الفريق والعمليات والملكية والحوكمة: 15 نقطة.
- Omnichannel والنمو والتوسع والقياس: 15 نقطة.
- MarTech وAI والمخاطر والأزمات: 10 نقاط.
- وضوح خطة 30/60/90 وترابط القرارات وقابليتها للتنفيذ: 5 نقاط.
درجة النجاح: 70 من 100.', 70
from course_row
on conflict (course_id, project_key) do update set
  title = excluded.title,
  instructions = excluded.instructions,
  passing_score = excluded.passing_score;

commit;

-- Verification: expected results are 12 lessons, 12 quizzes, 1 project, price 39900, trial 10, status draft.
select id, slug, title, price_cents, currency, instructor, status, trial_minutes, entry_file, thumbnail_url from courses where slug = 'marketing-leadership';
select count(*) as lesson_count, count(*) filter (where is_preview) as preview_lesson_count from lessons where course_id = (select id from courses where slug = 'marketing-leadership');
select count(*) as quiz_count, min(passing_score) as min_passing_score, max(passing_score) as max_passing_score from quizzes where course_id = (select id from courses where slug = 'marketing-leadership');
select count(*) as project_count, min(passing_score) as passing_score from projects where course_id = (select id from courses where slug = 'marketing-leadership');
