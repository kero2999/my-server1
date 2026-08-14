const express = require("express");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");
const { PROJECT_PROMPTS } = require("../mentor-projects");
const supabase = require("../db");

const router = express.Router();

const COURSE_CONTENT = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "data", "course-content.json"),
    "utf-8"
  )
);

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const TRIAL_MESSAGE_LIMIT = 3;

function buildSystemPrompt(chapterNum) {
  const chapter = COURSE_CONTENT[String(chapterNum)];
  const project = PROJECT_PROMPTS[String(chapterNum)];

  const chapterBlock = chapter
    ? `عنوان الفصل الحالي: ${chapter.title}
ملخص محتوى الفصل (للاستخدام كمرجع فقط، متقراش النص ده حرفيًا للطالب):
${chapter.content}`
    : "الطالب مش داخل فصل محدد دلوقتي — ممكن يسأل سؤال عام عن الكورس.";

  return `إنت "المرشد الذكي" في منصة تعليمية لكورس التسويق والتسويق الرقمي. دورك إنك مدرّس شخصي صبور وودود بيتكلم عربي بسيط وواضح مع الطالب.

قواعد أساسية:
- اشرح خطوة بخطوة، وسؤال-سؤال — متديش محاضرة طويلة دفعة واحدة، اسأل الطالب أسئلة قصيرة كل شوية عشان تتأكد إنه فاهم قبل ما تكمل.
- لو الطالب مش فاهم جزء، بسّطه بمثال عملي قريب من حياته اليومية.
- ممنوع تجاوب على أسئلة الاختبار (Quiz) مباشرة لو حسّيت إن الطالب بيسأل عليها بالنص — وجّهه للمفهوم بدل الإجابة الجاهزة.
- لما تحس إن الطالب استوعب أفكار الفصل الأساسية (من كلامه وأسئلته)، اطلب منه المشروع التطبيقي التالي بالظبط:
"${project || "مفيش مشروع محدد لهذا الفصل، اطلب منه ملخص بكلماته لأهم فكرتين في الفصل."}"
- لما الطالب يبعتلك حل المشروع، قيّمه بصدق: لو فعلاً فهم، قوله بوضوح "تمام، واضح إنك فاهم الفكرة 👏" وشجّعه يكمل. لو الفهم ناقص، وضحله بلطف اللي ناقصه واطلب منه يحسّن إجابته.
- خليك مختصر ودافئ، وردودك مناسبة لموبايل (فقرات قصيرة).
- حاول تكون إجابتك مباشرة ومفيدة بدون حشو.

${chapterBlock}`;
}

// دالة مشتركة لاستدعاء الموديل
// تُستخدم من مسار الحساب الكامل ومسار المعاينة المجانية
async function callMentorModel(chapter, messages) {
  const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,

      // تم رفع الحد لأن 300 كان يتم استهلاكها بالكامل في reasoning
      // وبالتالي كان content يرجع فارغًا.
      max_completion_tokens: 800,

      messages: [
        {
          role: "system",
          content: buildSystemPrompt(chapter),
        },

        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    }),
  });

  const data = await apiRes.json();

  // لو OpenAI رجع خطأ HTTP
  if (!apiRes.ok) {
    console.error("========== OPENAI API ERROR ==========");
    console.error("STATUS:", apiRes.status);
    console.error("MODEL:", MODEL);
    console.error("RESPONSE:", JSON.stringify(data, null, 2));
    console.error("======================================");

    throw new Error("upstream_error");
  }

  const choice = data.choices?.[0];
  const reply = (choice?.message?.content || "").trim();

  // حماية إضافية لو رجع الرد فارغ
  if (!reply) {
    console.error("========== EMPTY MENTOR RESPONSE ==========");
    console.error("MODEL:", MODEL);
    console.error("STATUS:", apiRes.status);
    console.error("FINISH REASON:", choice?.finish_reason);
    console.error(
      "COMPLETION TOKENS:",
      data?.usage?.completion_tokens
    );
    console.error(
      "REASONING TOKENS:",
      data?.usage?.completion_tokens_details?.reasoning_tokens
    );
    console.error("FULL OPENAI RESPONSE:", JSON.stringify(data, null, 2));
    console.error("============================================");

    throw new Error("empty_reply");
  }

  return reply;
}

// ======================================================
// POST /api/mentor/chat
// للمشتركين بحساب كامل ومفعّل
// ======================================================

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { chapter, messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "لا توجد رسائل لإرسالها.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "المرشد الذكي غير مفعّل بعد — مفتاح الـ API غير مضبوط على السيرفر.",
      });
    }

    const reply = await callMentorModel(chapter, messages);

    res.json({
      ok: true,
      reply,
    });
  } catch (e) {
    console.error("Mentor /chat error:", e);

    if (
      e.message === "empty_reply" ||
      e.message === "upstream_error"
    ) {
      return res.status(502).json({
        ok: false,
        error:
          "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية.",
      });
    }

    res.status(500).json({
      ok: false,
      error: "حصل خطأ غير متوقع، حاول مرة أخرى.",
    });
  }
});

// ======================================================
// POST /api/mentor/trial-chat
// للزوار في المعاينة المجانية
// ======================================================

router.post("/trial-chat", async (req, res) => {
  try {
    const sessionId = req.headers["x-trial-session"];

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        ok: false,
        error: "جلسة معاينة غير صالحة.",
      });
    }

    const { chapter, messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "لا توجد رسائل لإرسالها.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "المرشد الذكي غير مفعّل بعد.",
      });
    }

    // اقرأ العداد الحالي لجلسة المعاينة
    const { data: existing, error: usageError } = await supabase
      .from("trial_mentor_usage")
      .select("message_count")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (usageError) {
      console.error("Trial usage read error:", usageError);
    }

    const currentCount = existing
      ? existing.message_count
      : 0;

    if (currentCount >= TRIAL_MESSAGE_LIMIT) {
      return res.status(403).json({
        ok: false,
        limitReached: true,
        error:
          "خلصت رسائلك المجانية مع المرشد الذكي — سجّل حساب كامل للمتابعة من غير حدود.",
      });
    }

    // استدعاء المرشد
    const reply = await callMentorModel(chapter, messages);

    // تحديث العداد بعد نجاح الرد فقط
    if (existing) {
      const { error: updateError } = await supabase
        .from("trial_mentor_usage")
        .update({
          message_count: currentCount + 1,
        })
        .eq("session_id", sessionId);

      if (updateError) {
        console.error("Trial usage update error:", updateError);
      }
    } else {
      const { error: insertError } = await supabase
        .from("trial_mentor_usage")
        .insert({
          session_id: sessionId,
          message_count: 1,
        });

      if (insertError) {
        console.error("Trial usage insert error:", insertError);
      }
    }

    res.json({
      ok: true,
      reply,
      remaining:
        TRIAL_MESSAGE_LIMIT - (currentCount + 1),
    });
  } catch (e) {
    console.error("Mentor /trial-chat error:", e);

    if (
      e.message === "empty_reply" ||
      e.message === "upstream_error"
    ) {
      return res.status(502).json({
        ok: false,
        error:
          "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية.",
      });
    }

    res.status(500).json({
      ok: false,
      error: "حصل خطأ غير متوقع، حاول مرة أخرى.",
    });
  }
});

// ======================================================
// POST /api/mentor/speak
// تحويل النص إلى صوت
// ======================================================

router.post("/speak", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        ok: false,
        error: "لا يوجد نص لتحويله لصوت.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "المرشد الذكي غير مفعّل بعد.",
      });
    }

    const ttsModel =
      process.env.OPENAI_TTS_MODEL ||
      "gpt-4o-mini-tts";

    const ttsBody = {
      model: ttsModel,
      voice:
        process.env.OPENAI_TTS_VOICE ||
        "coral",
      input: text.slice(0, 3000),
      response_format: "mp3",
    };

    if (ttsModel === "gpt-4o-mini-tts") {
      ttsBody.instructions =
        "تكلم بنبرة مدرّس ودود، صبور، وواضح، وبسرعة معتدلة.";
    }

    const apiRes = await fetch(
      "https://api.openai.com/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Bearer " + process.env.OPENAI_API_KEY,
        },
        body: JSON.stringify(ttsBody),
      }
    );

    if (!apiRes.ok) {
      const errData = await apiRes
        .json()
        .catch(() => ({}));

      console.error(
        "OpenAI TTS error:",
        errData
      );

      return res.status(502).json({
        ok: false,
        error: "تعذّر توليد الصوت حاليًا.",
      });
    }

    const audioBuffer = Buffer.from(
      await apiRes.arrayBuffer()
    );

    res.set("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error(
      "Mentor /speak error:",
      e
    );

    res.status(500).json({
      ok: false,
      error:
        "حصل خطأ غير متوقع أثناء توليد الصوت.",
    });
  }
});

module.exports = router;
