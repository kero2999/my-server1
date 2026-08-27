const supabase = require("./db");

const DEFAULT_COUNTRY_CODE = "EG";
const COUNTRY_CODES = ["EG", "AE", "SA"];
const MISSING_SCHEMA_CODES = new Set(["42P01", "42703", "PGRST205"]);

const BASE_UI = {
  welcome: "مرحبًا بك في QuadraLevel",
  choosePrompt: "اختار دولتك عشان نجهز لك تجربة تعليمية مناسبة لسوقك.",
  start: "يلا نبدأ",
  askMentor: "اسأل المينتور",
  quizReady: "جاهز تختبر نفسك؟",
  dashboard: "لوحتي",
  quiz: "الاختبار",
  mentorContext: "اسأل عن الفصل",
  mentorOpen: "افتح المحادثة",
  countrySettings: "إعدادات الدولة",
};

const DEFAULT_COUNTRIES = {
  EG: {
    countryCode: "EG",
    countryName: "مصر",
    dialect: "العربية المصرية",
    currency: "EGP",
    currencySymbol: "جنيه",
    phoneCode: "+20",
    contentVersion: "eg-v1",
    locale: "ar-EG",
    uiMessages: { ...BASE_UI, marketLabel: "مثال من السوق المصري" },
    mentorContext: {
      languageInstruction: "استخدم العربية المصرية البسيطة والطبيعية، من غير مبالغة أو كلمات مصطنعة.",
      marketInstruction: "عند الحاجة استخدم أمثلة مناسبة من القاهرة والإسكندرية والمدن المصرية، مع الحفاظ على دقة المعلومة.",
      priceInstruction: "إذا احتجت مثالًا سعريًا، استخدم الجنيه المصري (EGP) واذكر أنه مثال فقط.",
      marketExamples: ["متجر إلكتروني مصري", "مطعم محلي", "مشروع من القاهرة أو الإسكندرية"],
    },
    lessonContexts: {
      1: "مثال محلي: محل عصائر في القاهرة يبدأ بسؤال العملاء عن النكهات التي يفضلونها قبل بناء عرضه.",
      2: "مثال محلي: عميل يرى فيديو قصيرًا لمطعم في الإسكندرية، ثم يقرأ التقييمات قبل أن يطلب.",
      3: "مثال محلي: متجر ملابس أونلاين يقسم جمهوره حسب الاحتياج والميزانية بدل مخاطبة الجميع بنفس الرسالة.",
      4: "مثال محلي: عرض توصيل واضح وضمان استبدال يمكن أن يقللا تردد العميل قبل شراء منتج محلي.",
      5: "مثال محلي: مشروع خدمة منزلية يراجع المنتج والسعر ومكان الوصول وطريقة الترويج قبل إطلاقه.",
      6: "مثال محلي: صفحة إنستغرام لمشروع صغير تستخدم محتوى مفيدًا، ثم تعيد استهداف من زار الصفحة ولم يطلب.",
      7: "مثال محلي: براند مصري يحافظ على ألوان ورسائل ثابتة حتى يتعرف عليه العميل من أول نظرة.",
      8: "مثال محلي: منشور لمشروع حلويات يبدأ بمشكلة العميل ثم يقدم فائدة واضحة ودعوة بسيطة للتواصل.",
      9: "مثال محلي: حملة لكورس أونلاين تقيس الوعي والاهتمام والشراء بدل الاعتماد على عدد الإعجابات فقط.",
    },
    quizContexts: {
      1: "تخيّل مشروعًا صغيرًا في القاهرة يريد فهم العميل قبل الإعلان.",
      2: "تخيّل عميلًا يتعرف على مطعم محلي ثم يقارن قبل الطلب.",
      3: "تخيّل متجرًا إلكترونيًا مصريًا يحدد Buyer Persona مناسبًا.",
      4: "تخيّل عرضًا محليًا يوازن بين الشعور والدليل المنطقي.",
      5: "تخيّل خدمة منزلية تراجع عناصر المزيج التسويقي.",
      6: "تخيّل حملة على منصات يستخدمها الجمهور المصري.",
      7: "تخيّل براندًا مصريًا يريد بناء الثقة والتميّز.",
      8: "تخيّل منشورًا تسويقيًا لجمهور مصري واضح.",
      9: "تخيّل حملة رقمية تقيس رحلة العميل من الوعي إلى الشراء.",
    },
    projectContext: "طبّق الخطة على مشروع حقيقي أو افتراضي في مصر، ويمكنك اختيار مدينتك أو جمهورك الفعلي بدون التقيد بمدينة معينة.",
  },
  AE: {
    countryCode: "AE",
    countryName: "الإمارات",
    dialect: "العربية الإماراتية",
    currency: "AED",
    currencySymbol: "درهم",
    phoneCode: "+971",
    contentVersion: "ae-v1",
    locale: "ar-AE",
    uiMessages: { ...BASE_UI, start: "يلا نبدأ", marketLabel: "مثال من السوق الإماراتي" },
    mentorContext: {
      languageInstruction: "استخدم العربية الإماراتية الطبيعية والمهنية باعتدال، مع وضوح تعليمي ومن دون مبالغة في اللهجة.",
      marketInstruction: "عند الحاجة استخدم أمثلة مناسبة من دبي وأبوظبي والشارقة، مثل المطاعم والعقارات والمتاجر الإلكترونية والخدمات.",
      priceInstruction: "إذا احتجت مثالًا سعريًا، استخدم الدرهم الإماراتي (AED) واذكر أنه مثال فقط.",
      marketExamples: ["متجر إلكتروني في الإمارات", "مطعم في دبي", "خدمة أو Personal Brand في أبوظبي أو الشارقة"],
    },
    lessonContexts: {
      1: "مثال محلي: مطعم في دبي يبدأ بفهم تفضيلات زواره قبل اختيار العرض والرسالة.",
      2: "مثال محلي: عميل يكتشف خدمة في أبوظبي، ثم يقارن التقييمات والتفاصيل قبل التواصل.",
      3: "مثال محلي: متجر إلكتروني إماراتي يحدد شرائح العملاء حسب الحاجة والقدرة الشرائية.",
      4: "مثال محلي: سياسة استبدال واضحة وتوصيل منظم يساعدان على بناء الثقة قبل الشراء.",
      5: "مثال محلي: شركة خدمات تراجع المنتج والسعر والقنوات وتجربة العميل قبل إطلاق العرض.",
      6: "مثال محلي: مشروع في الشارقة يجمع بين محتوى تعليمي وإعلانات موجهة ثم يقيس التحويلات.",
      7: "مثال محلي: براند إماراتي يوحّد نبرة التواصل والهوية البصرية في كل نقطة تماس.",
      8: "مثال محلي: محتوى لخدمة عقارية يبدأ بحاجة العميل ثم يقدم قيمة ودعوة واضحة للتواصل.",
      9: "مثال محلي: حملة رقمية تتابع انتقال العميل من مشاهدة الإعلان إلى الطلب أو التسجيل.",
    },
    quizContexts: {
      1: "تخيّل مشروعًا في دبي يريد فهم عميله قبل إطلاق حملة.",
      2: "تخيّل عميلًا يتعرف على خدمة في أبوظبي ثم يقارن الخيارات.",
      3: "تخيّل متجرًا إماراتيًا يبني Buyer Persona واضحًا.",
      4: "تخيّل عرضًا في سوق الإمارات يجمع الإقناع العاطفي والدليل.",
      5: "تخيّل شركة خدمات تراجع عناصر المزيج التسويقي.",
      6: "تخيّل حملة تستهدف جمهورًا إماراتيًا عبر القنوات المناسبة.",
      7: "تخيّل براندًا إماراتيًا يريد بناء التذكر والثقة.",
      8: "تخيّل رسالة تسويقية لخدمة في دبي أو أبوظبي.",
      9: "تخيّل رحلة عميل إماراتي من الوعي إلى التحويل.",
    },
    projectContext: "طبّق الخطة على مشروع حقيقي أو افتراضي في الإمارات، ويمكنك اختيار المدينة والجمهور المناسبين لمشروعك بدون التقيد بمثال واحد.",
  },
  SA: {
    countryCode: "SA",
    countryName: "السعودية",
    dialect: "العربية السعودية",
    currency: "SAR",
    currencySymbol: "ريال",
    phoneCode: "+966",
    contentVersion: "sa-v1",
    locale: "ar-SA",
    uiMessages: { ...BASE_UI, start: "خلنا نبدأ", marketLabel: "مثال من السوق السعودي" },
    mentorContext: {
      languageInstruction: "استخدم العربية السعودية الطبيعية والمهنية باعتدال، مع أسلوب واضح ومباشر ومن دون مبالغة في اللهجة.",
      marketInstruction: "عند الحاجة استخدم أمثلة مناسبة من الرياض وجدة والدمام، مثل المتاجر الإلكترونية والمطاعم والعقارات والخدمات.",
      priceInstruction: "إذا احتجت مثالًا سعريًا، استخدم الريال السعودي (SAR) واذكر أنه مثال فقط.",
      marketExamples: ["متجر إلكتروني سعودي", "مطعم في الرياض أو جدة", "خدمة محلية أو Personal Brand"],
    },
    lessonContexts: {
      1: "مثال محلي: مشروع مشروبات في الرياض يبدأ بفهم تفضيلات جمهوره قبل تحديد العرض.",
      2: "مثال محلي: عميل يتعرف على مطعم في جدة، ثم يراجع التقييمات قبل اتخاذ القرار.",
      3: "مثال محلي: متجر سعودي يقسم جمهوره حسب المشكلة والاحتياج بدل استخدام رسالة واحدة للجميع.",
      4: "مثال محلي: ضمان واضح وخدمة ما بعد البيع يساعدان العميل على الشعور بالأمان.",
      5: "مثال محلي: مشروع خدمة يراجع العرض والسعر والقنوات وطريقة الوصول إلى العميل.",
      6: "مثال محلي: حملة في الدمام تستخدم محتوى مفيدًا وإعلانات مدفوعة وتقيس النتائج.",
      7: "مثال محلي: براند سعودي يحافظ على شخصية ثابتة في التصميم والرسائل وخدمة العملاء.",
      8: "مثال محلي: محتوى لمتجر يبدأ بسؤال يهم العميل ثم يشرح الفائدة وينتهي بدعوة واضحة.",
      9: "مثال محلي: حملة رقمية تقيس رحلة العميل من مشاهدة المحتوى حتى التسجيل أو الشراء.",
    },
    quizContexts: {
      1: "تخيّل مشروعًا في الرياض يريد فهم العميل قبل الإطلاق.",
      2: "تخيّل عميلًا يتعرف على مطعم في جدة ثم يقارن الخيارات.",
      3: "تخيّل متجرًا سعوديًا يحدد Buyer Persona بدقة.",
      4: "تخيّل عرضًا في السوق السعودي يجمع الشعور والدليل المنطقي.",
      5: "تخيّل خدمة محلية تراجع عناصر المزيج التسويقي.",
      6: "تخيّل حملة سعودية تختار القناة المناسبة وتقيس التحويل.",
      7: "تخيّل براندًا سعوديًا يريد بناء الثقة والتميّز.",
      8: "تخيّل رسالة تسويقية لجمهور في الرياض أو جدة.",
      9: "تخيّل رحلة عميل سعودي من الوعي إلى التحويل.",
    },
    projectContext: "طبّق الخطة على مشروع حقيقي أو افتراضي في السعودية، ويمكنك اختيار المدينة والجمهور الفعليين لمشروعك بدون التقيد بمدينة محددة.",
  },
};

function isMissingCountrySchema(error) {
  return Boolean(error && (MISSING_SCHEMA_CODES.has(error.code) || /(country_configs|course_country_pricing|lesson_country_variants|quiz_country_variants|project_country_variants|country_code)/i.test(String(error.message || ""))));
}

function normalizeCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function clone(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
}

function publicCountry(config) {
  if (!config) return null;
  return {
    countryCode: config.country_code || config.countryCode,
    countryName: config.country_name || config.countryName,
    dialect: config.dialect,
    currency: config.currency_code || config.currency,
    currencySymbol: config.currency_symbol || config.currencySymbol,
    phoneCode: config.phone_code || config.phoneCode,
    contentVersion: config.content_version || config.contentVersion,
    locale: config.locale || "ar",
    uiMessages: config.ui_messages || config.uiMessages || {},
    mentorContext: config.mentor_context || config.mentorContext || {},
    lessonContexts: config.lesson_contexts || config.lessonContexts || {},
    quizContexts: config.quiz_contexts || config.quizContexts || {},
    projectContext: config.project_context || config.projectContext || "",
  };
}

function mergeCountry(row) {
  const code = normalizeCountryCode(row?.country_code || row?.countryCode) || DEFAULT_COUNTRY_CODE;
  const base = DEFAULT_COUNTRIES[code] || DEFAULT_COUNTRIES[DEFAULT_COUNTRY_CODE];
  const merged = {
    ...base,
    ...(row || {}),
    countryCode: code,
    countryName: row?.country_name || row?.countryName || base.countryName,
    dialect: row?.dialect || base.dialect,
    currency: row?.currency_code || row?.currency || base.currency,
    currencySymbol: row?.currency_symbol || row?.currencySymbol || base.currencySymbol,
    phoneCode: row?.phone_code || row?.phoneCode || base.phoneCode,
    contentVersion: row?.content_version || row?.contentVersion || base.contentVersion,
    locale: row?.locale || base.locale,
    uiMessages: { ...base.uiMessages, ...(row?.ui_messages || row?.uiMessages || {}) },
    mentorContext: { ...base.mentorContext, ...(row?.mentor_context || row?.mentorContext || {}) },
    lessonContexts: { ...base.lessonContexts, ...(row?.lesson_contexts || row?.lessonContexts || {}) },
    quizContexts: { ...base.quizContexts, ...(row?.quiz_contexts || row?.quizContexts || {}) },
    projectContext: row?.project_context || row?.projectContext || base.projectContext,
  };
  return merged;
}

async function getCountryConfig(code = DEFAULT_COUNTRY_CODE) {
  const normalized = normalizeCountryCode(code) || DEFAULT_COUNTRY_CODE;
  const { data, error } = await supabase.from("country_configs").select("*").eq("country_code", normalized).eq("is_active", true).maybeSingle();
  if (error) {
    if (isMissingCountrySchema(error)) return clone(DEFAULT_COUNTRIES[normalized] || DEFAULT_COUNTRIES[DEFAULT_COUNTRY_CODE]);
    throw error;
  }
  return mergeCountry(data || DEFAULT_COUNTRIES[normalized]);
}

async function listCountryConfigs() {
  const { data, error } = await supabase.from("country_configs").select("*").eq("is_active", true).order("country_name", { ascending: true });
  if (error) {
    if (isMissingCountrySchema(error)) return COUNTRY_CODES.map((code) => clone(DEFAULT_COUNTRIES[code]));
    throw error;
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mergeCountry(row)).filter(Boolean);
}

async function getUserCountry(userId) {
  const state = await getUserCountryState(userId);
  return state.country;
}

async function getActiveCountryConfig(code) {
  const normalized = normalizeCountryCode(code) || DEFAULT_COUNTRY_CODE;
  const { data, error } = await supabase.from("country_configs").select("*").eq("country_code", normalized).eq("is_active", true).maybeSingle();
  if (error) {
    if (isMissingCountrySchema(error)) return clone(DEFAULT_COUNTRIES[normalized] || DEFAULT_COUNTRIES[DEFAULT_COUNTRY_CODE]);
    throw error;
  }
  if (!data) {
    const inactive = new Error("COUNTRY_NOT_ACTIVE");
    inactive.code = "COUNTRY_NOT_ACTIVE";
    throw inactive;
  }
  return mergeCountry(data);
}

async function getUserCountryState(userId) {
  const { data, error } = await supabase.from("users").select("country_code").eq("id", userId).maybeSingle();
  if (error) {
    if (isMissingCountrySchema(error)) return { country: mergeCountry(DEFAULT_COUNTRIES[DEFAULT_COUNTRY_CODE]), selected: false, countryCode: DEFAULT_COUNTRY_CODE };
    throw error;
  }
  const storedCode = normalizeCountryCode(data?.country_code);
  if (!storedCode) return { country: await getCountryConfig(DEFAULT_COUNTRY_CODE), selected: false, countryCode: DEFAULT_COUNTRY_CODE };
  try {
    return { country: await getActiveCountryConfig(storedCode), selected: true, countryCode: storedCode };
  } catch (countryError) {
    if (countryError?.code === "COUNTRY_NOT_ACTIVE") return { country: await getCountryConfig(DEFAULT_COUNTRY_CODE), selected: false, countryCode: DEFAULT_COUNTRY_CODE };
    throw countryError;
  }
}

async function saveUserCountry(userId, code) {
  const normalized = normalizeCountryCode(code);
  if (!normalized) {
    const error = new Error("COUNTRY_CODE_INVALID");
    error.code = "COUNTRY_CODE_INVALID";
    throw error;
  }
  const country = await getActiveCountryConfig(normalized);
  const { data, error } = await supabase.from("users").update({ country_code: normalized }).eq("id", userId).select("id, country_code").single();
  if (error) throw error;
  return { user: data, country };
}

async function getCoursePrices(courseIds, countryCode) {
  const ids = (Array.isArray(courseIds) ? courseIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const code = normalizeCountryCode(countryCode) || DEFAULT_COUNTRY_CODE;
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from("course_country_pricing").select("course_id, country_code, price_cents, currency").in("course_id", ids).eq("country_code", code).eq("is_active", true);
  if (error) {
    if (isMissingCountrySchema(error)) return new Map();
    throw error;
  }
  return new Map((data || []).map((row) => [Number(row.course_id), row]));
}

async function getCourseVariants(courseId, countryCode) {
  const code = normalizeCountryCode(countryCode) || DEFAULT_COUNTRY_CODE;
  const [lessonsResult, quizzesResult, projectsResult] = await Promise.all([
    supabase.from("lesson_country_variants").select("lesson_key, title, summary, content_html, market_examples, is_active").eq("course_id", courseId).eq("country_code", code).eq("is_active", true),
    supabase.from("quiz_country_variants").select("quiz_key, title, questions, scenario_context, is_active").eq("course_id", courseId).eq("country_code", code).eq("is_active", true),
    supabase.from("project_country_variants").select("project_key, title, instructions, is_active").eq("course_id", courseId).eq("country_code", code).eq("is_active", true),
  ]);
  const firstError = [lessonsResult, quizzesResult, projectsResult].find((result) => result.error)?.error;
  if (firstError && !isMissingCountrySchema(firstError)) throw firstError;
  return {
    lessons: new Map((lessonsResult.data || []).map((row) => [row.lesson_key, row])),
    quizzes: new Map((quizzesResult.data || []).map((row) => [row.quiz_key, row])),
    projects: new Map((projectsResult.data || []).map((row) => [row.project_key, row])),
  };
}

module.exports = {
  DEFAULT_COUNTRY_CODE,
  COUNTRY_CODES,
  DEFAULT_COUNTRIES,
  isMissingCountrySchema,
  normalizeCountryCode,
  publicCountry,
  getCountryConfig,
  getActiveCountryConfig,
  listCountryConfigs,
  getUserCountry,
  getUserCountryState,
  saveUserCountry,
  getCoursePrices,
  getCourseVariants,
};
