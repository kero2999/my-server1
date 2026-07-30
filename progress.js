/* =========================================================
   LMSProgress — per-student progress, resume, and quiz results
   ========================================================= */
(function (global) {
  const TOTAL_CHAPTERS = 9;

  function _key(username) {
    return "lms_progress_v1_" + username;
  }

  function _read(username) {
    if (!username) return _empty();
    try {
      const raw = localStorage.getItem(_key(username));
      return raw ? Object.assign(_empty(), JSON.parse(raw)) : _empty();
    } catch (e) {
      return _empty();
    }
  }

  function _write(username, data) {
    if (!username) return;
    localStorage.setItem(_key(username), JSON.stringify(data));
  }

  function _empty() {
    return {
      lastChapter: null,
      lastSlide: null,
      chapters: {}, // { "1": { lastSlideReached: 5, totalSlides: 15, visited: true, completed: false } }
      quizzes: {}, // { "1": { score: 80, passed: true, attempts: 2, at: iso } }
    };
  }

  function _username() {
    return global.LMSAuth ? global.LMSAuth.currentUsername() : null;
  }

  function trackSlide(chapter, slide, totalSlides) {
    const uname = _username();
    if (!uname) return;
    const data = _read(uname);
    data.lastChapter = chapter;
    data.lastSlide = slide;
    const c = data.chapters[chapter] || {};
    c.totalSlides = totalSlides;
    c.lastSlideReached = Math.max(c.lastSlideReached || 0, slide);
    c.visited = true;
    if (slide >= totalSlides) c.finishedSlides = true;
    data.chapters[chapter] = c;
    _write(uname, data);
  }

  function getLastSlide(chapter) {
    const uname = _username();
    if (!uname) return null;
    const c = _read(uname).chapters[chapter];
    return c ? c.lastSlideReached : null;
  }

  function getLastLesson() {
    const uname = _username();
    if (!uname) return null;
    const data = _read(uname);
    if (!data.lastChapter) return null;
    return { chapter: data.lastChapter, slide: data.lastSlide };
  }

  function recordQuizResult(chapter, score, passed) {
    const uname = _username();
    if (!uname) return;
    const data = _read(uname);
    const prev = data.quizzes[chapter] || { attempts: 0 };
    data.quizzes[chapter] = {
      score,
      passed: passed || (prev.passed === true),
      bestScore: Math.max(score, prev.bestScore || 0),
      attempts: (prev.attempts || 0) + 1,
      at: new Date().toISOString(),
    };
    const c = data.chapters[chapter] || {};
    c.completed = data.quizzes[chapter].passed;
    data.chapters[chapter] = c;
    _write(uname, data);
  }

  function getQuizResult(chapter) {
    const uname = _username();
    if (!uname) return null;
    return _read(uname).quizzes[chapter] || null;
  }

  function getChapterStatus(chapter) {
    const uname = _username();
    if (!uname) return "locked-none";
    const data = _read(uname);
    const c = data.chapters[chapter];
    const q = data.quizzes[chapter];
    if (q && q.passed) return "completed";
    if (c && c.visited) return "in-progress";
    return "not-started";
  }

  function getChapterPercent(chapter) {
    const uname = _username();
    if (!uname) return 0;
    const data = _read(uname);
    const c = data.chapters[chapter];
    const q = data.quizzes[chapter];
    let pct = 0;
    if (c && c.totalSlides) {
      pct += Math.min(1, (c.lastSlideReached || 0) / c.totalSlides) * 70;
    }
    if (q && q.passed) pct += 30;
    return Math.round(pct);
  }

  function getOverallPercent() {
    let sum = 0;
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) sum += getChapterPercent(i);
    return Math.round(sum / TOTAL_CHAPTERS);
  }

  function getCompletedCount() {
    let n = 0;
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
      if (getChapterStatus(i) === "completed") n++;
    }
    return n;
  }

  function allChaptersPassed() {
    return getCompletedCount() === TOTAL_CHAPTERS;
  }

  // الفصل الأول مفتوح دايمًا. أي فصل بعده يحتاج اجتياز اختبار الفصل اللي قبله.
  function isChapterUnlocked(chapter) {
    chapter = Number(chapter);
    if (chapter <= 1) return true;
    return getChapterStatus(chapter - 1) === "completed";
  }

  const PROJECT_KEY_PREFIX = "lms_project_v1_";

  function submitProject(text) {
    const uname = _username();
    if (!uname) return { ok: false, error: "سجّل دخولك أولاً." };
    if (!allChaptersPassed()) return { ok: false, error: "لازم تخلّص وتجتاز كل الفصول التسعة أولاً." };
    if (!text || !text.trim()) return { ok: false, error: "من فضلك اكتب مشروعك أولاً." };
    const record = { text: text.trim(), submittedAt: new Date().toISOString() };
    localStorage.setItem(PROJECT_KEY_PREFIX + uname, JSON.stringify(record));

    // نسخة احتياطية على السيرفر لو متصل (عشان تقدر تراجعها من عندك أي وقت)
    try {
      if (global.API_BASE_URL && global.LMSAuth && global.LMSAuth.isRemote()) {
        const token = localStorage.getItem("lms_token_v1");
        fetch(global.API_BASE_URL + "/api/projects/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ text: record.text }),
        }).catch(function () {});
      }
    } catch (e) {}

    return { ok: true };
  }

  function getProjectSubmission() {
    const uname = _username();
    if (!uname) return null;
    try { return JSON.parse(localStorage.getItem(PROJECT_KEY_PREFIX + uname)); }
    catch (e) { return null; }
  }

  function hasSubmittedProject() {
    return !!getProjectSubmission();
  }

  function canGetCertificate() {
    return allChaptersPassed() && hasSubmittedProject();
  }

  function getAverageScore() {
    let sum = 0, count = 0;
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
      const q = getQuizResult(i);
      if (q) { sum += q.bestScore || q.score || 0; count++; }
    }
    return count ? Math.round(sum / count) : 0;
  }

  global.LMSProgress = {
    TOTAL_CHAPTERS,
    trackSlide,
    getLastSlide,
    getLastLesson,
    recordQuizResult,
    getQuizResult,
    getChapterStatus,
    getChapterPercent,
    getOverallPercent,
    getCompletedCount,
    allChaptersPassed,
    isChapterUnlocked,
    submitProject,
    getProjectSubmission,
    hasSubmittedProject,
    canGetCertificate,
    getAverageScore,
  };
})(window);
