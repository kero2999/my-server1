const bank = require('../data/marketing-launch-reviewed-quizzes.json');
const VERSION = '2026-10-17-reviewed-v1';
function reviewedQuiz(course, quiz) {
  if (String(course?.slug || '').toLowerCase() !== 'marketing-launch') return null;
  const match = String(quiz?.quiz_key || '').match(/^quiz-(\d+)$/);
  const entry = match && bank[match[1]];
  return entry ? { version: VERSION, questions: entry.questions.map(q => ({ q:q.q, options:q.options, correctIndex:q.correct })) } : null;
}
module.exports = { reviewedQuiz, VERSION };
