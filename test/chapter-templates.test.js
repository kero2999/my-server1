const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TEMPLATE_FORMAT,
  formatTemplateSubmissionForReview,
  getChapterTemplate,
  normalizeTemplateSubmission,
  parseTemplateSubmission,
  practicalTaskText,
  publicChapterTemplate,
  serializeTemplateSubmission,
  validateChapterTemplateDefinitions,
} = require("../src/chapter-templates");

const COURSE_SLUGS = [
  "marketing-launch",
  "marketing-growth",
  "marketing-mastery",
  "marketing-leadership",
];

test("all current courses have twelve valid practical templates", () => {
  const validation = validateChapterTemplateDefinitions();
  assert.deepEqual(validation, { ok: true, errors: [] });

  for (const slug of COURSE_SLUGS) {
    const scenarios = new Set();
    const types = new Set();
    for (let chapter = 1; chapter <= 12; chapter += 1) {
      const template = getChapterTemplate(slug, chapter);
      assert.ok(template, `${slug} chapter ${chapter} template is missing`);
      assert.equal(template.chapterNumber, chapter);
      assert.match(template.id, new RegExp(`^${slug}:chapter-${chapter}$`));
      assert.ok(template.fields.length >= 3 && template.fields.length <= 7);
      assert.equal(new Set(template.fields.map((field) => field.id)).size, template.fields.length);
      assert.ok(template.reviewCriteria.length >= 3 && template.reviewCriteria.length <= 5);
      assert.ok(template.concept.length > 10);
      assert.ok(template.skill.length > 10);
      assert.ok(template.taskTitle.length > 5);
      assert.ok(template.taskDescription.length > 20);
      assert.ok(template.resultPrompt.length > 10);
      template.fields.forEach((field) => {
        assert.match(field.id, /^[a-z0-9_]+$/);
        assert.ok(["text", "textarea"].includes(field.type));
        assert.equal(typeof field.required, "boolean");
      });
      scenarios.add(template.scenario);
      types.add(template.type);
    }
    assert.equal(scenarios.size, 12, `${slug} must use a different scenario in every chapter`);
    assert.ok(types.size >= 8, `${slug} needs meaningfully varied template types`);
  }
});

test("student payload excludes Kero review criteria", () => {
  const internal = getChapterTemplate("marketing-growth", 3);
  const publicTemplate = publicChapterTemplate("marketing-growth", 3);
  assert.ok(internal.reviewCriteria.length >= 3);
  assert.equal(Object.hasOwn(publicTemplate, "reviewCriteria"), false);
  assert.equal(publicTemplate.taskTitle, internal.taskTitle);
  assert.equal(publicTemplate.fields.length, internal.fields.length);
});

test("structured answers round-trip through the existing template_text column", () => {
  const template = getChapterTemplate("marketing-launch", 3);
  const answers = Object.fromEntries(template.fields.map((field, index) => [
    field.id,
    `إجابة تطبيقية واضحة للخطوة رقم ${index + 1} مبنية على حالة الفصل.`,
  ]));
  const normalized = normalizeTemplateSubmission(template, {
    answers,
    result: "النتيجة النهائية هي اختيار شريحة محددة ورسالة عملية قابلة للاختبار والقياس.",
  });
  assert.equal(normalized.format, TEMPLATE_FORMAT);
  assert.equal(normalized.templateId, template.id);

  const serialized = serializeTemplateSubmission(normalized);
  const parsed = parseTemplateSubmission(serialized);
  assert.deepEqual(parsed, normalized);

  const reviewText = formatTemplateSubmissionForReview(template, parsed);
  template.fields.forEach((field) => assert.match(reviewText, new RegExp(field.label)));
  assert.match(reviewText, /النتيجة النهائية/);
  assert.match(practicalTaskText(template), /خطوات التطبيق/);
});

test("required template fields and final result are enforced", () => {
  const template = getChapterTemplate("marketing-leadership", 1);
  assert.throws(
    () => normalizeTemplateSubmission(template, { answers: {}, result: "نتيجة" }),
    (error) => error.code === "INVALID_TEMPLATE_SUBMISSION" && /أكمل خانة/.test(error.message),
  );
  assert.equal(parseTemplateSubmission("legacy free text answer"), null);
});
