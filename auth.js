/* =========================================================
   LMSAuth — يعمل في وضعين تلقائيًا حسب js/config.js:

   1) وضع محلي تجريبي (API_BASE_URL = null):
      الحسابات مخزّنة في localStorage فقط، بدون تحقق من دفع حقيقي.

   2) وضع متصل بسيرفر حقيقي (API_BASE_URL = رابط السيرفر):
      تسجيل/دخول حقيقي بالإيميل + JWT، وحالة الاشتراك (status)
      بترجع من السيرفر بعد التحقق من Whop webhook.
      status: 'pending' (سجّل بس لسه ما اشتركش) | 'active' (مفعّل) | 'inactive'
   ========================================================= */
(function (global) {
  const USERS_KEY = "lms_users_v1";
  const SESSION_KEY = "lms_session_v1";
  const TOKEN_KEY = "lms_token_v1";
  const REMOTE_USER_KEY = "lms_remote_user_v1";

  function isRemote() {
    return typeof API_BASE_URL === "string" && API_BASE_URL.length > 0;
  }

  /* ---------------- Local demo mode ---------------- */
  function _readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function _writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  function _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return "h" + Math.abs(h).toString(36) + str.length;
  }

  function _localRegister(fullName, email, password) {
    fullName = (fullName || "").trim();
    email = (email || "").trim().toLowerCase();
    if (!fullName || !email || !password) return { ok: false, error: "من فضلك املأ جميع الحقول." };
    if (password.length < 4) return { ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل." };
    const users = _readUsers();
    if (users[email]) return { ok: false, error: "يوجد حساب بهذا الإيميل بالفعل." };
    users[email] = { fullName, email, passHash: _hash(password), status: "active", createdAt: new Date().toISOString() };
    _writeUsers(users);
    localStorage.setItem(SESSION_KEY, email);
    return { ok: true };
  }
  function _localLogin(email, password) {
    email = (email || "").trim().toLowerCase();
    const users = _readUsers();
    const user = users[email];
    if (!user || user.passHash !== _hash(password || "")) return { ok: false, error: "الإيميل أو كلمة المرور غير صحيحة." };
    localStorage.setItem(SESSION_KEY, email);
    return { ok: true };
  }
  function _localLogout() {
    localStorage.removeItem(SESSION_KEY);
  }
  function _localCurrentUser() {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) return null;
    const users = _readUsers();
    return users[email] || null;
  }

  /* ---------------- Remote (real backend) mode ---------------- */
  async function _remoteCall(path, body) {
    try {
      const res = await fetch(API_BASE_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: "تعذّر الاتصال بالسيرفر، تأكد من اتصالك بالإنترنت." };
    }
  }

  async function _remoteRegister(fullName, email, password) {
    const data = await _remoteCall("/api/auth/register", { fullName, email, password });
    if (data.ok) {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REMOTE_USER_KEY, JSON.stringify(data.user));
    }
    return data;
  }
  async function _remoteLogin(email, password) {
    const data = await _remoteCall("/api/auth/login", { email, password });
    if (data.ok) {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REMOTE_USER_KEY, JSON.stringify(data.user));
    }
    return data;
  }
  function _remoteLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMOTE_USER_KEY);
  }
  function _remoteCurrentUser() {
    const raw = localStorage.getItem(REMOTE_USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  async function _remoteRefreshStatus() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const res = await fetch(API_BASE_URL + "/api/auth/me", { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem(REMOTE_USER_KEY, JSON.stringify(data.user));
        return data.user;
      }
    } catch (e) { /* أوفلاين — استخدم النسخة المخزّنة محليًا */ }
    return null;
  }

  /* ---------------- Public unified API ---------------- */
  async function register(fullName, email, password) {
    return isRemote() ? _remoteRegister(fullName, email, password) : _localRegister(fullName, email, password);
  }
  async function login(email, password) {
    return isRemote() ? _remoteLogin(email, password) : _localLogin(email, password);
  }
  function logout() {
    isRemote() ? _remoteLogout() : _localLogout();
    location.href = "index.html";
  }
  function currentUser() {
    return isRemote() ? _remoteCurrentUser() : _localCurrentUser();
  }
  function currentUsername() {
    const u = currentUser();
    return u ? u.email : null;
  }
  function isLoggedIn() {
    return !!currentUser();
  }
  function isPaid() {
    const u = currentUser();
    if (!u) return false;
    if (!isRemote()) return true; // الوضع المحلي تجريبي بالكامل، مفيش تحقق دفع
    return String(u.status || "").trim().toLowerCase() === "active";
  }

  async function requireAuth() {
    if (!isLoggedIn()) { location.replace("index.html"); return; }
    if (isRemote()) {
      await _remoteRefreshStatus();
      if (!isPaid()) { location.replace("upgrade.html"); return; }
    }
  }
  function redirectIfLoggedIn() {
    if (!isLoggedIn()) return;
    location.replace(isPaid() ? "dashboard.html" : "upgrade.html");
  }

  global.LMSAuth = {
    register, login, logout,
    currentUser, currentUsername,
    isLoggedIn, isPaid,
    requireAuth, redirectIfLoggedIn,
    isRemote,
  };
})(window);

if (document.documentElement.dataset.protected === "true") {
  window.LMSAuth.requireAuth();
}
