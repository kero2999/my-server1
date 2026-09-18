const definitions = require("../data/chapter-templates.json");

const TEMPLATE_FORMAT = "ql-practical-template-v1";
const ALLOWED_FIELD_TYPES = new Set(["text", "textarea"]);
const DEFAULT_SCENARIO = "مشروع تجاري افتراضي يحتاج إلى تطبيق تسويقي واضح وقابل للقياس.";

function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeChapterNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function normalizeField(field, index) {
  const id = String(field?.id || `field_${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return {
    id,
    label: String(field?.label || `الخطوة ${index + 1}`).trim(),
    type: ALLOWED_FIELD_TYPES.has(field?.type) ? field.type : "textarea",
    required: field?.required !== false,
    placeholder: String(field?.placeholder || "اكتب تطبيقك هنا...").trim(),
  };
}

function normalizeTemplate(courseSlug, rawTemplate) {
  if (!rawTemplate) return null;
  const chapterNumber = normalizeChapterNumber(rawTemplate.chapterNumber);
  const fields = (Array.isArray(rawTemplate.fields) ? rawTemplate.fields : []).slice(0, 7).map(normalizeField);
  if (!chapterNumber || fields.length < 3) return null;
  return {
    id: `${normalizeSlug(courseSlug)}:chapter-${chapterNumber}`,
    version: 1,
    chapterNumber,
    chapterTitle: String(rawTemplate.chapterTitle || `الفصل ${chapterNumber}`).trim(),
    concept: String(rawTemplate.concept || "").trim(),
    skill: String(rawTemplate.skill || "").trim(),
    type: String(rawTemplate.type || "practical-application").trim(),
    taskTitle: String(rawTemplate.taskTitle || "طبّق مفهوم الفصل").trim(),
    taskDescription: String(rawTemplate.taskDescription || "نفّذ الخطوات التالية بنفسك ثم اكتب النتيجة التي توصلت إليها.").trim(),
    scenario: String(rawTemplate.scenario || DEFAULT_SCENARIO).trim(),
    fields,
    resultPrompt: String(rawTemplate.resultPrompt || "ما النتيجة النهائية التي توصلت إليها؟").trim(),
    reviewCriteria: (Array.isArray(rawTemplate.reviewCriteria) ? rawTemplate.reviewCriteria : [])
      .slice(0, 5)
      .map((item) => String(item || "").trim())
      .filter(Boolean),
    minimumCompletionHint: String(rawTemplate.minimumCompletionHint || "أكمل كل الخطوات المطلوبة واكتب نتيجة واضحة.").trim(),
  };
}

function getChapterTemplate(courseSlug, chapterNumber) {
  const slug = normalizeSlug(courseSlug);
  const chapter = normalizeChapterNumber(chapterNumber);
  const courseDefinition = definitions?.[slug];
  const templates = Array.isArray(courseDefinition?.templates) ? courseDefinition.templates : [];
  return normalizeTemplate(slug, templates.find((item) => Number(item?.chapterNumber) === chapter));
}

function publicChapterTemplate(courseSlug, chapterNumber) {
  const template = getChapterTemplate(courseSlug, chapterNumber);
  if (!template) return null;
  const { reviewCriteria, ...studentTemplate } = template;
  return studentTemplate;
}

function publicHowToMake(courseSlug, chapterNumber) {
  const template = getChapterTemplate(courseSlug, chapterNumber);
  if (!template) return null;
  const steps = template.fields.map((field, index) => ({
    number: index + 1,
    title: field.label,
    what: `نبدأ بـ${field.label} بطريقة بسيطة ومباشرة.`,
    example: String(field.placeholder || "مثال عملي مرتبط بالحالة").replace(/^مثال\s*:\s*/i, ""),
    why: `لأن هذه المعلومة تساعدنا على اتخاذ قرار صحيح في ${template.skill}.`,
  }));
  return {
    title: "HOW TO MAKE — كيف نصنع؟",
    subtitle: "كيف نطبق ما تعلمناه؟",
    introduction: `تعال نشوف إزاي بنطبّق «${template.concept}» على مثال واضح من أرض الواقع.`,
    caseTitle: template.taskTitle,
    caseDescription: template.taskDescription,
    steps,
    example: template.scenario,
    explanation: `الفكرة ببساطة: نستخدم ${template.skill} حتى ننتقل من فهم المشكلة إلى قرار عملي.`,
    result: template.resultPrompt,
  };
}

function practicalTaskText(template) {
  if (!template) return "طبّق أهم مفهوم في الفصل على حالة عملية، ثم وضّح القرار والنتيجة.";
  const steps = template.fields.map((field, index) => `${index + 1}) ${field.label}`).join("\n");
  return `المهمة: ${template.taskTitle}\n${template.taskDescription}\n\nالحالة التطبيقية:\n${template.scenario}\n\nخطوات التطبيق:\n${steps}\n\nالنتيجة النهائية:\n${template.resultPrompt}`;
}

function invalidSubmission(message) {
  const error = new Error(message);
  error.code = "INVALID_TEMPLATE_SUBMISSION";
  return error;
}

function normalizeTemplateSubmission(template, payload) {
  if (!template || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidSubmission("بيانات التطبيق العملي غير صالحة.");
  }
  const submittedAnswers = payload.answers && typeof payload.answers === "object" && !Array.isArray(payload.answers)
    ? payload.answers
    : {};
  const answers = {};
  for (const field of template.fields) {
    const value = String(submittedAnswers[field.id] || "").trim().slice(0, 4000);
    if (field.required && value.length < 2) throw invalidSubmission(`أكمل خانة «${field.label}».`);
    answers[field.id] = value;
  }
  const result = String(payload.result || "").trim().slice(0, 4000);
  if (result.length < 5) throw invalidSubmission("اكتب النتيجة النهائية التي توصلت إليها.");
  const totalLength = Object.values(answers).join(" ").length + result.length;
  if (totalLength < 40) throw invalidSubmission("أضف تفاصيل تطبيقية كافية قبل الإرسال إلى Kero.");
  return { format: TEMPLATE_FORMAT, templateId: template.id, templateVersion: template.version, answers, result };
}

function serializeTemplateSubmission(submission) {
  return JSON.stringify(submission);
}

function parseTemplateSubmission(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (parsed?.format !== TEMPLATE_FORMAT || !parsed.answers || typeof parsed.answers !== "object") return null;
    return {
      format: TEMPLATE_FORMAT,
      templateId: String(parsed.templateId || ""),
      templateVersion: Number(parsed.templateVersion || 1),
      answers: Object.fromEntries(Object.entries(parsed.answers).map(([key, answer]) => [String(key), String(answer || "")])),
      result: String(parsed.result || ""),
    };
  } catch (error) {
    return null;
  }
}

function formatTemplateSubmissionForReview(template, submission) {
  if (!template || !submission) return "";
  const answerLines = template.fields.map((field, index) => {
    const value = String(submission.answers?.[field.id] || "").trim() || "لم يكتب الطالب إجابة";
    return `${index + 1}) ${field.label}:\n${value}`;
  }).join("\n\n");
  return `${answerLines}\n\n${template.resultPrompt}:\n${submission.result}`;
}

function validateChapterTemplateDefinitions() {
  const errors = [];
  for (const [courseSlug, courseDefinition] of Object.entries(definitions || {})) {
    const templates = Array.isArray(courseDefinition?.templates) ? courseDefinition.templates : [];
    if (templates.length !== 12) errors.push(`${courseSlug}: expected 12 templates, found ${templates.length}`);
    const chapters = new Set();
    for (const rawTemplate of templates) {
      const template = normalizeTemplate(courseSlug, rawTemplate);
      if (!template) {
        errors.push(`${courseSlug}: invalid template definition for chapter ${rawTemplate?.chapterNumber || "unknown"}`);
        continue;
      }
      if (chapters.has(template.chapterNumber)) errors.push(`${courseSlug}: duplicate chapter ${template.chapterNumber}`);
      chapters.add(template.chapterNumber);
      if (template.fields.length < 3 || template.fields.length > 7) errors.push(`${courseSlug}: chapter ${template.chapterNumber} must have 3-7 fields`);
      if (!template.taskTitle || !template.taskDescription || !template.resultPrompt) errors.push(`${courseSlug}: chapter ${template.chapterNumber} is missing task copy`);
      if (template.fields.some((field) => !field.id || !field.label)) errors.push(`${courseSlug}: chapter ${template.chapterNumber} has an invalid field`);
      if (new Set(template.fields.map((field) => field.id)).size !== template.fields.length) errors.push(`${courseSlug}: chapter ${template.chapterNumber} has duplicate field ids`);
      if (template.reviewCriteria.length < 3) errors.push(`${courseSlug}: chapter ${template.chapterNumber} needs at least 3 review criteria`);
    }
    for (let chapter = 1; chapter <= 12; chapter += 1) {
      if (!chapters.has(chapter)) errors.push(`${courseSlug}: missing chapter ${chapter}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  TEMPLATE_FORMAT,
  formatTemplateSubmissionForReview,
  getChapterTemplate,
  normalizeTemplateSubmission,
  parseTemplateSubmission,
  practicalTaskText,
  publicHowToMake,
  publicChapterTemplate,
  serializeTemplateSubmission,
  validateChapterTemplateDefinitions,
};
