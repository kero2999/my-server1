const express = require("express");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");
const { PROJECT_PROMPTS } = require("../mentor-projects");

const router = express.Router();

const COURSE_CONTENT = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "course-content.json"), "utf-8")
);

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

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

// POST /api/mentor/chat
// body: { chapter: number|null, messages: [{role:'user'|'assistant', content:string}] }
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { chapter, messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "لا توجد رسائل لإرسالها." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "المرشد الذكي غير مفعّل بعد — مفتاح الـ API غير مضبوط على السيرفر." });
    }

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 700,
        messages: [
          { role: "system", content: buildSystemPrompt(chapter) },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      console.error("OpenAI API error:", data);
      return res.status(502).json({ ok: false, error: "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية." });
    }

    const reply = ((data.choices || [])[0]?.message?.content || "").trim();
    res.json({ ok: true, reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع، حاول مرة أخرى." });
  }
});

// POST /api/mentor/speak — تحويل نص لصوت طبيعي حقيقي (مش صوت المتصفح الآلي)
// body: { text: string }  →  يرجّع ملف صوت MP3 مباشرة
router.post("/speak", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: "لا يوجد نص لتحويله لصوت." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "المرشد الذكي غير مفعّل بعد." });
    }

    const apiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_TTS_VOICE || "coral",
        input: text.slice(0, 3000),
        response_format: "mp3",
        instructions: "تكلم بنبرة مدرّس ودود، صبور، وواضح، وبسرعة معتدلة.",
      }),
    });

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      console.error("OpenAI TTS error:", errData);
      return res.status(502).json({ ok: false, error: "تعذّر توليد الصوت حاليًا." });
    }

    const audioBuffer = Buffer.from(await apiRes.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع أثناء توليد الصوت." });
  }
});

module.exports = router;
