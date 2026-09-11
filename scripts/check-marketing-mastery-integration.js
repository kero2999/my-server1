process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "local-integration-check-key";
process.env.JWT_SECRET ||= "local-integration-check-secret";

const fs = require("fs");
const path = require("path");
const content = require("../data/course-content-marketing-mastery.json");
const { getMentorProjectPrompt } = require("../src/mentor-projects");
const { getGraduationProjectBrief } = require("../src/graduation-project-briefs");
const { prepareCourseHtml } = require("../src/routes/content");
const { chapterCountryContext } = require("../src/learning");
const mentorRouter = require("../src/routes/mentor");
if (typeof mentorRouter !== "function") throw new Error("Mentor router failed to load");

const chapters = Object.keys(content);
if (chapters.length !== 12) {
  throw new Error(`Expected 12 mentor chapters, found ${chapters.length}`);
}
for (let chapter = 1; chapter <= 12; chapter += 1) {
  const entry = content[String(chapter)];
  if (!entry?.title || !entry?.content || entry.content.length < 500) {
    throw new Error(`Mentor content is incomplete for chapter ${chapter}`);
  }
  if (!getMentorProjectPrompt("marketing-mastery", chapter)) {
    throw new Error(`Mentor project prompt is missing for chapter ${chapter}`);
  }
}

const project = getGraduationProjectBrief({ slug: "marketing-mastery" });
if (!project || project.deliverables.length < 10) {
  throw new Error("Marketing Mastery graduation project is incomplete");
}
const rubricTotal = project.rubric.reduce((total, criterion) => total + Number(criterion.points || 0), 0);
if (rubricTotal !== 100) {
  throw new Error(`Graduation project rubric must equal 100, found ${rubricTotal}`);
}

const sourceHtml = Buffer.from(`<!doctype html><html data-protected="true"><head></head><body><a href="dashboard.html">Dashboard</a><a class="quiz-link" href="quiz.html?ch=12">Quiz</a><script>location.replace('quiz.html?ch=12')</script></body></html>`);
const prepared = prepareCourseHtml(sourceHtml, "ch12.html", "marketing-mastery", 88, null);
const expectedDashboard = "https://www.quadralevel.com/dashboard/marketing-mastery";
const expectedQuiz = "https://www.quadralevel.com/quiz/marketing-mastery/chapter/12";
if (!prepared.includes(expectedDashboard)) throw new Error("Dashboard URL was not rewritten");
if (!prepared.includes(expectedQuiz)) throw new Error("Quiz URL was not rewritten");
if (!prepared.includes('target="_top"')) throw new Error("Rewritten navigation must escape the course iframe");
if (/href=["']quiz\.html/i.test(prepared)) throw new Error("Legacy local quiz link remains in prepared HTML");

const egypt = {
  countryCode: "EG",
  countryName: "مصر",
  dialect: "العربية المصرية",
  currency: "EGP",
  currencySymbol: "ج.م",
  locale: "ar-EG",
  uiMessages: { marketLabel: "مثال من السوق المصري" },
  lessonContexts: { 1: "مثال محلي من المستوى الأول" },
};
if (chapterCountryContext({ slug: "marketing-mastery" }, null, egypt, 1) !== "") {
  throw new Error("Marketing Mastery dashboard must not inherit generic local examples");
}
if (chapterCountryContext({ slug: "marketing-launch" }, null, egypt, 1) !== egypt.lessonContexts[1]) {
  throw new Error("Existing courses must retain their local examples");
}
const masteryWithCountry = prepareCourseHtml(sourceHtml, "index.html", "marketing-mastery", 88, egypt);
if (masteryWithCountry.includes('id="ql-country-context"')) {
  throw new Error("Marketing Mastery chapter must not inject a generic local example");
}
const launchWithCountry = prepareCourseHtml(sourceHtml, "index.html", "marketing-launch", 4, egypt);
if (!launchWithCountry.includes('id="ql-country-context"')) {
  throw new Error("Marketing Launch local example behavior changed unexpectedly");
}

const sqlPath = path.join(__dirname, "..", "marketing-mastery-setup.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const requiredSqlValues = [
  "'marketing-mastery'",
  "'Marketing Mastery'",
  "39900",
  "'Kero'",
  "'draft'",
  "'index.html'",
  "'marketing-mastery-capstone'",
];
for (const required of requiredSqlValues) {
  if (!sql.includes(required)) throw new Error(`SQL is missing ${required}`);
}
if ((sql.match(/insert into quizzes/g) || []).length !== 12) throw new Error("SQL must create 12 quizzes");
if ((sql.match(/\"q\":/g) || []).length !== 120) throw new Error("SQL must contain 120 questions");
if ((sql.match(/\"correctIndex\":/g) || []).length !== 120) throw new Error("SQL must contain 120 answer keys");

console.log(JSON.stringify({
  ok: true,
  chapters: chapters.length,
  quizzes: 12,
  questions: 120,
  rubricTotal,
  lastChapter: content["12"].title,
  rewrittenQuizUrl: expectedQuiz,
}));
