-- Marketing Growth updated ZIP: 12 lessons and 12 quizzes. Safe to rerun.
-- Updates only lessons and quizzes. Graduation project remains unchanged.
begin;

-- Remove duplicate chapter-one aliases left by older uploads. The application uses ch1.
with course_row as (select id from courses where slug = 'marketing-growth')
delete from lessons
using course_row
where lessons.course_id = course_row.id
  and lessons.lesson_key in ('index', 'index.html');

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch1', 'البحث التسويقي', 1, true
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-1', 'اختبار الفصل 1: البحث التسويقي', 70, $json$[{"q":"ما الهدف الأساسي من Marketing Research؟","options":["زيادة عدد المنشورات","جمع معلومات بلا هدف","مساعدة الشركة على اتخاذ قرارات أفضل","زيادة الميزانية"],"correctIndex":2},{"q":"ما المقصود بـ Primary Research؟","options":["استخدام تقرير منشور","جمع البيانات مباشرة من المصدر","قراءة إعلان منافس","مشاهدة فيديو"],"correctIndex":1},{"q":"أي نوع من البحث يهتم أكثر بسؤال \"لماذا؟\"","options":["Quantitative Research","Qualitative Research","Paid Research","Digital Research"],"correctIndex":1},{"q":"ماذا تعني Marketing Insight؟","options":["رقم خام","إعلان","استنتاج مهم يمكن استخدامه لاتخاذ قرار","شعار"],"correctIndex":2},{"q":"ما المقصود بـ Voice of Customer؟","options":["صوت الشركة","كلمات وآراء العملاء التي تعبر عن احتياجاتهم ومشكلاتهم","اسم المنتج","الإعلان"],"correctIndex":1},{"q":"ماذا تعني Market Gap؟","options":["زيادة المنافسين","فجوة أو احتياج غير مخدوم جيدًا في السوق","انخفاض السعر","زيادة الإعلانات"],"correctIndex":1},{"q":"ما أول خطوة جيدة قبل بدء البحث؟","options":["إطلاق الإعلان","تحديد السؤال أو المشكلة التي نريد فهمها","زيادة الميزانية","تغيير الشعار"],"correctIndex":1},{"q":"إذا وجدت أن 40% من العملاء يقولون إن السعر مرتفع، فهذا يعتبر:","options":["Data","Brand","CTA","Funnel"],"correctIndex":0},{"q":"إذا اكتشفت أن العملاء يرون السعر مرتفعًا لأن قيمة المنتج غير واضحة، فهذا يعتبر:","options":["Impression","Insight","Reach","Click"],"correctIndex":1},{"q":"ما التسلسل الصحيح؟","options":["Action → Question → Data → Research","Research → Action → Question → Insight","Question → Research → Data → Analysis → Insight → Action","Data → Advertisement → Research"],"correctIndex":2}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch2', 'التحليل المتقدم للعميل', 2, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-2', 'اختبار الفصل 2: التحليل المتقدم للعميل', 70, $json$[{"q":"ما الهدف الأساسي من Customer Analysis؟","options":["معرفة أسماء العملاء فقط","فهم احتياجات وسلوك ودوافع العملاء لاتخاذ قرارات أفضل","زيادة عدد المنشورات","تغيير الشعار"],"correctIndex":1},{"q":"ماذا يعني Customer Segmentation؟","options":["حذف العملاء","تقسيم العملاء إلى مجموعات متشابهة","زيادة السعر","إطلاق حملة"],"correctIndex":1},{"q":"ما المقصود بـ Pain Point؟","options":["ميزة المنتج","مشكلة أو معاناة يريد العميل التخلص منها","سعر المنتج","اسم الشركة"],"correctIndex":1},{"q":"ماذا يعني Buying Trigger؟","options":["سبب أو حدث يجعل العميل أكثر استعدادًا للشراء","اسم الإعلان","تصميم المنتج","عدد المتابعين"],"correctIndex":0},{"q":"أي من التالي يمثل Customer Behavior؟","options":["عمر العميل فقط","الدولة فقط","المنتجات التي يشتريها وتكرار الشراء والتفاعل","اسم الشركة"],"correctIndex":2},{"q":"ماذا يقيس RFM؟","options":["Reach وFrequency وMarketing","Recency وFrequency وMonetary","Revenue وFunnel وMarket","Research وFacebook وMedia"],"correctIndex":1},{"q":"أي عميل يمثل فرصة واضحة للاحتفاظ والبيع الإضافي؟","options":["شخص لم يسمع عن العلامة","شخص شاهد إعلانًا مرة","عميل يشتري باستمرار","شخص لا يعرف المنتج"],"correctIndex":2},{"q":"ماذا يعني Customer Friction؟","options":["ميزة إضافية","شيء يجعل إكمال رحلة العميل أكثر صعوبة","نوع من الإعلانات","طريقة لتحديد السعر"],"correctIndex":1},{"q":"النمو يمكن أن يأتي من:","options":["اكتساب العملاء فقط","زيادة المتابعين فقط","اكتساب العملاء والتحويل والاحتفاظ وزيادة قيمة العميل","زيادة المنشورات فقط"],"correctIndex":2},{"q":"ما أفضل تسلسل لتحليل العميل بهدف النمو؟","options":["إعلان → بيع → تحليل","Segment → Understand → Analyze → Identify → Act → Measure","Price → Logo → Post","Content → Logo → Website"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch3', 'تحليل المنافسين', 3, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-3', 'اختبار الفصل 3: تحليل المنافسين', 70, $json$[{"q":"ما الهدف الأساسي من Competitive Analysis؟","options":["تقليد المنافسين","فهم المنافسة واكتشاف فرص النمو","خفض السعر","زيادة عدد المنشورات"],"correctIndex":1},{"q":"من هو Direct Competitor؟","options":["شركة تستهدف جمهورًا مختلفًا تمامًا","منتج مجاني","منافس يقدم حلًا مشابهًا لنفس الجمهور","أي شركة في العالم"],"correctIndex":2},{"q":"ما المقصود بـ Substitute؟","options":["موظف جديد","بديل يمكن للعميل استخدامه لحل المشكلة","إعلان","خصم"],"correctIndex":1},{"q":"لماذا يجب تحليل Reviews؟","options":["لمعرفة تصميم المنافس فقط","لمعرفة آراء وتجارب العملاء الحقيقية","لمعرفة عدد الموظفين","لمعرفة اسم الشركة"],"correctIndex":1},{"q":"ماذا يعني Voice of Customer؟","options":["صوت الشركة","كلمات وآراء العملاء حول احتياجاتهم وتجاربهم","صوت الإعلان","صوت المنافس"],"correctIndex":1},{"q":"ماذا يقيس SWOT؟","options":["السعر فقط","نقاط القوة والضعف والفرص والتهديدات","عدد العملاء","عدد الإعلانات"],"correctIndex":1},{"q":"ما الهدف من Competitive Mapping؟","options":["تصميم الموقع","فهم مواقع المنافسين مقارنة بعوامل مهمة في السوق","حساب الأرباح","كتابة المحتوى"],"correctIndex":1},{"q":"ما المقصود بـ Differentiation؟","options":["نسخ المنافس","تقديم اختلاف له قيمة بالنسبة للعميل","خفض السعر دائمًا","زيادة الإعلانات"],"correctIndex":1},{"q":"ماذا يجب أن تفعل بعد اكتشاف فجوة في السوق؟","options":["تجاهلها","تحديد ما إذا كانت فرصة حقيقية ثم بناء تمايز مناسب","تقليد المنافس","رفع السعر مباشرة"],"correctIndex":1},{"q":"ما الخطأ الأكبر في تحليل المنافسين؟","options":["دراسة أكثر من منافس","قراءة تقييمات العملاء","جمع البيانات دون تحويلها إلى قرارات وإجراءات","مقارنة العروض"],"correctIndex":2}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch4', 'التموضع التسويقي', 4, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-4', 'اختبار الفصل 4: التموضع التسويقي', 70, $json$[{"q":"ما المقصود بـ Marketing Positioning؟","options":["تصميم الشعار","تحديد المكان الذي تريد العلامة احتلاله في ذهن العميل","تحديد الميزانية","كتابة المنشورات"],"correctIndex":1},{"q":"أين يحدث التموضع بشكل أساسي؟","options":["في عقل العميل","في المخزن","في الميزانية","في الحسابات"],"correctIndex":0},{"q":"ما المقصود بـ Differentiation؟","options":["تقليد المنافس","تقديم اختلاف له قيمة للعميل","خفض السعر دائمًا","زيادة عدد الإعلانات"],"correctIndex":1},{"q":"ما الفرق بين Differentiation وCompetitive Advantage؟","options":["لا يوجد فرق","التمايز اختلاف، والميزة التنافسية اختلاف يمكن أن يمنحك قوة حقيقية في المنافسة","الميزة التنافسية تعني السعر فقط","التمايز يعني الإعلان"],"correctIndex":1},{"q":"ما المقصود بـ Market Gap؟","options":["زيادة المنافسين","احتياج أو مشكلة لا يتم تلبيتها بشكل جيد","زيادة الأسعار","انخفاض المبيعات فقط"],"correctIndex":1},{"q":"ما الهدف من Perceptual Map؟","options":["حساب الأرباح","تصور مواقع العلامات التجارية وفق عوامل مهمة للعميل","تصميم الشعار","كتابة المحتوى"],"correctIndex":1},{"q":"أي جملة تمثل تموضعًا أكثر وضوحًا؟","options":["نحن الأفضل في كل شيء","نحن شركة ممتازة","نقدم تجربة تعليمية مبسطة وعملية للمبتدئين","نقدم منتجات عالية الجودة"],"correctIndex":2},{"q":"هل Positioning هو نفسه Brand Identity؟","options":["نعم","لا","دائمًا","في الشركات الكبيرة فقط"],"correctIndex":1},{"q":"ماذا يحتاج التموضع القوي؟","options":["اختلافًا فقط","اختلافًا مهمًا للعميل وقابلًا للتصديق","شعارًا جديدًا","سعرًا منخفضًا دائمًا"],"correctIndex":1},{"q":"ما أفضل نقطة بداية لبناء Positioning؟","options":["تقليد المنافس","اختيار لون العلامة","فهم السوق والعميل والمنافسين","خفض السعر"],"correctIndex":2}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch5', 'استراتيجية العرض', 5, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-5', 'اختبار الفصل 5: استراتيجية العرض', 70, $json$[{"q":"ما المقصود بـ Offer Strategy؟","options":["استراتيجية تصميم الشعار","استراتيجية تصميم وتقديم العرض للعميل","استراتيجية إدارة الموظفين","استراتيجية المحاسبة"],"correctIndex":1},{"q":"ما الفرق بين Product وOffer؟","options":["لا يوجد فرق","المنتج هو ما نبيعه، والعرض هو الطريقة الكاملة التي نقدم بها القيمة للعميل","العرض هو المنتج فقط","المنتج هو الإعلان"],"correctIndex":1},{"q":"ما الفرق بين Feature وOutcome؟","options":["لا يوجد فرق","Feature هي النتيجة وOutcome هو السعر","Feature هي ما يحتويه المنتج، وOutcome هي النتيجة التي يريد العميل الوصول إليها","كلاهما يعني الإعلان"],"correctIndex":2},{"q":"ما المقصود بـ Perceived Value؟","options":["تكلفة إنتاج المنتج","القيمة التي يدرك العميل أنه سيحصل عليها","سعر المنافس","تكلفة الإعلان"],"correctIndex":1},{"q":"ما الهدف من الـ Bonus؟","options":["زيادة عدد العناصر فقط","إضافة قيمة حقيقية مرتبطة بالنتيجة التي يريدها العميل","رفع السعر دائمًا","إخفاء عيوب المنتج"],"correctIndex":1},{"q":"لماذا نستخدم Free Trial؟","options":["لتقليل قيمة المنتج","لتقليل تردد العميل وإعطائه فرصة لتجربة القيمة","لإلغاء المنتج","لمنع المبيعات"],"correctIndex":1},{"q":"إذا قال العميل \"السعر مرتفع\"، فما أول شيء يجب التفكير فيه؟","options":["تخفيض السعر فورًا","إغلاق المنتج","معرفة لماذا يرى العميل أن السعر لا يتناسب مع القيمة","تجاهل العميل"],"correctIndex":2},{"q":"ما المقصود بـ Offer-Market Fit؟","options":["توافق الشعار مع الموقع","توافق العرض مع احتياجات ورغبات وقدرة السوق المستهدف","توافق الموظفين","توافق الإعلان مع التصميم"],"correctIndex":1},{"q":"ما أفضل وصف للعرض القوي؟","options":["يحتوي على أكبر عدد من المميزات","أرخص عرض في السوق","واضح ويقدم قيمة حقيقية ومناسب لاحتياج العميل","يحتوي على أكبر عدد من الخصومات"],"correctIndex":2},{"q":"ما الخطوة الأخيرة في بناء العرض؟","options":["افتراض أنه مثالي","اختباره وتحليل نتائجه وتحسينه","نسخه من المنافس","رفع السعر دائمًا"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch6', 'القمع التسويقي', 6, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-6', 'اختبار الفصل 6: القمع التسويقي', 70, $json$[{"q":"ما المقصود بـ Marketing Funnel؟","options":["تصميم الموقع","المسار الذي ينتقل خلاله العميل من التعرف على العلامة التجارية حتى الشراء وما بعده","طريقة تسعير المنتج","نوع من الإعلانات"],"correctIndex":1},{"q":"لماذا يسمى Funnel؟","options":["لأنه يستخدم في تصميم المواقع","لأن عدد الأشخاص غالبًا يقل كلما تقدموا في المراحل","لأنه يستخدم للإعلانات فقط","لأنه يركز على المنتجات"],"correctIndex":1},{"q":"ما الهدف الأساسي من مرحلة Awareness؟","options":["إتمام الدفع","جذب الانتباه وبناء الوعي","الاحتفاظ بالعميل","طلب التقييم"],"correctIndex":1},{"q":"من هو الـ Lead؟","options":["أي شخص شاهد إعلانًا","شخص أظهر اهتمامًا وأصبح عميلًا محتملًا يمكن متابعته","عميل اشترى بالفعل","منافس"],"correctIndex":1},{"q":"ما وظيفة Lead Magnet؟","options":["رفع سعر المنتج","جذب العملاء المحتملين من خلال تقديم قيمة مقابل وسيلة تواصل مناسبة","حذف العملاء","زيادة تكلفة الإعلان"],"correctIndex":1},{"q":"ما المقصود بـ Landing Page؟","options":["صفحة مصممة لتحقيق هدف تسويقي محدد","صفحة الموظفين","الصفحة الرئيسية فقط","صفحة التواصل فقط"],"correctIndex":0},{"q":"شخص شاهد إعلانًا وزار الموقع لكنه لم يشترِ. ما الإجراء المناسب غالبًا؟","options":["تجاهله دائمًا","اعتباره عميلًا نهائيًا","إمكانية استخدام إعادة الاستهداف برسالة مناسبة لمرحلته","إرسال نفس الإعلان عشوائيًا"],"correctIndex":2},{"q":"ما الفرق بين الجمهور البارد والساخن؟","options":["البارد لديه نية شراء أعلى","الساخن لديه اهتمام أو نية شراء أعلى من البارد","لا يوجد فرق","البارد اشترى بالفعل"],"correctIndex":1},{"q":"إذا كان هناك تسرب كبير بين زيارة صفحة المنتج والشراء، فما التصرف الصحيح؟","options":["تغيير كل شيء فورًا","تحليل المرحلة واختبار أسباب محتملة للتسرب","إيقاف التسويق بالكامل","زيادة السعر"],"correctIndex":1},{"q":"هل ينتهي القمع عند الشراء؟","options":["نعم","لا، توجد مراحل مثل الاحتفاظ والتوصية","فقط في الشركات الكبيرة","فقط في التجارة الإلكترونية"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch7', 'توليد العملاء المحتملين', 7, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-7', 'اختبار الفصل 7: توليد العملاء المحتملين', 70, $json$[{"q":"ما المقصود بـ Lead Generation؟","options":["تصميم الإعلانات فقط","جذب الأشخاص المناسبين وتحويل اهتمامهم إلى عملاء محتملين","خدمة العملاء","تسعير المنتجات"],"correctIndex":1},{"q":"ما الفرق بين Visitor وLead؟","options":["لا يوجد فرق","Visitor هو زائر، بينما Lead أظهر اهتمامًا يمكن متابعته","Lead هو شخص اشترى","Visitor هو عميل دائم"],"correctIndex":1},{"q":"ما الهدف من Lead Magnet؟","options":["بيع المنتج مباشرة دائمًا","تقديم قيمة لجذب العملاء المحتملين المناسبين","زيادة السعر","تقليل عدد الزوار"],"correctIndex":1},{"q":"أي من التالي يعتبر Lead Magnet مناسبًا لشركة تقدم خدمات إعلانية؟","options":["وصفة طبخ","دليل لفحص الحملات الإعلانية","قصة أدبية","صورة عشوائية"],"correctIndex":1},{"q":"ما المقصود بـ Lead Qualification؟","options":["حذف العملاء","تقييم مدى ملاءمة العميل المحتمل واحتمالية تحوله إلى عميل","زيادة عدد المتابعين","تصميم صفحة"],"correctIndex":1},{"q":"ماذا يقيس CPL؟","options":["تكلفة المنتج","تكلفة الحصول على عميل محتمل","قيمة العميل","معدل المبيعات"],"correctIndex":1},{"q":"أنفقت 1,000 جنيه وحصلت على 200 Lead. ما قيمة CPL؟","options":["2 جنيه","5 جنيه","10 جنيه","20 جنيه"],"correctIndex":1},{"q":"لماذا لا يكفي أن يكون CPL منخفضًا؟","options":["لأن عدد الـ Leads لا يهم","لأن جودة الـ Leads وقدرتهم على التحول إلى عملاء أهم من السعر وحده","لأن الإعلانات مجانية","لأن العملاء لا يشترون"],"correctIndex":1},{"q":"ما المقصود بـ Lead Nurturing؟","options":["حذف الـ Leads","بناء علاقة وتطوير اهتمام العميل المحتمل حتى يصبح أكثر استعدادًا للشراء","رفع سعر المنتج","إيقاف الإعلانات"],"correctIndex":1},{"q":"ما التسلسل الأقرب لنظام Lead Generation؟","options":["Lead → Audience → Product","Traffic → Lead Magnet → Landing Page → Lead → Nurturing → Offer → Customer","Product → Customer → Lead","إعلان → حذف → بيع"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch8', 'تحسين التحويل', 8, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-8', 'اختبار الفصل 8: تحسين التحويل', 70, $json$[{"q":"ما المقصود بتحسين التحويل؟","options":["زيادة عدد الإعلانات فقط","زيادة نسبة الأشخاص الذين يقومون بالإجراء المطلوب","تقليل عدد العملاء","تغيير شعار الشركة"],"correctIndex":1},{"q":"هل التحويل يعني دائمًا الشراء؟","options":["نعم","لا"],"correctIndex":1},{"q":"ما الهدف الأساسي من صفحة الهبوط؟","options":["وضع أكبر عدد ممكن من المعلومات","تحقيق هدف تسويقي محدد","عرض جميع منتجات الشركة","زيادة عدد الروابط"],"correctIndex":1},{"q":"ما هو CTA؟","options":["تحليل المنافسين","الدعوة لاتخاذ إجراء","تكلفة الإعلان","دراسة السوق"],"correctIndex":1},{"q":"ماذا يعني A/B Testing؟","options":["اختبار منتجين في شركتين","مقارنة نسختين لمعرفة أيهما أفضل أداءً","تحليل المنافسين","زيادة الميزانية"],"correctIndex":1},{"q":"ماذا يعني الاحتكاك (Friction)؟","options":["القيمة","الصعوبة غير الضرورية التي تعيق تنفيذ الإجراء","الأرباح","عدد العملاء"],"correctIndex":1},{"q":"هل تخفيض السعر هو الحل دائمًا عندما تكون المبيعات ضعيفة؟","options":["نعم","لا"],"correctIndex":1},{"q":"ما الأفضل عند إجراء اختبار؟","options":["تغيير كل شيء","وجود فرضية واضحة","الاعتماد على الرأي الشخصي","تجاهل البيانات"],"correctIndex":1},{"q":"ما المقصود بـ Social Proof؟","options":["إعلان مدفوع","تجارب وآراء الآخرين التي تساعد على بناء الثقة","سعر المنتج","تصميم الموقع"],"correctIndex":1},{"q":"ما أول خطوة في عملية التحسين؟","options":["التخمين","القياس وفهم الوضع الحالي","تغيير السعر","تغيير الشعار"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch9', 'التسويق المدفوع', 9, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-9', 'اختبار الفصل 9: التسويق المدفوع', 70, $json$[{"q":"ما المقصود بالتسويق المدفوع؟","options":["نشر المحتوى مجانًا","استخدام ميزانية للوصول إلى الجمهور وتحقيق هدف تسويقي","تحسين الموقع فقط","خدمة العملاء"],"correctIndex":1},{"q":"هل الإعلان وحده يضمن المبيعات؟","options":["نعم","لا"],"correctIndex":1},{"q":"ماذا يعني CTR؟","options":["تكلفة العميل","نسبة النقر إلى الظهور","الإيرادات","الربح"],"correctIndex":1},{"q":"ماذا يقيس ROAS؟","options":["عدد المتابعين","العائد على الإنفاق الإعلاني","سرعة الموقع","عدد التعليقات"],"correctIndex":1},{"q":"إذا أنفقت 1,000 جنيه وحققت 4,000 جنيه إيرادات من الإعلانات، فما ROAS؟","options":["2x","3x","4x","5x"],"correctIndex":2},{"q":"ماذا يعني Retargeting؟","options":["حذف الجمهور","إعادة استهداف الأشخاص الذين تفاعلوا سابقًا","تغيير المنتج","إيقاف الإعلان"],"correctIndex":1},{"q":"هل ROAS يساوي الربح؟","options":["نعم","لا"],"correctIndex":1},{"q":"ماذا يجب أن تفعل قبل زيادة الميزانية بشكل كبير؟","options":["التوسع فورًا","التأكد من أن النظام يحقق نتائج جيدة وقابلة للتكرار","تغيير المنتج","حذف الصفحة"],"correctIndex":1},{"q":"إذا كان الإعلان يحصل على نقرات كثيرة لكن الصفحة لا تحقق تحويلات، فأين يجب أن تبحث أولًا؟","options":["صفحة الهبوط والعرض","عدد المتابعين","شعار الشركة","اسم الشركة"],"correctIndex":0},{"q":"ما أفضل طريقة للتعامل مع اختبار إعلاني؟","options":["تغيير كل شيء مرة واحدة","وضع فرضية واختبارها وقياس النتيجة","الاعتماد على الإحساس","زيادة الميزانية فقط"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch10', 'الأتمتة التسويقية', 10, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-10', 'اختبار الفصل 10: الأتمتة التسويقية', 70, $json$[{"q":"ما المقصود بالأتمتة التسويقية؟","options":["إلغاء التسويق","استخدام الأنظمة لتنفيذ عمليات تسويقية تلقائيًا","نشر الإعلانات فقط","تصميم الشعارات"],"correctIndex":1},{"q":"ما هو Trigger؟","options":["النتيجة النهائية","الحدث الذي يبدأ الأتمتة","العميل","الإعلان"],"correctIndex":1},{"q":"ما هو Workflow؟","options":["إعلان","مجموعة خطوات آلية مترابطة","شعار","منتج"],"correctIndex":1},{"q":"ما الهدف من Lead Nurturing؟","options":["حذف العملاء","بناء علاقة مع العميل المحتمل ودفعه تدريجيًا نحو القرار","زيادة عدد المتابعين فقط","تغيير السعر"],"correctIndex":1},{"q":"ماذا يعني Segmentation؟","options":["تقسيم العملاء إلى مجموعات مناسبة","حذف العملاء","رفع السعر","إنشاء إعلان"],"correctIndex":0},{"q":"ماذا يجب أن يحدث بعد شراء العميل إذا كان يتلقى رسائل بيع للمنتج نفسه؟","options":["تستمر الرسائل بلا تغيير","يجب أن تتغير رحلته أو يتوقف Workflow الخاص بالبيع","نرسل رسائل أكثر","نحذف بياناته"],"correctIndex":1},{"q":"ما المقصود بـ Personalization؟","options":["إرسال نفس الرسالة للجميع","تخصيص الرسالة وفق بيانات أو سلوك العميل","زيادة الميزانية","تغيير الشعار"],"correctIndex":1},{"q":"ما المقصود بـ Reactivation؟","options":["جذب عميل جديد","إعادة تنشيط عميل غير نشط","حذف Lead","رفع السعر"],"correctIndex":1},{"q":"هل الأتمتة تعني أن الإنسان لم يعد مهمًا؟","options":["نعم","لا"],"correctIndex":1},{"q":"ما الترتيب الأفضل لبناء الأتمتة؟","options":["اختيار الأداة أولًا ثم التفكير","فهم رحلة العميل ثم تصميم Workflow ثم اختيار الأدوات","شراء أكبر أداة","إرسال أكبر عدد من الرسائل"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch11', 'الاحتفاظ بالعملاء والنمو', 11, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-11', 'اختبار الفصل 11: الاحتفاظ بالعملاء والنمو', 70, $json$[{"q":"ما المقصود بـ Customer Retention؟","options":["جذب عملاء جدد فقط","الحفاظ على العملاء واستمرار العلاقة معهم","زيادة الإعلانات","تغيير المنتج"],"correctIndex":1},{"q":"هل البيع يعني انتهاء العلاقة مع العميل؟","options":["نعم","لا"],"correctIndex":1},{"q":"ما المقصود بـ Churn؟","options":["معدل اكتساب العملاء","معدل فقدان العملاء","معدل النقر","متوسط الطلب"],"correctIndex":1},{"q":"ما المقصود بـ LTV؟","options":["تكلفة الإعلان","قيمة العميل طوال فترة العلاقة","عدد العملاء","معدل التحويل"],"correctIndex":1},{"q":"ما الفرق الأساسي بين Upsell وCross-sell؟","options":["لا يوجد فرق","Upsell يقدم خيارًا أعلى قيمة، وCross-sell يقدم منتجًا مكملًا","كلاهما إعلانات","كلاهما خصومات"],"correctIndex":1},{"q":"ما هو Onboarding؟","options":["جذب العميل","تهيئة العميل ومساعدته على بدء استخدام المنتج وتحقيق القيمة","إعلان جديد","تحليل المنافسين"],"correctIndex":1},{"q":"هل رضا العميل يساوي دائمًا الولاء؟","options":["نعم","لا"],"correctIndex":1},{"q":"ما هو Referral Marketing؟","options":["التسويق عبر العملاء الذين يوصون بالمنتج للآخرين","التسويق عبر محركات البحث","التسويق بالبريد فقط","الإعلان المدفوع"],"correctIndex":0},{"q":"كيف يمكن زيادة قيمة العميل؟","options":["Repeat Purchase فقط","Upsell فقط","Cross-sell فقط","يمكن استخدام مجموعة من هذه الأساليب حسب طبيعة النشاط"],"correctIndex":3},{"q":"ما الأساس الحقيقي للاحتفاظ بالعملاء؟","options":["إرسال أكبر عدد من الرسائل","تقديم قيمة وتجربة جيدة باستمرار","الخصومات فقط","الإعلانات فقط"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, 'ch12', 'النظام التسويقي المتكامل', 12, false
from course_row
on conflict (course_id, lesson_key) do update set title = excluded.title, position = excluded.position, is_preview = excluded.is_preview;

with course_row as (select id from courses where slug = 'marketing-growth')
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-12', 'اختبار الفصل 12: النظام التسويقي المتكامل', 70, $json$[{"q":"ما المقصود بالنظام التسويقي؟","options":["الإعلان فقط","مجموعة عمليات مترابطة تعمل لتحقيق أهداف تسويقية ونمو مستمر","المحتوى فقط","المبيعات فقط"],"correctIndex":1},{"q":"ما الفرق الأساسي بين الحملة والنظام؟","options":["لا يوجد فرق","الحملة أكبر من النظام","الحملة جزء من النظام","النظام جزء من الإعلان"],"correctIndex":2},{"q":"لماذا نبدأ بالبحث؟","options":["لزيادة عدد المنشورات","لتقليل التخمين وفهم السوق والعميل","لتقليل السعر","لإنشاء شعار"],"correctIndex":1},{"q":"ما الهدف من التموضع التسويقي؟","options":["اختيار لون الشعار فقط","تحديد المكان الذي نريد أن تحتله العلامة في ذهن العميل","زيادة عدد الموظفين","تحديد طريقة الدفع"],"correctIndex":1},{"q":"أي مما يلي جزء من تحسين التحويل؟","options":["اختبار صفحة الهبوط","تغيير اسم الشركة فقط","زيادة عدد الموظفين","تغيير المكتب"],"correctIndex":0},{"q":"ما الهدف الأساسي من الأتمتة التسويقية؟","options":["استبدال الاستراتيجية","تنفيذ العمليات المتكررة بطريقة منظمة وآلية","إلغاء التسويق","زيادة الأسعار"],"correctIndex":1},{"q":"ما الذي يحدث بعد القياس في دورة التحسين؟","options":["التوقف","التحليل واستخراج الاستنتاجات ثم الاختبار والتحسين","حذف الحملة دائمًا","زيادة الميزانية دائمًا"],"correctIndex":1},{"q":"لماذا لا يجب التوسع قبل إثبات نجاح النظام؟","options":["لأن زيادة الميزانية دائمًا سيئة","لأن التوسع قد يضاعف مشكلة موجودة أصلًا","لأن الإعلانات لا تعمل","لأن العملاء لا يشترون"],"correctIndex":1},{"q":"أي تسلسل يمثل نظامًا تسويقيًا متكاملًا بشكل أفضل؟","options":["إعلان → منشور فقط","بحث → استراتيجية → جذب → تحويل → احتفاظ → قياس → تحسين","تصميم → شعار → منشور","سعر → خصم → إعلان"],"correctIndex":1},{"q":"ما أهم فكرة في النظام التسويقي؟","options":["تنفيذ أكبر عدد من الأنشطة","استخدام أكبر عدد من الأدوات","جعل عناصر التسويق تعمل معًا كنظام قابل للقياس والتحسين","زيادة عدد الإعلانات فقط"],"correctIndex":2}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set title = excluded.title, passing_score = excluded.passing_score, questions = excluded.questions;

commit;

select c.slug, count(distinct l.id) as lessons, count(distinct q.id) as quizzes from courses c left join lessons l on l.course_id=c.id left join quizzes q on q.course_id=c.id where c.slug='marketing-growth' group by c.slug;