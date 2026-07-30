/* =========================================================
   LMSUi — shared UI helpers (search, toast, user chip)
   ========================================================= */
(function (global) {
  function showToast(message, ms) {
    let el = document.getElementById("lms-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "lms-toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms || 2600);
  }

  function renderUserChip(containerEl) {
    const user = global.LMSAuth.currentUser();
    if (!user || !containerEl) return;
    const initial = user.fullName.trim().charAt(0).toUpperCase();
    containerEl.innerHTML =
      '<div class="user-chip">' +
      '<div class="avatar">' + initial + "</div>" +
      '<span class="uname">' + user.fullName + "</span>" +
      '<a href="#" class="logout-link" id="lms-logout-btn">خروج</a>' +
      "</div>";
    document.getElementById("lms-logout-btn").addEventListener("click", function (e) {
      e.preventDefault();
      global.LMSAuth.logout();
    });
  }

  function initSearch(inputEl, resultsEl) {
    if (!inputEl || !resultsEl || typeof SEARCH_INDEX === "undefined") return;

    function close() {
      resultsEl.classList.remove("show");
      resultsEl.innerHTML = "";
    }

    function run(query) {
      query = query.trim();
      if (query.length < 2) {
        close();
        return;
      }
      const q = query.toLowerCase();
      const matches = SEARCH_INDEX.filter(
        (item) =>
          item.heading.toLowerCase().includes(q) ||
          item.snippet.toLowerCase().includes(q) ||
          item.chapterTitle.toLowerCase().includes(q)
      ).slice(0, 12);

      if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="search-empty">لا توجد نتائج مطابقة لـ "' + query + '"</div>';
        resultsEl.classList.add("show");
        return;
      }

      resultsEl.innerHTML = matches
        .map(function (m) {
          return (
            '<a class="search-result-item" href="ch' + m.chapter + '.html?slide=' + m.slide + '">' +
            '<div class="sr-chapter">الفصل ' + m.chapter + ' — ' + m.chapterTitle + "</div>" +
            '<div class="sr-title">' + m.heading + "</div>" +
            '<div class="sr-snippet">' + m.snippet + "…</div>" +
            "</a>"
          );
        })
        .join("");
      resultsEl.classList.add("show");
    }

    inputEl.addEventListener("input", function () {
      run(inputEl.value);
    });
    inputEl.addEventListener("focus", function () {
      if (inputEl.value.trim().length >= 2) run(inputEl.value);
    });
    document.addEventListener("click", function (e) {
      if (!resultsEl.contains(e.target) && e.target !== inputEl) close();
    });
  }

  global.LMSUi = { showToast, renderUserChip, initSearch };
})(window);
