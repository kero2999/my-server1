const express = require("express");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");
const { PROJECT_PROMPTS } = require("../mentor-projects");
const supabase = require("../db");

const router = express.Router();

const COURSE_CONTENT = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "data",
      "course-content.json"
    ),
    "utf-8"
  )
);

const MODEL =
  process.env.OPENAI_MODEL || "gpt-5-mini";

const TRIAL_MESSAGE_LIMIT = 3;


/* =========================================================
   KERO SYSTEM PROMPT
   ========================================================= */

function buildSystemPrompt(chapterNum) {

  const chapter =
    COURSE_CONTENT[String(chapterNum)];

  const project =
    PROJECT_PROMPTS[String(chapterNum)];

  const courseOutline =
    Object.keys(COURSE_CONTENT)
      .sort(
        (a, b) =>
          Number(a) - Number(b)
      )
      .map(
        (n) =>
          `الفصل ${n}: ${COURSE_CONTENT[n].title}`
      )
      .join("\n");


  const chapterBlock = chapter

    ? `عنوان الفصل الحالي اللي الطالب فاتحه دلوقتي: ${chapter.title}

محتوى الفصل ده:
${chapter.content}`

    : "الطالب مش داخل فصل محدد دلوقتي (بيسألك من اللوحة العامة). لو سأل عن فصل معيّن بالاسم أو الرقم، استخدم قائمة الفصول فوق دي عشان تعرف بيقصد إيه.";


  return `

# هويتك

إنت Kero، المدرب الذكي الشخصي للطالب داخل منصة "4 Levels" لتعليم التسويق والتسويق الرقمي.

هدفك مش مجرد إعطاء إجابات، بل تحويل المعرفة إلى:
فهم + تفكير + تطبيق عملي.

مبدؤك:
"مش مهم تحفظ المعلومة… المهم تعرف تستخدمها."

إنت دائمًا Kero، مرشد كورس 4 Levels التسويقي تحديدًا.

ممنوع تسأل الطالب:
"عن أنهي كورس بتتكلم؟"
أو:
"اسم الكورس إيه؟"


# قائمة فصول الكورس

${courseOutline}


# شخصيتك

كن:

- ذكي وعملي.
- ودود وصبور.
- واثق ومباشر.
- مشجع بدون مبالغة.
- بسيط في الشرح.
- قريب من الطالب كمدرب حقيقي.

لا تكن:

- متعالي.
- رسمي بشكل مبالغ فيه.
- كثير الكلام بدون فائدة.
- مجرد Chatbot يعطي إجابات جاهزة.


# أسلوب اللغة

استخدم العربية المصرية البسيطة.

يمكنك استخدام المصطلحات التسويقية الإنجليزية الشائعة مثل:

Buyer Persona
Target Audience
Branding
Funnel
CTA
Conversion
Marketing Strategy

وأول مرة تستخدم مصطلح مهم، اشرح معناه ببساطة.


# طريقة الشرح

لما تشرح مفهوم جديد:

1. اشرحه ببساطة.
2. هات مثال واقعي.
3. اربطه بالتسويق.
4. لو مناسب، اطلب من الطالب يطبقه.

ركز على الفهم والتطبيق وليس الحفظ.


# عند الخطأ

لا تحبط الطالب.

استخدم أسلوبًا مثل:

"قريب جدًا، بس فيه نقطة محتاجة تتظبط."

ثم:

- وضح الخطأ.
- اشرح السبب.
- أعط المثال الصحيح.
- ساعد الطالب يحاول مرة أخرى.


# عند عدم الفهم

لو الطالب قال:

"مش فاهم"

لا تكرر نفس الشرح.

غيّر الطريقة باستخدام:

- مثال من الحياة اليومية.
- تشبيه.
- مقارنة.
- خطوات أبسط.


# الاختبارات

لو الطالب بيتعلم:
جاوبه وساعده يفهم.

لو بيحل اختبار:
ممنوع تعطيه الإجابة مباشرة.

استخدم تلميحًا أو سؤالًا يقوده للإجابة.

مثال:

"مش هقولك الإجابة مباشرة 😉
خلينا نفكر فيها خطوة خطوة."


# التطبيق العملي

اربط المفاهيم دائمًا بالسوق الحقيقي.

استخدم أمثلة مثل:

- براند ملابس.
- متجر إلكتروني.
- مطعم.
- تطبيق.
- كورس أونلاين.
- شركة سياحة.
- مشروع صغير.


# عند عرض فكرة مشروع

لا تكتفي بالمدح.

حلل مع الطالب:

- المشكلة.
- العميل المستهدف.
- القيمة المقترحة.
- المنافسين.
- التسعير.
- التسويق.
- نقاط القوة.
- نقاط الضعف.

كن صريحًا ولكن بناءً.


# محتوى الكورس

محتوى الفصل المقدم لك هو المصدر الأساسي للإجابة.

لا تخترع معلومات أو دروسًا غير موجودة في المحتوى.

إذا لم تكن متأكدًا من معلومة:
لا تختلقها.


# مستوى الطالب

مبتدئ:
شرح أبسط + أمثلة أكثر.

متوسط:
شرح + تطبيق.

متقدم:
تحليل + استراتيجية + حالات عملية.


# أسلوب الرد

كن مختصرًا عندما يكون السؤال بسيطًا.

توسع فقط عندما يحتاج الموضوع.

استخدم:

- نقاط.
- عناوين قصيرة.
- فقرات قصيرة.

لا تكرر نفس الكلام.

لا تسأل أسئلة غير ضرورية.

لا تنهِ كل رد بعبارة:
"هل تريد مني مساعدتك؟"

إذا كانت هناك خطوة عملية منطقية:
انتقل إليها مباشرة.


# المشروع التطبيقي

عندما تشعر أن الطالب استوعب الأفكار الأساسية، اطلب منه المشروع التطبيقي التالي:

"${project || "اكتب ملخصًا بكلماتك لأهم فكرتين في الفصل."}"

وعندما يرسل الحل:

إذا كان فاهمًا:
قل له بوضوح:

"تمام، واضح إنك فاهم الفكرة 👏"

ثم شجعه يكمل.

إذا كان الفهم ناقصًا:
وضح له ما ينقصه بلطف واطلب منه تحسين إجابته.


# قواعد أساسية

دائمًا:

- علّم.
- بسّط.
- طبّق.
- صحح.
- شجع التفكير.
- اربط النظرية بالواقع.

لا:

- تختلق معلومات.
- تعطي إجابات الاختبارات مباشرة.
- تحبط الطالب.
- تبالغ في المدح.
- تستخدم لغة معقدة بدون داعٍ.
- تتظاهر أنك إنسان حقيقي.


# الهدف النهائي

تخلي الطالب ينتقل من:

"أنا حفظت المعلومة"

إلى:

"أنا فهمت المعلومة وأقدر أستخدمها بنفسي."


${chapterBlock}
`;
}


/* =========================================================
   OPENAI CHAT
   ========================================================= */

async function callMentorModel(
  chapter,
  messages
) {

  const apiRes =
    await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            "Bearer " +
            process.env.OPENAI_API_KEY,
        },

        body: JSON.stringify({

          model: MODEL,

          max_completion_tokens: 300,

          /*
           مهم:
           تم حذف reasoning_effort
           لأنها كانت سبب الخطأ في اللوج.
          */

          messages: [

            {
              role: "system",
              content:
                buildSystemPrompt(
                  chapter
                ),
            },

            ...messages.map(
              (m) => ({
                role: m.role,
                content: m.content,
              })
            ),
          ],
        }),
      }
    );


  const data =
    await apiRes.json();


  if (!apiRes.ok) {

    console.error(
      "OpenAI API error:",
      data
    );

    throw new Error(
      "upstream_error"
    );
  }


  const reply =
    (
      data.choices || []
    )[0]?.message?.content
      ?.trim() || "";


  if (!reply) {

    console.warn(
      "Empty reply from model:",
      JSON.stringify(
        data
      ).slice(0, 500)
    );

    throw new Error(
      "empty_reply"
    );
  }


  return reply;
}


/* =========================================================
   CHAT
   ========================================================= */

router.post(
  "/chat",
  requireAuth,
  async (req, res) => {

    try {

      const {
        chapter,
        messages
      } = req.body;


      if (
        !Array.isArray(
          messages
        ) ||
        messages.length === 0
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              "لا توجد رسائل لإرسالها.",
          });
      }


      if (
        !process.env.OPENAI_API_KEY
      ) {

        return res
          .status(500)
          .json({
            ok: false,
            error:
              "المرشد الذكي غير مفعّل بعد — مفتاح الـ API غير مضبوط على السيرفر.",
          });
      }


      const reply =
        await callMentorModel(
          chapter,
          messages
        );


      res.json({
        ok: true,
        reply,
      });


    } catch (e) {

      console.error(e);


      if (
        e.message ===
          "empty_reply" ||
        e.message ===
          "upstream_error"
      ) {

        return res
          .status(502)
          .json({
            ok: false,
            error:
              "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية.",
          });
      }


      res
        .status(500)
        .json({
          ok: false,
          error:
            "حصل خطأ غير متوقع، حاول مرة أخرى.",
        });
    }
  }
);


/* =========================================================
   TRIAL CHAT
   ========================================================= */

router.post(
  "/trial-chat",
  async (req, res) => {

    try {

      const sessionId =
        req.headers[
          "x-trial-session"
        ];


      if (
        !sessionId ||
        typeof sessionId !==
          "string"
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              "جلسة معاينة غير صالحة.",
          });
      }


      const {
        chapter,
        messages
      } = req.body;


      if (
        !Array.isArray(
          messages
        ) ||
        messages.length === 0
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              "لا توجد رسائل لإرسالها.",
          });
      }


      if (
        !process.env.OPENAI_API_KEY
      ) {

        return res
          .status(500)
          .json({
            ok: false,
            error:
              "المرشد الذكي غير مفعّل بعد.",
          });
      }


      const {
        data: existing
      } =
        await supabase
          .from(
            "trial_mentor_usage"
          )
          .select(
            "message_count"
          )
          .eq(
            "session_id",
            sessionId
          )
          .maybeSingle();


      const currentCount =
        existing
          ? existing.message_count
          : 0;


      if (
        currentCount >=
        TRIAL_MESSAGE_LIMIT
      ) {

        return res
          .status(403)
          .json({

            ok: false,

            limitReached: true,

            error:
              "خلصت رسائلك المجانية مع المرشد الذكي — سجّل حساب كامل للمتابعة من غير حدود.",
          });
      }


      const reply =
        await callMentorModel(
          chapter,
          messages
        );


      if (existing) {

        await supabase
          .from(
            "trial_mentor_usage"
          )
          .update({
            message_count:
              currentCount + 1,
          })
          .eq(
            "session_id",
            sessionId
          );

      } else {

        await supabase
          .from(
            "trial_mentor_usage"
          )
          .insert({
            session_id:
              sessionId,

            message_count: 1,
          });
      }


      res.json({

        ok: true,

        reply,

        remaining:
          TRIAL_MESSAGE_LIMIT -
          (currentCount + 1),
      });


    } catch (e) {

      console.error(e);


      if (
        e.message ===
          "empty_reply" ||
        e.message ===
          "upstream_error"
      ) {

        return res
          .status(502)
          .json({
            ok: false,
            error:
              "تعذّر الوصول للمرشد الذكي حاليًا، حاول بعد شوية.",
          });
      }


      res
        .status(500)
        .json({
          ok: false,
          error:
            "حصل خطأ غير متوقع، حاول مرة أخرى.",
        });
    }
  }
);


/* =========================================================
   KERO TEXT TO SPEECH
   ========================================================= */

router.post(
  "/speak",
  requireAuth,
  async (req, res) => {

    try {

      const { text } =
        req.body;


      if (
        !text ||
        !text.trim()
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              "لا يوجد نص لتحويله لصوت.",
          });
      }


      if (
        !process.env.OPENAI_API_KEY
      ) {

        return res
          .status(500)
          .json({
            ok: false,
            error:
              "المرشد الذكي غير مفعّل بعد.",
          });
      }


      const ttsModel =
        process.env.OPENAI_TTS_MODEL ||
        "gpt-4o-mini-tts";


      const ttsVoice =
        process.env.OPENAI_TTS_VOICE ||
        "ash";


      const ttsBody = {

        model:
          ttsModel,

        voice:
          ttsVoice,

        input:
          text.slice(0, 3000),

        response_format:
          "mp3",
      };


      /*
       تعليمات الصوت:
       رجل + مدرس تسويق + ودود + واضح
      */

      if (
        ttsModel ===
        "gpt-4o-mini-tts"
      ) {

        ttsBody.instructions =
          "Speak as a male Arabic marketing instructor named Kero. Use a warm, confident, friendly and professional male voice. Speak clearly at a moderate pace. Sound like a helpful personal mentor, not like a robot.";
      }


      const apiRes =
        await fetch(
          "https://api.openai.com/v1/audio/speech",
          {
            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              Authorization:
                "Bearer " +
                process.env.OPENAI_API_KEY,
            },

            body:
              JSON.stringify(
                ttsBody
              ),
          }
        );


      if (!apiRes.ok) {

        const errData =
          await apiRes
            .json()
            .catch(
              () => ({})
            );


        console.error(
          "OpenAI TTS error:",
          errData
        );


        return res
          .status(502)
          .json({
            ok: false,
            error:
              "تعذّر توليد الصوت حاليًا.",
          });
      }


      const audioBuffer =
        Buffer.from(
          await apiRes.arrayBuffer()
        );


      res.set(
        "Content-Type",
        "audio/mpeg"
      );


      res.send(
        audioBuffer
      );


    } catch (e) {

      console.error(
        "Kero TTS error:",
        e
      );


      res
        .status(500)
        .json({
          ok: false,
          error:
            "حصل خطأ غير متوقع أثناء توليد الصوت.",
        });
    }
  }
);


module.exports = router;
