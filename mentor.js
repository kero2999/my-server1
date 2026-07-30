/* =========================================================
   LMSMentor — المرشد الذكي: شات + تحدث صوتي
   - يظهر كفقاعة عائمة في كل صفحة فصل (وفي اللوحة لأسئلة عامة)
   - محتاج سيرفر متصل (API_BASE_URL) + ANTHROPIC_API_KEY مضبوط هناك
   - الصوت (تسجيل وتشغيل) عبر Web Speech API المدمجة في المتصفح
   ========================================================= */
(function (global) {
  const HISTORY_PREFIX = "lms_mentor_history_v1_";
  const MAX_HISTORY_MESSAGES = 16;

  function _historyKey(chapter) {
    const uname = window.LMSAuth ? window.LMSAuth.currentUsername() : "guest";
    return HISTORY_PREFIX + (uname || "guest") + "_" + (chapter || "general");
  }

  function _readHistory(chapter) {
    try { return JSON.parse(localStorage.getItem(_historyKey(chapter))) || []; }
    catch (e) { return []; }
  }
  function _writeHistory(chapter, list) {
    localStorage.setItem(_historyKey(chapter), JSON.stringify(list.slice(-MAX_HISTORY_MESSAGES)));
  }

  function _injectStyle() {
    if (document.getElementById("mentor-style")) return;
    const style = document.createElement("style");
    style.id = "mentor-style";
    style.textContent = `
      #mentor-fab{
        position:fixed;bottom:22px;right:22px;z-index:4500;
        width:58px;height:58px;border-radius:50%;
        background:linear-gradient(135deg,#ffd700,#ff6f00);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 10px 30px rgba(255,215,0,0.35);
        cursor:pointer;border:none;color:#0d1b2a;font-size:1.4rem;
        transition:transform .25s;
      }
      #mentor-fab:hover{ transform:scale(1.08); }
      #mentor-fab .mentor-dot{
        position:absolute;top:4px;right:4px;width:12px;height:12px;border-radius:50%;
        background:#00c896;border:2px solid #0d1b2a;
      }
      #mentor-panel{
        position:fixed;bottom:90px;right:22px;z-index:4500;
        width:min(380px, 92vw);height:min(560px, 72vh);
        background:#0d1b2a;border:2px solid #ffd700;border-radius:22px;
        display:none;flex-direction:column;overflow:hidden;
        box-shadow:0 25px 60px rgba(0,0,0,0.45);
        font-family:'Tajawal',sans-serif;
      }
      #mentor-panel.open{ display:flex; }
      #mentor-head{
        display:flex;align-items:center;gap:10px;padding:14px 16px;
        background:rgba(255,215,0,0.08);border-bottom:1px solid rgba(255,215,0,0.25);
        color:#fff;
      }
      #mentor-head .mh-icon{
        width:36px;height:36px;border-radius:50%;
        background:linear-gradient(135deg,#ffd700,#ff6f00);
        display:flex;align-items:center;justify-content:center;color:#0d1b2a;font-size:1rem;
      }
      #mentor-head .mh-title{font-weight:800;font-size:0.92rem;}
      #mentor-head .mh-sub{font-size:0.72rem;color:rgba(255,255,255,0.5);}
      #mentor-head .mh-close{margin-inline-start:auto;background:none;border:none;color:rgba(255,255,255,0.6);font-size:1.1rem;cursor:pointer;}
      #mentor-messages{
        flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;
      }
      .mentor-msg{max-width:85%;padding:11px 14px;border-radius:14px;font-size:0.86rem;line-height:1.7;white-space:pre-wrap;}
      .mentor-msg.user{align-self:flex-start;background:rgba(255,215,0,0.14);color:#fff;border-bottom-left-radius:4px;}
      .mentor-msg.assistant{align-self:flex-end;background:rgba(255,255,255,0.06);color:#fff;border-bottom-right-radius:4px;display:flex;flex-direction:column;gap:8px;}
      .mentor-msg.assistant .mentor-speak{
        align-self:flex-start;background:none;border:1px solid rgba(255,215,0,0.4);color:#ffd700;
        border-radius:20px;padding:4px 10px;font-size:0.7rem;cursor:pointer;
      }
      .mentor-typing{align-self:flex-end;color:rgba(255,255,255,0.5);font-size:0.8rem;}
      #mentor-input-row{
        display:flex;align-items:center;gap:8px;padding:12px;border-top:1px solid rgba(255,215,0,0.2);
      }
      #mentor-input{
        flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
        border-radius:20px;padding:10px 14px;color:#fff;font-size:0.85rem;outline:none;font-family:'Tajawal',sans-serif;
      }
      .mentor-icon-btn{
        width:38px;height:38px;border-radius:50%;border:none;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.95rem;
      }
      .mentor-icon-btn.mic{ background:rgba(255,255,255,0.08); color:#fff; }
      .mentor-icon-btn.mic.recording{ background:#ff5252; color:#fff; animation:mentorPulse 1s infinite; }
      .mentor-icon-btn.send{ background:linear-gradient(135deg,#ffd700,#ff6f00); color:#0d1b2a; }
      @keyframes mentorPulse{0%,100%{opacity:1;}50%{opacity:0.6;}}
      #mentor-locked{padding:22px;text-align:center;color:rgba(255,255,255,0.6);font-size:0.85rem;line-height:1.8;}
      @media (max-width:480px){ #mentor-panel{ right:10px; bottom:80px; } #mentor-fab{ right:14px; bottom:14px; } }
    `;
    document.head.appendChild(style);
  }

  function _buildPanel(chapter) {
    const panel = document.createElement("div");
    panel.id = "mentor-panel";
    panel.innerHTML = `
      <div id="mentor-head">
        <div class="mh-icon"><i class="fas fa-robot"></i></div>
        <div>
          <div class="mh-title">المرشد الذكي</div>
          <div class="mh-sub">${chapter ? "بيشرحلك محتوى الفصل ده خطوة بخطوة" : "اسأل أي سؤال عن الكورس"}</div>
        </div>
        <button class="mh-close" id="mentor-close-btn"><i class="fas fa-xmark"></i></button>
      </div>
      <div id="mentor-messages"></div>
      <div id="mentor-input-row">
        <button class="mentor-icon-btn mic" id="mentor-mic-btn" title="تحدث"><i class="fas fa-microphone"></i></button>
        <input type="text" id="mentor-input" placeholder="اكتب سؤالك هنا...">
        <button class="mentor-icon-btn send" id="mentor-send-btn"><i class="fas fa-paper-plane"></i></button>
      </div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function _renderMessage(container, role, text) {
    const div = document.createElement("div");
    div.className = "mentor-msg " + role;
    if (role === "assistant") {
      const p = document.createElement("div");
      p.textContent = text;
      const speakBtn = document.createElement("button");
      speakBtn.className = "mentor-speak";
      speakBtn.innerHTML = '<i class="fas fa-volume-high"></i> استماع';
      speakBtn.onclick = function () { LMSMentor.speak(text); };
      div.appendChild(p);
      div.appendChild(speakBtn);
    } else {
      div.textContent = text;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ar-SA";
    utter.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang && v.lang.startsWith("ar"));
    if (arVoice) utter.voice = arVoice;
    window.speechSynthesis.speak(utter);
  }

  async function sendMessage(chapter, text, messagesEl) {
    if (!text.trim()) return;
    const history = _readHistory(chapter);
    history.push({ role: "user", content: text });
    _writeHistory(chapter, history);
    _renderMessage(messagesEl, "user", text);

    const typing = document.createElement("div");
    typing.className = "mentor-typing";
    typing.textContent = "المرشد بيكتب...";
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const token = localStorage.getItem("lms_token_v1");
      const res = await fetch(API_BASE_URL + "/api/mentor/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ chapter, messages: history }),
      });
      const data = await res.json();
      typing.remove();
      if (!data.ok) {
        _renderMessage(messagesEl, "assistant", "⚠️ " + (data.error || "حصل خطأ، حاول تاني."));
        return;
      }
      history.push({ role: "assistant", content: data.reply });
      _writeHistory(chapter, history);
      _renderMessage(messagesEl, "assistant", data.reply);
    } catch (e) {
      typing.remove();
      _renderMessage(messagesEl, "assistant", "⚠️ تعذّر الاتصال بالمرشد الذكي، تأكد من اتصالك بالإنترنت.");
    }
  }

  function setupVoiceInput(inputEl, micBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.style.display = "none";
      return;
    }
    const recognizer = new SpeechRecognition();
    recognizer.lang = "ar-SA";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    let listening = false;

    micBtn.addEventListener("click", function () {
      if (listening) { recognizer.stop(); return; }
      recognizer.start();
    });
    recognizer.onstart = function () { listening = true; micBtn.classList.add("recording"); };
    recognizer.onend = function () { listening = false; micBtn.classList.remove("recording"); };
    recognizer.onerror = function () { listening = false; micBtn.classList.remove("recording"); };
    recognizer.onresult = function (e) {
      const transcript = e.results[0][0].transcript;
      inputEl.value = transcript;
    };
  }

  function mount(chapter) {
    if (!window.LMSAuth || !window.LMSAuth.isLoggedIn()) return; // المرشد للمشتركين فقط

    _injectStyle();
    const fab = document.createElement("button");
    fab.id = "mentor-fab";
    fab.innerHTML = '<i class="fas fa-comment-dots"></i><span class="mentor-dot"></span>';
    document.body.appendChild(fab);

    let panel = null;

    fab.addEventListener("click", function () {
      if (!panel) {
        panel = _buildPanel(chapter);
        const messagesEl = panel.querySelector("#mentor-messages");
        const input = panel.querySelector("#mentor-input");
        const sendBtn = panel.querySelector("#mentor-send-btn");
        const micBtn = panel.querySelector("#mentor-mic-btn");
        const closeBtn = panel.querySelector("#mentor-close-btn");

        if (!window.LMSAuth.isRemote()) {
          messagesEl.innerHTML =
            '<div id="mentor-locked"><i class="fas fa-plug-circle-xmark" style="font-size:1.6rem;color:#ffd700;margin-bottom:10px;display:block;"></i>' +
            "المرشد الذكي محتاج السيرفر الحقيقي شغال ومربوط (راجع js/config.js وserver/README.md).</div>";
          panel.querySelector("#mentor-input-row").style.display = "none";
        } else {
          const history = _readHistory(chapter);
          if (history.length === 0) {
            _renderMessage(
              messagesEl,
              "assistant",
              chapter
                ? "أهلاً! أنا هنا أساعدك تفهم الفصل ده أول بأول. قولّي أنهي جزء مش واضح ليك، أو ابدأ واسألني أي سؤال 🙂"
                : "أهلاً! اسألني في أي حاجة في الكورس، أو قولّي عايز تراجع أنهي فصل."
            );
          } else {
            history.forEach((m) => _renderMessage(messagesEl, m.role, m.content));
          }
          setupVoiceInput(input, micBtn);
          sendBtn.addEventListener("click", function () {
            const text = input.value;
            input.value = "";
            sendMessage(chapter, text, messagesEl);
          });
          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
              const text = input.value;
              input.value = "";
              sendMessage(chapter, text, messagesEl);
            }
          });
        }

        closeBtn.addEventListener("click", function () { panel.classList.remove("open"); });
      }
      panel.classList.toggle("open");
    });
  }

  global.LMSMentor = { mount, speak };
})(window);
