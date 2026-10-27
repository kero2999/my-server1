const { getChapterTemplate } = require('./chapter-templates');

const LEVELS = {
  'marketing-launch': ['MARKETING LAUNCH', 'الأول'],
  'marketing-growth': ['MARKETING GROWTH', 'الثاني'],
  'marketing-mastery': ['MARKETING MASTERY', 'الثالث'],
  'marketing-leadership': ['MARKETING LEADERSHIP', 'الرابع'],
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Repair the shared assessment chrome only. Lesson text and diagrams stay untouched.
function repairAssessmentPresentation(html, path, slug) {
  const match = String(path).match(/(?:^|\/)assessment(\d+)\.html$/i);
  const level = LEVELS[slug];
  if (!match || !level) return html;
  let result = String(html)
    .replace(/MARKETING (?:LAUNCH|GROWTH|MASTERY|LEADERSHIP)\s*\/\s*ASSESSMENT/g, level[0] + ' / ASSESSMENT')
    .replace(/تقييم الفصل\s*\/\s*المستوى (?:الأول|الثاني|الثالث|الرابع)/g, 'تقييم الفصل / المستوى ' + level[1]);
  const template = getChapterTemplate(slug, Number(match[1]));
  if (template && template.reviewCriteria.length) {
    result = result.replace(/(<div\b[^>]*class=["'][^"']*\breview-rubric\b[^"']*["'][^>]*>[\s\S]*?<ul\b[^>]*>)[\s\S]*?(<\/ul>)/i,
      (_, open, close) => open + template.reviewCriteria.map(item => '<li>' + escapeHtml(item) + '</li>').join('') + close);
  }
  return result;
}

function contentErrorPage(message, courseSlug) {
  const href = 'https://www.quadralevel.com/dashboard/' + encodeURIComponent(courseSlug);
  return '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>تعذر فتح الفصل — Quadralevel</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#edf4ff;color:#10243c;font:20px/1.9 sans-serif}main{max-width:580px;padding:32px;margin:20px;background:white;border:1px solid #bdd0ed;border-radius:24px}a{display:inline-block;background:#185bdf;color:white;padding:10px 20px;border-radius:12px;text-decoration:none}</style>' +
    '<main><h1>راجع خطوتك السابقة</h1><p>' + escapeHtml(message) + '</p><a target="_top" href="' + href + '">العودة إلى فهرس الكورس</a></main></html>';
}

module.exports = { repairAssessmentPresentation, contentErrorPage };
