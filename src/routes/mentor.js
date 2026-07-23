const express = require("express");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");
const { PROJECT_PROMPTS } = require("../mentor-projects");

const router = express.Router();

const COURSE_CONTENT = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "course-content.json"), "utf-8")
);

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function buildSystemPrompt(chapterNum) {
  const chapter = COURSE_CONTENT[String(chapterNum)];
  const project = PROJECT_PROMPTS[String(chapterNum)];

  const chapterBlock = chapter
    ? `عنوان الفصل الحالي: ${chapter.title}\nملخص محتوى الفصل (للاستخدام كمرجع فقط، متقراش النص ده حرفيًا للطالب): ${chapter.content}`
    : "الطالب مش داخل فصل محدد دلوقتي — ممكن يسأل سؤال عام عن الكورس.";

  return `إنت "المرشد الذكي" في منصة تعليمية لكورس التسويق والتسويق الرقمي. دورك إنك مدرّس شخصي صبور وودود بيتكلم عربي بسيط وواضح مع الطالب.

قواعد أساسية:
- اشرح خطوة بخطوة، وسؤال-سؤال — متديش محاضرة طويلة دفعة واحدة، اسأل الطالب أسئلة قصيرة كل شوية عشان تتأكد إنه فاهم قبل ما تكمل.
- لو الطالب مش فاهم جزء، بسّطه بمثال عملي قريب من حياته اليومية.
- ممنوع تجاوب على أسئلة الاختبار (Quiz) مباشرة لو حسّيت إن الطالب بيسأل عليها بالنص — وجّهه للمفهوم بدل الإجابة الجاهزة.
- لما تحس إن الطالب استوعب أفكار الفصل الأساسية (من كلامه وأسئلته)، اطلب منه المشروع التطبيقي التالي بالظبط: "${project || "مفيش مشروع محدد لهذا الفصل، اطلب منه ملخص بكلماته لأهم فكرتين في الفصل."}"
- لما الطالب يبعتلك حل المشروع، قيّمه بصدق: لو فعلاً فهم، قوله بوضوح "تمام، واضح إنك فاهم الفكرة 👏" وشجّعه يكمل. لو الفهم ناقص، وضحله بلطف اللي ناقصه واطلب منه يحسّن إجابته.
- خليك مختصر ودافئ، وردودك مناسبة لموبايل (فقرات قصيرة).

${chapterBlock}`;
}

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { chapter, messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "لا توجد رسائل لإرسالها." });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ ok: false, error: "المرشد الذكي غير مفعّل بعد — مفتاح الـ API غير مضبوط على السيرفر." });
    }

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: buildSystemPrompt(chapter),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      console.error("Anthropic API error:", data);
      return res.status(502).json({ ok: false, error: "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية." });
    }

    const reply = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    res.json({ ok: true, reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع، حاول مرة أخرى." });
  }
});

module.exports = router;
