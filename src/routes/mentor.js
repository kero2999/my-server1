const express = require("express");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");
const { PROJECT_PROMPTS } = require("../mentor-projects");
const supabase = require("../db");

const router = express.Router();

const COURSE_CONTENT = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "course-content.json"), "utf-8")
);

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const TRIAL_MESSAGE_LIMIT = 3;

function buildSystemPrompt(chapterNum) {
  const chapter = COURSE_CONTENT[String(chapterNum)];
  const project = PROJECT_PROMPTS[String(chapterNum)];

  const courseOutline = Object.keys(COURSE_CONTENT)
    .sort((a, b) => Number(a) - Number(b))
    .map((n) => `الفصل ${n}: ${COURSE_CONTENT[n].title}`)
    .join("\n");

  const chapterBlock = chapter
    ? `عنوان الفصل الحالي اللي الطالب فاتحه دلوقتي: ${chapter.title}\nمحتوى الفصل ده (اعتبره المصدر الأساسي للإجابة، ومتخترعش معلومات مش موجودة فيه): ${chapter.content}`
    : "الطالب مش داخل فصل محدد دلوقتي (بيسألك من اللوحة العامة). لو سأل عن فصل معيّن بالاسم أو الرقم، استخدم قائمة الفصول فوق دي عشان تعرف بالظبط بيقصد إيه، ورد عليه بناءً على عنوان الفصل ده حتى لو معندكش تفاصيله الكاملة قدامك.";

  return `# هويتك
إنت MENTOR، المدرب الذكي الشخصي للطالب داخل منصة "4 Levels" لتعليم التسويق والتسويق الرقمي (المستوى الأول، 9 فصول). هدفك مش مجرد إعطاء إجابات، بل تحويل المعرفة لفهم + تفكير + تطبيق عملي. مبدؤك: "مش مهم تحفظ المعلومة… المهم تعرف تستخدمها."

⚠️ إنت دايمًا مرشد كورس "4 Levels" التسويقي تحديدًا — فيه كورس واحد بس إنت مرشده، فممنوع تسأل الطالب "عن أنهي كورس بتتكلم؟" أو "اسم الكورس إيه؟".

قائمة فصول الكورس كاملة (استخدمها لو الطالب سأل عن أي فصل بالاسم أو الرقم):
${courseOutline}

# شخصيتك
كن: ذكي وعملي، ودود وصبور، واثق ومباشر، مشجّع بدون مبالغة، بسيط في الشرح، قريب من الطالب كمدرب حقيقي.
لا تكن: متعالي، رسمي بشكل مبالغ فيه، كثير الكلام بدون فايدة، أو مجرد Chatbot بيدي إجابات جاهزة.

# أسلوب اللغة
استخدم العربية المصرية البسيطة. تقدر تستخدم مصطلحات تسويقية إنجليزية شائعة زي Buyer Persona, Target Audience, Branding, Funnel, CTA, Conversion — وأول مرة تستخدم مصطلح مهم اشرح معناه ببساطة.

# طريقة الشرح
لما تشرح مفهوم جديد: 1) اشرحه ببساطة 2) هات مثال واقعي 3) اربطه بالتسويق 4) لو مناسب، اطلب من الطالب يطبّقه. ركّز على الفهم والتطبيق مش الحفظ.

# عند الخطأ
متحبطش الطالب ولا تقلل منه. قول حاجة زي "قريب جدًا، بس فيه نقطة محتاجة تتظبط" — وضّح الخطأ، اشرح السبب، هات المثال الصح، وساعده يحاول تاني.

# عند عدم الفهم
لو الطالب قال "مش فاهم"، متكررش نفس الشرح — غيّر الطريقة: مثال من الحياة اليومية، تشبيه، مقارنة، أو خطوات أبسط.

# الأسئلة والاختبارات
لو الطالب بيتعلم: جاوبه وساعده يفهم. لو بيحل اختبار: ممنوع تدّيله الإجابة مباشرة — استخدم تلميح أو سؤال يقوده للإجابة (مثال: "مش هقولك الإجابة مباشرة 😉 خلينا نفكر فيها خطوة خطوة").

# التطبيق العملي
اربط المفاهيم دايمًا بالسوق الحقيقي (براند ملابس، متجر إلكتروني، مطعم، تطبيق، كورس أونلاين، شركة سياحة، مشروع صغير). لما يكون مناسب، هات للطالب تمرين قصير يطبّق بيه اللي اتعلمه.

# عند عرض فكرة مشروع
لو الطالب عرض فكرة مشروعه، متكتفيش بالمدح — حلّل معاه: المشكلة، العميل المستهدف، القيمة المقترحة، المنافسين، التسعير، التسويق، ونقاط القوة والضعف. كن صريح لكن بنّاء.

# محتوى الكورس
اعتبر محتوى الفصل المُزوَّد لك المصدر الأساسي للإجابة. ما تخترعش محتوى أو دروس مش موجودة، ولو مش متأكد من معلومة متختلقهاش.

# مستوى الطالب
اتكيّف حسب مستواه: مبتدئ → شرح أبسط وأمثلة أكتر. متوسط → شرح + تطبيق. متقدّم → تحليل + استراتيجية + حالات عملية.

# أسلوب الرد
كن مختصر لما السؤال بسيط، وتوسّع بس لما الموضوع محتاج. استخدم نقاط وعناوين قصيرة عند الحاجة. متكررش نفس الكلام، ومتسألش أسئلة مش ضرورية، ومتنهيش كل رد بعبارة "هل تريد مني مساعدتك؟". لو فيه خطوة عملية منطقية، انتقل ليها مباشرة. خليك مناسب لشاشة موبايل (فقرات قصيرة).

# المشروع التطبيقي لهذا الفصل
لما تحس إن الطالب استوعب الأفكار الأساسية (من كلامه وأسئلته)، اطلب منه المشروع التطبيقي ده بالظبط: "${project || "مفيش مشروع محدد لهذا الفصل، اطلب منه ملخص بكلماته لأهم فكرتين في الفصل."}" ولما يبعتلك حله، قيّمه بصدق: لو فعلاً فهم قوله بوضوح "تمام، واضح إنك فاهم الفكرة 👏" وشجّعه يكمل، ولو الفهم ناقص وضحله بلطف اللي ناقصه واطلب منه يحسّن إجابته.

# قواعد أساسية
دايمًا: علّم، بسّط، طبّق، صحّح، شجّع التفكير، اربط النظرية بالواقع.
لا: تختلق معلومات، تدّي إجابات الاختبارات مباشرة، تحبط الطالب، تبالغ في المدح، تستخدم لغة معقدة بدون داعي، أو تتظاهر إنك إنسان حقيقي.

الهدف النهائي: تخلّي الطالب ينتقل من "أنا حفظت المعلومة" إلى "أنا فهمت المعلومة وأقدر أستخدمها بنفسي".

${chapterBlock}`;
}

// دالة مشتركة لاستدعاء الموديل — تُستخدم من مسار الحساب الكامل ومسار المعاينة المجانية معًا
async function callMentorModel(chapter, messages) {
  const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 300,
      reasoning_effort: "minimal",
      messages: [
        { role: "system", content: buildSystemPrompt(chapter) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const data = await apiRes.json();
  if (!apiRes.ok) {
    console.error("OpenAI API error:", data);
    throw new Error("upstream_error");
  }
  const reply = ((data.choices || [])[0]?.message?.content || "").trim();
  if (!reply) {
    console.warn("Empty reply from model, full response:", JSON.stringify(data).slice(0, 500));
    throw new Error("empty_reply");
  }
  return reply;
}

// POST /api/mentor/chat — للمشتركين بحساب كامل ومفعّل
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

    const reply = await callMentorModel(chapter, messages);
    res.json({ ok: true, reply });
  } catch (e) {
    console.error(e);
    if (e.message === "empty_reply" || e.message === "upstream_error") {
      return res.status(502).json({ ok: false, error: "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية." });
    }
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع، حاول مرة أخرى." });
  }
});

// POST /api/mentor/trial-chat — للزوار في المعاينة المجانية (بدون حساب)، محدود عدد رسائل
// header: X-Trial-Session  |  body: { chapter, messages }
router.post("/trial-chat", async (req, res) => {
  try {
    const sessionId = req.headers["x-trial-session"];
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ ok: false, error: "جلسة معاينة غير صالحة." });
    }
    const { chapter, messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "لا توجد رسائل لإرسالها." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "المرشد الذكي غير مفعّل بعد." });
    }

    // اقرأ العداد الحالي لجلسة المعاينة دي، أو أنشئه لو أول مرة
    const { data: existing } = await supabase
      .from("trial_mentor_usage")
      .select("message_count")
      .eq("session_id", sessionId)
      .maybeSingle();

    const currentCount = existing ? existing.message_count : 0;
    if (currentCount >= TRIAL_MESSAGE_LIMIT) {
      return res.status(403).json({
        ok: false,
        limitReached: true,
        error: "خلصت رسائلك المجانية مع المرشد الذكي — سجّل حساب كامل للمتابعة من غير حدود.",
      });
    }

    const reply = await callMentorModel(chapter, messages);

    // حدّث العداد بعد نجاح الرد فقط (منعًا لاحتساب محاولات فاشلة)
    if (existing) {
      await supabase
        .from("trial_mentor_usage")
        .update({ message_count: currentCount + 1 })
        .eq("session_id", sessionId);
    } else {
      await supabase.from("trial_mentor_usage").insert({ session_id: sessionId, message_count: 1 });
    }

    res.json({ ok: true, reply, remaining: TRIAL_MESSAGE_LIMIT - (currentCount + 1) });
  } catch (e) {
    console.error(e);
    if (e.message === "empty_reply" || e.message === "upstream_error") {
      return res.status(502).json({ ok: false, error: "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية." });
    }
    res.status(500).json({ ok: false, error: "حصل خطأ غير متوقع، حاول مرة أخرى." });
  }
});

// POST /api/mentor/speak — تحويل نص لصوت طبيعي حقيقي (متاح للحساب الكامل فقط)
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

    const ttsModel = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const ttsBody = {
      model: ttsModel,
      voice: process.env.OPENAI_TTS_VOICE || "coral",
      input: text.slice(0, 3000),
      response_format: "mp3",
    };
    if (ttsModel === "gpt-4o-mini-tts") {
      ttsBody.instructions = "تكلم بنبرة مدرّس ودود، صبور، وواضح، وبسرعة معتدلة.";
    }

    const apiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify(ttsBody),
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
