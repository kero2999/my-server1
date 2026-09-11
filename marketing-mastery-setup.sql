-- Marketing Mastery course setup for QuadraLevel
-- Generated from the reviewed 12-chapter ZIP. Safe to rerun.
-- Creates/updates the draft course, 12 lessons, 12 official quizzes, and one capstone project.
-- Run in Supabase SQL Editor after merging the application changes and before uploading the ZIP.

begin;

insert into courses (slug, title, description, thumbnail_url, price_cents, currency, category_id, instructor, status, trial_minutes, entry_file, updated_at)
values (
  'marketing-mastery',
  'Marketing Mastery',
  'المستوى الثالث المتقدم من مسار التسويق في QuadraLevel. ينقل المتعلم من تنفيذ الأنشطة المنفصلة إلى بناء نظام تسويقي متكامل يبدأ بالاستراتيجية وتحليل السوق والتموضع والعرض والتسعير، ثم يربط القمع والأداء والتحويل والتحليلات والاحتفاظ والمحتوى وتجارب النمو بخطة تشغيل قابلة للقياس.',
  'https://www.quadralevel.com/images/course-marketing-mastery.jpg',
  39900,
  'EGP',
  (select category_id from courses where slug in ('marketing-growth', 'marketing-launch') and category_id is not null limit 1),
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
  category_id = coalesce(excluded.category_id, courses.category_id),
  instructor = excluded.instructor,
  trial_minutes = excluded.trial_minutes,
  entry_file = excluded.entry_file,
  updated_at = now();

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into lessons (course_id, lesson_key, title, position, is_preview)
select course_row.id, seed.lesson_key, seed.title, seed.position, seed.is_preview
from course_row
cross join (values
  ('ch1', 'الاستراتيجية التسويقية المتقدمة', 1, true),
  ('ch2', 'تحليل السوق والعملاء المتقدم', 2, false),
  ('ch3', 'التموضع وبناء القيمة المقترحة', 3, false),
  ('ch4', 'استراتيجية العرض والتسعير', 4, false),
  ('ch5', 'رحلة العميل المتقدمة وبناء الـFunnel', 5, false),
  ('ch6', 'Performance Marketing', 6, false),
  ('ch7', 'Conversion Rate Optimization', 7, false),
  ('ch8', 'Marketing Analytics & Metrics', 8, false),
  ('ch9', 'Customer Retention & CRM', 9, false),
  ('ch10', 'Content & Creative Strategy', 10, false),
  ('ch11', 'Growth Marketing', 11, false),
  ('ch12', 'بناء نظام تسويقي متكامل', 12, false)
) as seed(lesson_key, title, position, is_preview)
on conflict (course_id, lesson_key) do update set
  title = excluded.title,
  position = excluded.position,
  is_preview = excluded.is_preview;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-1', 'اختبار الفصل 1: الاستراتيجية التسويقية المتقدمة', 70, $json$[{"q":"الاستراتيجية التسويقية تجيب بشكل أساسي عن:","options":["ما التصميم الأفضل للإعلان؟","من، أين، ماذا، لماذا، كيف، بأي تكلفة، وإلى أين","كم عدد المتابعين المطلوب؟","أي لون نستخدم في الشعار؟"],"correctIndex":1},{"q":"العلاقة الصحيحة بين Strategy وPlan وTactics هي:","options":["Tactics → Plan → Strategy","Strategy → Plan → Tactics","لا علاقة بينهم","Plan → Strategy → Tactics"],"correctIndex":1},{"q":"الفرق الجوهري بين Tactical Marketing وStrategic Marketing:","options":["Tactical يسأل لماذا، Strategic يسأل ماذا","Tactical يسأل ماذا نفعل الآن، Strategic يسأل لماذا نفعل هذا أصلًا","لا فرق بينهما","Strategic أرخص دائمًا"],"correctIndex":1},{"q":"هدف SMART الجيد يجب أن يكون:","options":["عامًا وغير محدد بوقت","محددًا وقابلًا للقياس ومرتبطًا بزمن","مرتبطًا بالمنافس فقط","بدون أي أرقام"],"correctIndex":1},{"q":"تحليل SWOT يهدف في النهاية إلى:","options":["كتابة تقرير فقط","تحويل التحليل إلى قرار فعلي","مقارنة الشعارات","حساب الميزانية فقط"],"correctIndex":1},{"q":"أي نوع من المنافسة يمثله 'توظيف Marketer بدل تعلم التسويق' بالنسبة لمنصة تعليمية؟","options":["Direct Competitor","Indirect Competitor","Substitute","لا يعتبر منافسًا"],"correctIndex":2},{"q":"الميزة التنافسية الحقيقية تختلف عن الادعاءات العامة مثل 'أفضل خدمة' لأنها:","options":["أغلى سعرًا","محددة وقابلة للإثبات ويصعب تقليدها","تعتمد على الحظ","لا تحتاج دليلًا"],"correctIndex":1},{"q":"القاعدة الذهبية بخصوص السوق المستهدف تقول إن الاستراتيجية تبحث عن:","options":["أكبر عدد من العملاء بأي شكل","Better Customers وليس فقط More Customers","عملاء بسعر منخفض فقط","تجنب أي تقسيم للسوق"],"correctIndex":1},{"q":"مفهوم Channel-Product Fit يعني:","options":["استخدام كل القنوات المتاحة دائمًا","اختيار القناة الأنسب لهذا المنتج ولهذا الجمهور ولهذا الهدف","استخدام القناة الأرخص فقط","التركيز على قناة واحدة فقط للأبد"],"correctIndex":1},{"q":"الإطار الخماسي لبناء الاستراتيجية هو:","options":["Diagnose → Decide → Build → Measure → Optimize","Design → Sell → Ship → Repeat → Stop","Ads → Sales → Profit → Scale → Exit","Plan → Ignore → Launch → Hope → Wait"],"correctIndex":0}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-2', 'اختبار الفصل 2: تحليل السوق والعملاء المتقدم', 70, $json$[{"q":"الفرق بين Demographics وPsychographics هو أن الأخيرة تركز على:","options":["العمر والدخل فقط","ما يريده العميل ويخافه ويطمح إليه","المدينة التي يسكن فيها","نوع الجهاز الذي يستخدمه"],"correctIndex":1},{"q":"أي نوع من Market Segmentation يقسم العملاء حسب المشكلة التي يريدون حلها؟","options":["Geographic","Needs-Based","Demographic","Behavioral فقط"],"correctIndex":1},{"q":"Pain Point يختلف عن Problem في أنه:","options":["نفس الشيء تمامًا","الشعور المؤلم الناتج عن استمرار المشكلة","لا علاقة له بالعميل","دائمًا يتعلق بالسعر فقط"],"correctIndex":1},{"q":"من أنواع Customer Motivation المذكورة:","options":["Gain, Avoidance, Status, Convenience, Security, Growth","اللون والشكل فقط","السعر فقط","الموقع الجغرافي فقط"],"correctIndex":0},{"q":"TAM وSAM وSOM تُستخدم لـ:","options":["تحديد ألوان العلامة التجارية","تقدير حجم السوق الكلي والقابل للخدمة والقابل للوصول فعليًا","حساب تكلفة الإعلان فقط","تحديد سعر المنتج النهائي"],"correctIndex":1},{"q":"الـFree Alternative مثل YouTube المجاني يعتبر:","options":["ليس منافسًا على الإطلاق","منافسًا حقيقيًا يجب أخذه في الاعتبار","نفس المنتج بالضبط","غير موجود في تحليل العملاء"],"correctIndex":1},{"q":"RFM Segmentation تعتمد على:","options":["Recency, Frequency, Monetary","Reach, Frequency, Media","Region, Format, Model","Risk, Fee, Margin"],"correctIndex":0},{"q":"Voice of Customer يعني الاعتماد على:","options":["تخمينات فريق التسويق فقط","لغة العميل الحقيقية من المراجعات والمقابلات والتعليقات","آراء المنافسين فقط","الإحصاءات الحكومية فقط"],"correctIndex":1},{"q":"إذا كان تطبيق ممتازًا لكن الطلب عليه ضعيف، فالمشكلة غالبًا في:","options":["التصميم فقط","Product-Market Fit","الخط المستخدم في الشعار","لا توجد مشكلة"],"correctIndex":1},{"q":"الفكرة الأساسية للانتقال من Analysis إلى Decision هي:","options":["البيانات وحدها كافية بدون قرار","Insight يجب أن يؤدي إلى Decision ثم Action محدد","تجاهل البيانات واتخاذ القرار بالحدس فقط","الاكتفاء بجمع البيانات فقط"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-3', 'اختبار الفصل 3: التموضع وبناء القيمة المقترحة', 70, $json$[{"q":"الـPositioning هو بشكل أساسي:","options":["الشعار والألوان فقط","المكان الذي تريد امتلاكه في ذهن العميل مقارنة بالمنافسين","السعر الأرخص في السوق","عدد المنتجات المعروضة"],"correctIndex":1},{"q":"لماذا Positioning ليس مجرد Slogan؟","options":["لأن Slogan أهم منه","لأن الجملة العامة لا تحدد لمن ولا أفضل في ماذا ولا مقارنة بماذا","لأنهما نفس الشيء تمامًا","لأن Slogan غير مسموح استخدامه"],"correctIndex":1},{"q":"الفرق بين Difference وMeaningful Difference:","options":["لا فرق بينهما","Meaningful Difference لها قيمة حقيقية يهتم بها العميل","Difference دائمًا أقوى","كلاهما بلا قيمة"],"correctIndex":1},{"q":"القيمة المدركة (Perceived Value) تعتمد على:","options":["السعر فقط بغض النظر عن أي شيء آخر","الفوائد المدركة مقابل التكاليف المدركة كالمال والوقت والمخاطر","لون المنتج فقط","عدد الموظفين في الشركة"],"correctIndex":1},{"q":"الـValue Proposition القوية يجب أن تكون:","options":["معقدة وطويلة قدر الإمكان","واضحة ومحددة وذات قيمة ومختلفة وقابلة للتصديق","عامة تناسب الجميع","بدون أي دليل أو إثبات"],"correctIndex":1},{"q":"قالب Positioning Statement يتضمن بشكل أساسي:","options":["العميل المستهدف، المشكلة، الفائدة الأساسية، البدائل، سبب التصديق","اسم الشركة فقط","عدد الموظفين","تاريخ التأسيس فقط"],"correctIndex":0},{"q":"من أسئلة اختبار قوة الـPositioning السبعة:","options":["Relevant, Clear, Differentiated, Believable, Valuable, Sustainable, Profitable","اللون، الشكل، الحجم فقط","السعر فقط","عدد الصفحات في الموقع"],"correctIndex":0},{"q":"تناقض الـPositioning يحدث عندما:","options":["يتوافق كل شيء مع الادعاء","تدّعي العلامة أنها Premium لكن التجربة الفعلية رخيصة وضعيفة","السعر مرتفع فقط","المنتج جديد في السوق"],"correctIndex":1},{"q":"Price Positioning يتدرج من:","options":["Budget إلى Luxury مرورًا بـValue وMid-Market وPremium","رخيص فقط بلا تدرج","غالٍ فقط بلا تدرج","لا علاقة للسعر بالـPositioning"],"correctIndex":0},{"q":"العلاقة الصحيحة بين المفاهيم الثلاثة هي:","options":["Positioning = الهوية البصرية فقط","Positioning = المكان في العقل، Branding = الهوية والتجربة، Value Proposition = القيمة الموعودة","Value Proposition = الشعار فقط","لا فرق بين الثلاثة"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-4', 'اختبار الفصل 4: استراتيجية العرض والتسعير', 70, $json$[{"q":"الفرق بين Product وOffer:","options":["لا فرق بينهما إطلاقًا","Offer يشمل كل ما يحصل عليه العميل والقيمة المدركة والسعر وتقليل المخاطر، وليس المنتج فقط","Offer دائمًا أرخص من Product","Product هو نفسه السعر"],"correctIndex":1},{"q":"حسب Value Equation، ترتفع القيمة المدركة مع:","options":["زيادة الوقت والمجهود المطلوبين","زيادة النتيجة المرجوة واحتمالية النجاح","زيادة المخاطر","تقليل النتيجة المتوقعة"],"correctIndex":1},{"q":"الانتقال من Feature إلى Benefit إلى Outcome يعني:","options":["ذكر المواصفات فقط","شرح الميزة ثم فائدتها ثم النتيجة النهائية التي يحصل عليها العميل","تجاهل شرح المنتج تمامًا","التركيز على السعر فقط"],"correctIndex":1},{"q":"Risk Reversal مثل فترة تجربة مجانية يهدف إلى:","options":["زيادة السعر","تقليل المخاطرة المدركة لدى العميل قبل الشراء","تعقيد عملية الشراء","إخفاء معلومات المنتج"],"correctIndex":1},{"q":"الفرق بين Scarcity وUrgency:","options":["Scarcity تتعلق بندرة الكمية، وUrgency تتعلق بضيق الوقت","لا فرق بينهما","كلاهما يعني نفس الخصم","Urgency تعني ارتفاع الجودة"],"correctIndex":0},{"q":"Value-Based Pricing يعتمد بشكل أساسي على:","options":["تكلفة الإنتاج فقط","القيمة التي يحققها المنتج للعميل","سعر أرخص منافس فقط","رأي الموظفين فقط"],"correctIndex":1},{"q":"خطر استخدام الخصومات المستمرة هو:","options":["لا يوجد أي خطر","تعليم العميل أن السعر الحقيقي أقل بكثير مما يضر بالعلامة التجارية","زيادة الثقة بالعلامة دائمًا","ارتفاع هامش الربح تلقائيًا"],"correctIndex":1},{"q":"Pricing يجب أن يتوافق مع Positioning لأن:","options":["السعر لا علاقة له بالـPositioning إطلاقًا","خصومات دائمة مع ادعاء Premium يخلق تناقضًا يفقد الثقة","السعر المرتفع دائمًا خطأ","التسعير لا يؤثر على تصور العميل"],"correctIndex":1},{"q":"زيادة Conversion Rate عبر خفض السعر قد تؤدي إلى:","options":["زيادة الربحية دائمًا وبلا استثناء","انخفاض الربحية رغم زيادة المبيعات إذا انخفض الهامش","لا تأثير على الأرباح إطلاقًا","زيادة الـLTV تلقائيًا"],"correctIndex":1},{"q":"من عناصر Framework بناء Offer قوي:","options":["Outcome, Problems, Core Product, Bonuses, Risk Reversal, Proof, Pricing","اللون فقط","عدد الموظفين فقط","الشعار فقط"],"correctIndex":0}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-5', 'اختبار الفصل 5: رحلة العميل المتقدمة وبناء الـFunnel', 70, $json$[{"q":"الفرق بين Customer Journey وMarketing Funnel:","options":["لا فرق بينهما إطلاقًا","Journey من وجهة نظر العميل، والFunnel هو النظام الذي تبنيه أنت لنقله بين المراحل","Journey أهم من الFunnel دائمًا","الFunnel يخص العميل فقط"],"correctIndex":1},{"q":"المراحل التسعة للـAdvanced Funnel تبدأ بـ:","options":["Purchase مباشرة","Awareness ثم Interest ثم Consideration وهكذا حتى Advocacy","Retention أولًا","Referral أولًا"],"correctIndex":1},{"q":"Micro-Conversions تساعد في:","options":["تجاهل تفاصيل رحلة العميل","تتبع خطوات صغيرة مثل Ad View وSignup وTrial لفهم مكان التسريب الحقيقي","قياس الأرباح النهائية فقط","إلغاء الحاجة لأي قياس"],"correctIndex":1},{"q":"Funnel Leakage يشير إلى:","options":["نجاح كل مراحل القمع","المرحلة التي يفقد فيها القمع أكبر نسبة من العملاء المحتملين","زيادة المبيعات فجأة","عدم وجود أي مشكلة في النظام"],"correctIndex":1},{"q":"Retargeting الفعّال يعتمد على:","options":["إرسال نفس الرسالة للجميع بغض النظر عن سلوكهم","تخصيص الرسالة حسب سلوك الشخص كزيارة الموقع أو ترك السلة","تجاهل من زار الموقع سابقًا","استهداف عشوائي بلا بيانات"],"correctIndex":1},{"q":"مستويات الوعي (Awareness Levels) تتدرج من:","options":["Most Aware إلى Unaware فقط بلا ترتيب منطقي","Unaware إلى Problem Aware إلى Solution Aware إلى Product Aware إلى Most Aware","لا علاقة لها بالرسالة التسويقية","نفس الرسالة تصلح لكل المستويات"],"correctIndex":1},{"q":"الفرق بين Cold وWarm وHot Funnel:","options":["لا فرق بينها إطلاقًا","تختلف حسب درجة معرفة الجمهور واستعداده للشراء","كلها تستخدم نفس الرسالة بالضبط","Cold Funnel هو الأسرع دائمًا"],"correctIndex":1},{"q":"الـFunnel لا ينتهي عند الشراء لأن:","options":["LTV يهتم بالقيمة طوال علاقة العميل بالبيزنس وليس أول عملية شراء فقط","الشراء هو نهاية كل شيء دائمًا","لا داعي لمتابعة العميل بعد الدفع","Retention غير مهم إطلاقًا"],"correctIndex":0},{"q":"Activation في سياق ما بعد الشراء تعني:","options":["مجرد إتمام الدفع","وصول العميل فعليًا لاستخدام المنتج والاستفادة منه","إلغاء الاشتراك","نفس معنى Purchase تمامًا"],"correctIndex":1},{"q":"عند تشخيص مشكلة الأداء في القمع، إذا كان CTR جيدًا لكن Landing Page Conversion ضعيفًا، فالمشكلة الأرجح في:","options":["الإعلان نفسه فقط","Landing Page أو Offer أو Trust أو UX","الميزانية المرتفعة جدًا","عدد الموظفين"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-6', 'اختبار الفصل 6: Performance Marketing', 70, $json$[{"q":"Performance Marketing يركز بشكل أساسي على:","options":["الوصول والإعجابات فقط","نتائج قابلة للقياس مثل Leads وPurchases وCAC وROAS وProfit","الشكل الجمالي للإعلان فقط","عدد المتابعين فقط"],"correctIndex":1},{"q":"Reverse Funnel Planning يعني:","options":["البدء من الميزانية العشوائية","البدء من هدف الإيرادات النهائي ثم حساب ما يلزم من زيارات وانطباعات للوصول إليه","تجاهل الأهداف التجارية كليًا","البدء من الإعلان دون أي هدف"],"correctIndex":1},{"q":"Search يعتبر قناة Intent لأن:","options":["العميل يبحث فعليًا عن الحل","المستخدم لا يعرف ماذا يريد","لا علاقة له بنية الشراء","يستخدم فقط للترفيه"],"correctIndex":0},{"q":"ROAS يقيس:","options":["الربح الصافي مباشرة","الإيراد الناتج مقابل كل جنيه يُصرف على الإعلانات، وليس الربح","عدد المتابعين الجدد","تكلفة الإنتاج فقط"],"correctIndex":1},{"q":"Break-Even ROAS يرتبط بشكل أساسي بـ:","options":["عدد الموظفين","هامش المساهمة (Contribution Margin)","لون الإعلان","عدد الكلمات في النص الإعلاني"],"correctIndex":1},{"q":"Hypothesis-Driven Testing يعني:","options":["تغيير أشياء عشوائية بدون سبب","وضع فرضية محددة وقابلة للاختبار قبل تجربة تغيير ما","تجنب أي اختبار نهائيًا","الاعتماد على الحظ فقط"],"correctIndex":1},{"q":"إذا كان CTR جيدًا لكن Conversion ضعيفًا، فالمشكلة الأرجح في:","options":["الإعلان نفسه بالكامل","Landing Page أو Offer أو Message Match","عدد المشاهدات فقط","لا توجد مشكلة"],"correctIndex":1},{"q":"Creative Fatigue يظهر عادة عندما:","options":["يرتفع CTR باستمرار","ترتفع Frequency وينخفض CTR ويرتفع CPA بسبب تكرار نفس الإعلان","ينخفض عدد المشاهدات إلى صفر","لا علاقة له بتكرار الإعلان"],"correctIndex":1},{"q":"Attribution Model يُعتبر:","options":["الحقيقة المطلقة دائمًا","نموذج تقديري للمساهمة وليس حقيقة مطلقة","غير مهم إطلاقًا","لا يستخدم في التسويق الرقمي"],"correctIndex":1},{"q":"أحيانًا تحسين معدل التحويل بنسبة بسيطة قد يكون:","options":["أقل فائدة من زيادة الإنفاق الإعلاني دائمًا","أكثر كفاءة من زيادة الإنفاق على نفس الـTraffic","مستحيل التحقيق","بلا أي تأثير على الإيرادات"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-7', 'اختبار الفصل 7: Conversion Rate Optimization', 70, $json$[{"q":"CRO يهدف إلى:","options":["زيادة عدد الزوار فقط","زيادة نسبة من يقومون بالسلوك المطلوب من الزوار الحاليين","تقليل جودة المحتوى","تجاهل تجربة المستخدم"],"correctIndex":1},{"q":"معادلة Conversion Rate الأساسية هي:","options":["Visitors ÷ Conversions","Conversions ÷ Visitors × 100","Conversions × Visitors","Visitors - Conversions"],"correctIndex":1},{"q":"CRO أوسع من مجرد تغيير لون الزر لأنه يشمل:","options":["فقط الألوان والأشكال","Audience وMessage وOffer وTrust وFriction وSpeed وغيرها","التصميم فقط بلا محتوى","لا علاقة له بتجربة المستخدم"],"correctIndex":1},{"q":"Message Match يعني:","options":["اختلاف الرسالة بين الإعلان والصفحة والعرض","اتساق الوعد بين الإعلان والـLanding Page والـOffer والـCheckout","تجاهل رسالة الإعلان تمامًا","استخدام رسائل عشوائية مختلفة كل مرة"],"correctIndex":1},{"q":"من عوامل زيادة الـConversion الأربعة:","options":["Value وRelevance وTrust ترتفع، وFriction ينخفض","Friction يرتفع دائمًا لزيادة الجودة","تجاهل الثقة كليًا","خفض القيمة المدركة"],"correctIndex":0},{"q":"Choice Architecture مثل 'Good/Better/Best' يهدف إلى:","options":["زيادة عدد الخيارات إلى أقصى حد","تسهيل اتخاذ القرار بتقليل التعقيد المعرفي","تعقيد عملية الاختيار","إخفاء الأسعار عن العميل"],"correctIndex":1},{"q":"الفرق بين Real Urgency وFake Urgency:","options":["لا فرق بينهما","Real Urgency حقيقية وقابلة للتصديق، بينما Fake Urgency تتكرر بلا سبب حقيقي وتدمر الثقة","Fake Urgency أفضل دائمًا","كلاهما ممنوع استخدامه"],"correctIndex":1},{"q":"عند اختبار A/B، يجب تحديد قبل البدء:","options":["لا داعي لتحديد أي شيء مسبقًا","Primary Metric وHypothesis واضحة","الفائز مسبقًا فقط","تجاهل أي قياس"],"correctIndex":1},{"q":"مقياس Revenue per Visitor مفيد لأنه:","options":["يتجاهل قيمة الطلب تمامًا","يوازن بين معدل التحويل ومتوسط قيمة الطلب معًا","يقيس عدد الزيارات فقط","لا علاقة له بالإيرادات"],"correctIndex":1},{"q":"تحسين مرحلة Activation داخل الـFunnel يمكن أن:","options":["لا يؤثر على عدد المبيعات النهائي إطلاقًا","يزيد عدد المشتريات النهائي بشكل كبير دون زيادة الـTraffic","يقلل عدد المشتريات دائمًا","لا علاقة له بالـFunnel"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-8', 'اختبار الفصل 8: Marketing Analytics & Metrics', 70, $json$[{"q":"التسلسل الصحيح في التحليل التسويقي هو:","options":["Action ثم Data ثم Metric","Data → Metric → Insight → Decision → Action","Insight فقط بدون بيانات","Metric وحده كافٍ بدون قرار"],"correctIndex":1},{"q":"الفرق بين Metric وKPI:","options":["لا فرق بينهما إطلاقًا","كل KPI هو Metric لكن ليس كل Metric مهمًا بنفس القدر أو مرتبطًا بالهدف الأساسي","KPI دائمًا أقل أهمية من Metric","KPI لا يمكن قياسه"],"correctIndex":1},{"q":"Leading Indicators تساعد على:","options":["معرفة النتيجة بعد حدوثها فقط","توقع النتيجة قبل حدوثها مثل Trial Starts وActivation Rate","تجاهل التنبؤ بالمستقبل","قياس الإيرادات الماضية فقط"],"correctIndex":1},{"q":"ROAS مرتفع لا يعني بالضرورة ربحية عالية لأن:","options":["ROAS لا علاقة له بالإيرادات إطلاقًا","ROAS لا يأخذ في الاعتبار هامش الربح والتكاليف المتغيرة","الربح دائمًا أعلى من الإيراد","لا يوجد فرق بين ROAS والربح"],"correctIndex":1},{"q":"Payback Period يقيس:","options":["إجمالي عدد العملاء","المدة اللازمة لاسترداد تكلفة اكتساب العميل من خلال هامش المساهمة","عدد الزيارات اليومية","متوسط سعر المنتج فقط"],"correctIndex":1},{"q":"Cohort Analysis يساعد على اكتشاف:","options":["نفس النتيجة لكل العملاء بلا فروق","اختلاف جودة وقيمة العملاء بين دفعات مختلفة بمرور الوقت","عدد المنتجات المباعة فقط","لا فائدة منه إطلاقًا"],"correctIndex":1},{"q":"Vanity Metrics تصبح مشكلة عندما:","options":["تُستخدم كمعلومة إضافية جانبية","تصبح هدفًا نهائيًا بمعزل عن نتائج الأعمال الفعلية","تُقارن بالإيرادات دائمًا","لا تُستخدم إطلاقًا"],"correctIndex":1},{"q":"Attribution يختلف عن Incrementality في أن الأخير يحاول معرفة:","options":["أي قناة ظهرت أولًا فقط","النتائج الإضافية الحقيقية التي حدثت بسبب التسويق فعلًا","عدد النقرات فقط","لا علاقة له بالتسويق"],"correctIndex":1},{"q":"من أسباب اختلاف بيانات الحملة عن بيانات الـBackend:","options":["البيانات دائمًا متطابقة 100%","Duplicate Events وMissing Events وأخطاء في الـTracking","عدم وجود أي أخطاء ممكنة","التطابق التام دائمًا مضمون"],"correctIndex":1},{"q":"الفرق بين Reporting وAnalytics:","options":["لا فرق بينهما","Reporting يعرض الأرقام، وAnalytics يفسرها ويربطها بقرار وسبب","Analytics أسهل من Reporting دائمًا","Reporting أكثر تعمقًا من Analytics"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-9', 'اختبار الفصل 9: Customer Retention & CRM', 70, $json$[{"q":"Customer Retention يعني:","options":["الحصول على عملاء جدد فقط","قدرة البيزنس على الاحتفاظ بالعملاء الحاليين واستمرارهم","تجاهل العملاء بعد الشراء","خفض الأسعار باستمرار"],"correctIndex":1},{"q":"Activation تختلف عن Purchase في أنها:","options":["نفس الشيء تمامًا","وصول العميل فعليًا إلى أول قيمة حقيقية من المنتج بعد الشراء","مجرد إتمام عملية الدفع","لا علاقة لها بالمنتج"],"correctIndex":1},{"q":"Time to Value يشير إلى:","options":["مدة صلاحية العرض","الوقت الذي يحتاجه العميل للوصول إلى أول قيمة حقيقية","سعر المنتج","عدد الموظفين في الشركة"],"correctIndex":1},{"q":"الفرق بين Voluntary وInvoluntary Churn:","options":["لا فرق بينهما","الأول قرار واعٍ من العميل، والثاني ناتج عن مشكلة مثل فشل الدفع","كلاهما بسبب السعر دائمًا","Involuntary لا يمكن الوقاية منه إطلاقًا"],"correctIndex":1},{"q":"من أهم استخدامات RFM Segmentation:","options":["تحديد الألوان المناسبة للعلامة التجارية","تصنيف العملاء حسب حداثة وتكرار وقيمة مشترياتهم","تحديد نوع الخط المستخدم","قياس سرعة الموقع فقط"],"correctIndex":1},{"q":"عند مواجهة Churn، يُفضل عدم افتراض أن السبب دائمًا:","options":["ضعف الاستخدام","السعر، دون التحقق من الأسباب الحقيقية عبر Exit Survey","جودة المنتج","تعقيد الواجهة"],"correctIndex":1},{"q":"Behavior-Based Automation أذكى من Time-Based لأنها:","options":["ترسل نفس الرسالة للجميع بنفس التوقيت دائمًا","تستجيب لسلوك العميل الفعلي مثل عدم بدء الكورس بدل الاعتماد على التقويم فقط","لا تحتاج بيانات إطلاقًا","أبطأ من Time-Based دائمًا"],"correctIndex":1},{"q":"Discount ليس الحل المناسب دائمًا عند انخفاض Retention لأن:","options":["الخصم يحل كل المشاكل دائمًا","المشكلة قد تكون في عدم الفهم أو عدم الاستخدام أو ضعف القيمة، لا السعر فقط","السعر لا علاقة له بالاحتفاظ إطلاقًا","الخصم يرفع الجودة تلقائيًا"],"correctIndex":1},{"q":"Product Ladder يهدف إلى:","options":["بيع منتج واحد فقط للأبد","نقل العميل تدريجيًا عبر مستويات منتج مترابطة لزيادة قيمته وLTV","تقليل خيارات العميل تمامًا","منع العميل من الشراء مرة أخرى"],"correctIndex":1},{"q":"النظام الأقوى في هذا الفصل يوصف بأنه:","options":["Acquire → Convert → Activate → Retain → Expand → Advocate","الحصول على عميل ثم نسيانه","مجرد إرسال رسائل تسويقية عشوائية","التركيز على عدد المتابعين فقط"],"correctIndex":0}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-10', 'اختبار الفصل 10: Content & Creative Strategy', 70, $json$[{"q":"الفرق بين Content Strategy وContent Plan:","options":["لا فرق بينهما","Strategy تجيب عن لماذا ولمن، والPlan يحدد ماذا وننشر متى","Plan أهم من Strategy دائمًا","كلاهما يعني نفس الجدول الزمني فقط"],"correctIndex":1},{"q":"المحتوى الجيد يجب أن يبدأ من:","options":["فكرة عشوائية للنشر","فهم مشكلة العميل واحتياجه الحقيقي","تقليد المنافسين حرفيًا","عدد المشاهدات المطلوبة فقط"],"correctIndex":1},{"q":"Content Pillars تساعد على:","options":["تشتيت المحتوى أكثر","تنظيم المحاور الرئيسية التي يدور حولها المحتوى بثبات","نشر أي شيء بلا خطة","تجاهل هدف المحتوى"],"correctIndex":1},{"q":"نوع المحتوى المناسب لمرحلة Awareness غالبًا يكون:","options":["عرض السعر والـCTA المباشر للشراء","محتوى يوضح المشكلة ويجذب الانتباه","شهادات العملاء فقط","الأسئلة الشائعة عن الدفع"],"correctIndex":1},{"q":"Hook القوي يجب أن يخلق:","options":["الملل فقط","Relevance وCuriosity وValue","التعقيد بلا فائدة","لا شيء محدد"],"correctIndex":1},{"q":"Hook قوي مع محتوى ضعيف يؤدي إلى:","options":["ثقة وفعل فوري من المشاهد","جذب الانتباه دون تحقيق ثقة أو فعل حقيقي","نتيجة مثالية دائمًا","زيادة المبيعات تلقائيًا"],"correctIndex":1},{"q":"Message Architecture تتكون بترتيب من:","options":["CTA ثم Problem","Problem → Consequence → Insight → Solution → Proof → CTA","Proof فقط بلا سياق","لا يوجد ترتيب منطقي"],"correctIndex":1},{"q":"Content Repurposing يعني:","options":["إنشاء كل قطعة محتوى من الصفر في كل مرة","تحويل فكرة أساسية واحدة إلى عدة أشكال محتوى مختلفة","حذف المحتوى القديم دائمًا","نشر نفس القطعة حرفيًا في كل منصة بلا تعديل"],"correctIndex":1},{"q":"تقييم نجاح فيديو يجب أن يرتبط بـ:","options":["عدد المشاهدات فقط بغض النظر عن الهدف","الهدف المحدد للفيديو مثل Awareness أو Conversion","لون الفيديو فقط","طول الفيديو فقط"],"correctIndex":1},{"q":"Content Feedback Loop الاحترافي يتضمن:","options":["النشر فقط بدون قياس","Create → Publish → Measure → Analyze → Understand Why → Repeat","تجاهل نتائج المحتوى السابق","تغيير الاستراتيجية عشوائيًا كل أسبوع"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-11', 'اختبار الفصل 11: Growth Marketing', 70, $json$[{"q":"Growth Marketing ينظر إلى النمو من خلال:","options":["قناة تسويقية واحدة فقط","النظام الكامل للبيزنس بما فيه Conversion وRetention وReferral","زيادة عدد المتابعين فقط","الإعلانات المدفوعة فقط"],"correctIndex":1},{"q":"نموذج AARRR يشمل:","options":["Acquisition, Activation, Retention, Revenue, Referral","Awareness فقط","Advertising, Analysis, Revenue فقط","Ads, Reach, Reporting فقط"],"correctIndex":0},{"q":"الفرق بين Funnel وGrowth Loop:","options":["لا فرق بينهما إطلاقًا","الـLoop تجعل نتيجة المرحلة الأخيرة تغذي بداية دورة جديدة من النمو","الـFunnel دائمًا أقوى من الـLoop","الـLoop لا يحتوي على عملاء"],"correctIndex":1},{"q":"ICE Framework يستخدم لتقييم التجارب بناءً على:","options":["Impact, Confidence, Ease","Income, Cost, Effort فقط","Idea, Content, Execution","Interest, Click, Engagement"],"correctIndex":0},{"q":"فرضية Growth الجيدة يجب أن تكون:","options":["عامة وغير قابلة للاختبار","محددة وقابلة للاختبار ولها سبب ومقياس واضح","بدون أي مقياس للنجاح","مجرد رأي شخصي بلا أساس"],"correctIndex":1},{"q":"الفرق بين Optimization وGrowth Experiment:","options":["لا فرق بينهما","Optimization يحسّن شيئًا موجودًا، بينما Growth Experiment قد يجرب طريقة مختلفة تمامًا","Growth Experiment أسهل دائمًا","Optimization يعني تغيير كل شيء من الصفر"],"correctIndex":1},{"q":"Product-Led Growth يعني أن:","options":["المنتج لا علاقة له بالنمو إطلاقًا","المنتج نفسه يصبح قناة اكتساب عبر الدعوات والمشاركة","التسويق فقط هو من يجلب العملاء","لا حاجة للمنتج لتحقيق النمو"],"correctIndex":1},{"q":"زيادة الميزانية الإعلانية بشكل كبير قد تؤدي إلى:","options":["بقاء CAC ثابتًا دائمًا بلا تغيير","ارتفاع CAC بسبب المنافسة على نفس الجمهور","انخفاض CAC دائمًا وبلا استثناء","لا علاقة بين الميزانية وCAC"],"correctIndex":1},{"q":"عند وجود Traffic وConversion ممتازين لكن Retention ضعيف، الأولوية يجب أن تكون:","options":["زيادة الميزانية الإعلانية أكثر","إصلاح مشكلة الاحتفاظ بالعملاء أولًا","تجاهل المشكلة تمامًا","تخفيض السعر فقط"],"correctIndex":1},{"q":"Growth Moats تشير إلى:","options":["عوائق تمنع الشركة نفسها من النمو","عناصر تجعل منافسة الشركة أصعب مثل Brand وData وNetwork Effects","خصومات دائمة للعملاء","أدوات تحليل بيانات فقط"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into quizzes (course_id, quiz_key, title, passing_score, questions)
select course_row.id, 'quiz-12', 'اختبار الفصل 12: بناء نظام تسويقي متكامل', 70, $json$[{"q":"الفرق بين Marketing Activities وMarketing System:","options":["لا فرق بينهما","الـSystem يربط كل نشاط بوظيفة ومكان محدد ضمن منظومة مترابطة","الـActivities دائمًا أقوى من الـSystem","النظام لا يحتاج أي أنشطة"],"correctIndex":1},{"q":"Reverse Marketing Planning يبدأ من:","options":["اختيار الإعلان أولًا","الهدف التجاري النهائي، ثم حساب ما يلزم من Traffic وConversion للوصول إليه","الميزانية العشوائية","لون الإعلان فقط"],"correctIndex":1},{"q":"شكل النظام التسويقي الكامل يوصف بأنه:","options":["خطي فقط وينتهي عند البيع","دائري، حيث يعود بعد Growth وFeedback إلى فهم السوق والعميل من جديد","بلا أي ترابط بين مراحله","يبدأ وينتهي بالإعلان فقط"],"correctIndex":1},{"q":"اختيار القناة التسويقية يجب أن يعتمد على:","options":["شهرة القناة فقط","طريقة سلوك العميل وتوافقها مع طبيعة المنتج (Channel-Product Fit)","عدد المستخدمين فقط بغض النظر عن الملاءمة","نفس القناة لكل المنتجات دائمًا"],"correctIndex":1},{"q":"عند تشخيص انخفاض المبيعات، الخطوة الصحيحة هي:","options":["افتراض أن الإعلانات هي السبب دائمًا فورًا","تتبع النظام تسلسليًا من Traffic إلى Conversion إلى Retention لتحديد مصدر المشكلة الفعلي","تجاهل التحليل واتخاذ قرار عشوائي","زيادة الميزانية مباشرة بلا تشخيص"],"correctIndex":1},{"q":"Activation تختلف عن Purchase لأنها تعني:","options":["نفس معنى الشراء تمامًا","وصول العميل فعليًا لاستخدام المنتج والحصول على قيمة منه","إلغاء عملية الشراء","لا علاقة لها بتجربة العميل"],"correctIndex":1},{"q":"تغيير عنصر واحد مثل خفض السعر قد يؤثر على النظام بالكامل لأن:","options":["كل عنصر في النظام منفصل تمامًا عن الآخر","التغيير قد يرفع Conversion لكن يخفض AOV والهامش والربح في نفس الوقت","خفض السعر يرفع الأرباح دائمًا وبلا استثناء","لا علاقة بين السعر والربحية"],"correctIndex":1},{"q":"مراحل بناء النظام خلال 90 يومًا هي:","options":["Build فقط بلا مراحل أخرى","Build (1-30) ثم Optimize (31-60) ثم Scale (61-90)","Scale أولًا ثم Build","لا يوجد تسلسل زمني محدد"],"correctIndex":1},{"q":"من علامات النضج التسويقي في 'Level 5 - Scalable':","options":["كل شيء عشوائي وغير مقاس","النظام أصبح قابلًا للتكرار والتنبؤ والربحية والتوسع","الاعتماد الكامل على الحظ","عدم وجود أي قياس للأداء"],"correctIndex":1},{"q":"المعادلة النهائية للنظام التسويقي القابل للتوسع تجمع بين:","options":["الإعلانات فقط","فهم العميل والاستراتيجية والـPositioning والعرض والاكتساب والتحويل والتفعيل والاحتفاظ والتوسع والقياس والتجريب معًا","السعر المنخفض فقط","عدد المتابعين فقط"],"correctIndex":1}]$json$::jsonb
from course_row
on conflict (course_id, quiz_key) do update set
  title = excluded.title,
  passing_score = excluded.passing_score,
  questions = excluded.questions;

with course_row as (
  select id from courses where slug = 'marketing-mastery'
)
insert into projects (course_id, project_key, title, instructions, passing_score)
select course_row.id, 'marketing-mastery-capstone', 'مشروع التخرج: بناء نظام نمو تسويقي متكامل خلال 90 يومًا', 'أنت مسؤول التسويق في متجر إلكتروني افتراضي اسمه «مَسار» يبيع أدوات تنظيم العمل والدراسة والمنزل. المتجر قائم ولديه مبيعات وبيانات فعلية، لكنه يعتمد على أنشطة منفصلة دون نظام تسويقي متكامل.

الوضع الحالي الافتراضي:
- 120,000 زيارة شهرية، ومعدل تحويل 1.2%، ومتوسط قيمة طلب 680 من عملة السوق المختار.
- معدل الشراء المتكرر خلال 90 يومًا هو 12%.
- الإنفاق الإعلاني الشهري 280,000، و78% من العملاء الجدد يأتون من Meta، والـROAS المعلن 2.2.
- هامش المساهمة قبل التسويق 42%، وقاعدة البريد وواتساب تضم 18,000 جهة اتصال غير مقسمة جيدًا.
- الرسائل والعروض تختلف بين القنوات، وصفحة الهبوط لا تطابق دائمًا وعود الإعلانات.

هدف الإدارة خلال 90 يومًا هو رفع معدل التحويل إلى 1.8%، ورفع الشراء المتكرر إلى 18%، وتنويع مصادر الاكتساب، وتحسين النمو المربح دون الاعتماد على خصومات دائمة. لديك ميزانية تسويق افتراضية قدرها 900,000 من عملة السوق المختار لمدة 90 يومًا.

المطلوب إعداد نظام تسويقي متكامل يشمل:
1. تشخيص الوضع وصياغة استراتيجية واضحة وأهداف رقمية وافتراضات قابلة للاختبار.
2. تحليل السوق والشرائح وVoice of Customer وTAM/SAM/SOM أو تقدير منطقي لحجم الفرصة.
3. Positioning وValue Proposition ورسائل قابلة للإثبات لكل شريحة أساسية.
4. تصميم Offer وتسعير يقللان المخاطرة المدركة ويحافظان على هامش المساهمة.
5. Customer Journey وFunnel كامل مع Micro-Conversions وأكبر نقاط التسريب وخطة Retargeting.
6. خطة Performance Marketing مبنية على Reverse Funnel Planning وCAC وROAS وBreak-even ROAS.
7. ثلاث فرضيات CRO مرتبة بالأولوية مع Primary Metric وGuardrail Metrics لكل اختبار.
8. Measurement Plan ولوحة KPIs تربط بيانات Meta والموقع والمبيعات والاحتفاظ، مع معالجة اختلاف Attribution.
9. خطة CRM وActivation وRetention وتقسيم RFM وأتمتة مبنية على السلوك.
10. Content & Creative System يربط الأعمدة والمراحل والرسائل والـHooks بالهدف التجاري.
11. ثلاثة Growth Experiments مرتبة بإطار ICE، مع Growth Loop أو Referral Mechanism مناسبة.
12. خريطة النظام النهائي وخطة 30/60/90 يومًا توضح الإجراء والمالك والمؤشر والقرار المتوقع.

اذكر افتراضاتك بوضوح، وأظهر الحسابات الأساسية، ولا تكتفِ بتعريفات نظرية أو توصيات عامة.

Rubric التقييم (100 نقطة):
- الاستراتيجية وتشخيص الوضع والأهداف: 10 نقاط.
- السوق والعملاء والشرائح والبحث: 10 نقاط.
- التموضع والقيمة المقترحة والرسائل: 10 نقاط.
- العرض والتسعير ومنطق القيمة والربحية: 10 نقاط.
- رحلة العميل والقمع والأداء المدفوع: 15 نقطة.
- CRO والتحليلات وخطة القياس: 15 نقطة.
- الاحتفاظ وCRM والأتمتة السلوكية: 10 نقاط.
- المحتوى والاستراتيجية الإبداعية: 5 نقاط.
- تجارب النمو والـGrowth Loop: 5 نقاط.
- تكامل النظام وخطة 30/60/90 ووضوح التنفيذ: 10 نقاط.
درجة النجاح: 70 من 100.', 70
from course_row
on conflict (course_id, project_key) do update set
  title = excluded.title,
  instructions = excluded.instructions,
  passing_score = excluded.passing_score;

commit;

-- Verification: expected results are 12 lessons, 12 quizzes, 1 project, price 39900, trial 10, status draft.
select id, slug, title, price_cents, currency, instructor, status, trial_minutes, entry_file, thumbnail_url from courses where slug = 'marketing-mastery';
select count(*) as lesson_count, count(*) filter (where is_preview) as preview_lesson_count from lessons where course_id = (select id from courses where slug = 'marketing-mastery');
select count(*) as quiz_count, min(passing_score) as min_passing_score, max(passing_score) as max_passing_score from quizzes where course_id = (select id from courses where slug = 'marketing-mastery');
select count(*) as project_count, min(passing_score) as passing_score from projects where course_id = (select id from courses where slug = 'marketing-mastery');
