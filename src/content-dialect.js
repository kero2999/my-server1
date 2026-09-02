const DIALECT_RULES = {
  FUSHA: [
    ["دلوقتي", "الآن"],
    ["عشان كده", "لذلك"],
    ["عشان تاخد", "للحصول على"],
    ["عشان", "من أجل"],
    ["إزاي", "كيف"],
    ["إيه", "ماذا"],
    ["ليه", "لماذا"],
    ["أوي", "جدًا"],
    ["كمان", "أيضًا"],
    ["كتير", "كثير"],
    ["ده", "هذا"],
    ["دي", "هذه"],
    ["اللي", "الذي"],
    ["لازم", "يجب أن"],
    ["مش", "ليس"],
    ["عايزين", "نريد"],
    ["عايز", "يريد"],
    ["محتاجين", "نحتاج إلى"],
    ["محتاج", "يحتاج إلى"],
    ["بيبدأ", "يبدأ"],
    ["بتبدأ", "تبدأ"],
    ["بيقدم", "يقدم"],
    ["بتقدم", "تقدم"],
    ["بيستخدم", "يستخدم"],
    ["بتستخدم", "تستخدم"],
    ["اختار", "اختر"],
    ["اعمل", "قم بـ"],
    ["كل", "جميع"],
    ["بس", "فقط"],
  ],
  EG: [
    ["يمكنك", "تقدر"],
    ["تستطيع", "تقدر"],
    ["يستطيع", "يقدر"],
    ["تحتاج إلى", "محتاج"],
    ["يحتاج إلى", "محتاج"],
    ["نحتاج إلى", "محتاجين"],
    ["من أجل", "عشان"],
    ["للحصول على", "عشان تاخد"],
    ["لذلك", "عشان كده"],
    ["أيضًا", "كمان"],
    ["جداً", "أوي"],
    ["كثيرًا", "كتير"],
    ["كثير", "كتير"],
    ["المناسب", "المناسب"],
    ["مناسب", "مناسب"],
    ["الآن", "دلوقتي"],
    ["لماذا", "ليه"],
    ["ماذا", "إيه"],
    ["كيف", "إزاي"],
    ["هذا", "ده"],
    ["هذه", "دي"],
    ["ذلك", "ده"],
    ["تلك", "دي"],
    ["الذين", "اللي"],
    ["الذي", "اللي"],
    ["التي", "اللي"],
    ["يجب أن", "لازم"],
    ["ليس", "مش"],
    ["ليست", "مش"],
    ["يريد", "عايز"],
    ["تريد", "عايز"],
    ["نريد", "عايزين"],
    ["يبدأ", "بيبدأ"],
    ["تبدأ", "بتبدأ"],
    ["يقدم", "بيقدم"],
    ["تقدم", "بتقدم"],
    ["يستخدم", "بيستخدم"],
    ["تستخدم", "بتستخدم"],
    ["اختر", "اختار"],
    ["قم بـ", "اعمل"],
    ["بشكل", "بطريقة"],
    ["جميع", "كل"],
    ["فقط", "بس"],
    ["ولكن", "بس"],
    ["لأن", "عشان"],
  ],
  AE: [
    ["يمكنك", "تقدر"],
    ["تستطيع", "تقدر"],
    ["يستطيع", "يقدر"],
    ["من أجل", "عشان"],
    ["للحصول على", "عشان تحصل على"],
    ["لذلك", "عشان جي"],
    ["أيضًا", "بعد"],
    ["جداً", "وايد"],
    ["كثيرًا", "وايد"],
    ["كثير", "وايد"],
    ["الآن", "الحين"],
    ["لماذا", "ليش"],
    ["ماذا", "شو"],
    ["هذه", "هذي"],
    ["هذا", "هالشي"],
    ["ذلك", "هالشي"],
    ["تلك", "هذيك"],
    ["الذين", "اللي"],
    ["الذي", "اللي"],
    ["التي", "اللي"],
    ["يجب أن", "لازم"],
    ["ليس", "مو"],
    ["ليست", "مو"],
    ["يريد", "يبغي"],
    ["تريد", "تبغي"],
    ["نريد", "نبغي"],
    ["اختر", "اختَر"],
    ["فقط", "بس"],
    ["ولكن", "بس"],
    ["لأن", "لأن"],
  ],
  SA: [
    ["يمكنك", "تقدر"],
    ["تستطيع", "تقدر"],
    ["يستطيع", "يقدر"],
    ["من أجل", "عشان"],
    ["للحصول على", "عشان تحصل على"],
    ["لذلك", "عشان كذا"],
    ["أيضًا", "بعد"],
    ["جداً", "مرة"],
    ["كثيرًا", "كثير"],
    ["الآن", "الحين"],
    ["لماذا", "ليش"],
    ["ماذا", "وش"],
    ["هذه", "هذي"],
    ["ذلك", "هذاك"],
    ["تلك", "هذيك"],
    ["الذين", "اللي"],
    ["الذي", "اللي"],
    ["التي", "اللي"],
    ["يجب أن", "لازم"],
    ["ليس", "مو"],
    ["ليست", "مو"],
    ["يريد", "يبغى"],
    ["تريد", "تبغى"],
    ["نريد", "نبغى"],
    ["فقط", "بس"],
    ["ولكن", "بس"],
    ["لأن", "لأن"],
  ],
};

const DIALECT_LABELS = {
  FUSHA: "العربية الفصحى",
  EG: "العربية المصرية",
  AE: "العربية الإماراتية",
  SA: "العربية السعودية",
};

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return DIALECT_RULES[code] ? code : "";
}

function rulesFor(code) {
  return [...(DIALECT_RULES[normalizeCode(code)] || [])].sort((a, b) => b[0].length - a[0].length);
}

function rewriteContentText(code, text) {
  let output = String(text ?? "");
  for (const [source, replacement] of rulesFor(code)) output = output.split(source).join(replacement);
  return output;
}

const HTML_SKIP_TAGS = new Set(["script", "style", "noscript", "template", "textarea", "pre", "code", "svg"]);

function rewriteHtmlTextNodes(code, html) {
  const source = String(html ?? "");
  if (!source) return source;
  const tokenRe = /<!--[\s\S]*?-->|<(script|style|noscript|template|textarea|pre|code|svg)\b[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/gi;
  return source.replace(tokenRe, (token) => {
    if (token.startsWith("<!--") || /^<(script|style|noscript|template|textarea|pre|code|svg)\b/i.test(token)) return token;
    if (token.startsWith("<")) return token;
    return rewriteContentText(code, token);
  });
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function dialectPayload(country) {
  const rawCode = String(country?.countryCode || country?.country_code || "").trim().toUpperCase();
  const code = rawCode || "EG";
  return {
    countryCode: code,
    dialect: country?.dialect || DIALECT_LABELS[code] || "العربية المحلية",
    rules: rulesFor(rawCode),
  };
}

function injectContentDialect(html, country) {
  const source = String(html ?? "");
  if (!source || !country) return source;
  if (/id=(['"])ql-country-dialect\1/i.test(source)) return source;
  const payload = safeScriptJson(dialectPayload(country));
  const script = `<script id="ql-country-dialect">(function(){var payload=${payload};var rules=(payload.rules||[]).map(function(pair){return [new RegExp(pair[0].replace(/[\\\\^$.*+?()[\\]{}|]/g,"\\\\$&"),"g"),pair[1]];});function skip(node){var parent=node&&node.parentElement;return !parent||!!parent.closest("script,style,noscript,template,textarea,pre,code,svg,#ql-country-context,.ql-country-context,.mentor-topbar,.site-floatnav,[data-no-country-dialect]");}function rewrite(node){if(skip(node))return;var value=node.nodeValue||"";var next=value;rules.forEach(function(rule){next=next.replace(rule[0],rule[1]);});if(next!==value)node.nodeValue=next;}function scan(root){if(!root||!document.createTreeWalker)return;var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);var node;while((node=walker.nextNode()))rewrite(node);}function boot(){document.documentElement.setAttribute("data-ql-country-dialect",payload.countryCode);scan(document.body||document.documentElement);var root=document.body||document.documentElement;if(window.MutationObserver&&root)new MutationObserver(function(records){records.forEach(function(record){Array.prototype.forEach.call(record.addedNodes||[],function(node){if(node.nodeType===Node.TEXT_NODE)rewrite(node);else if(node.nodeType===Node.ELEMENT_NODE)scan(node);});});}).observe(root,{childList:true,subtree:true});}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();})();</script>`;
  if (/<\/body>/i.test(source)) return source.replace(/<\/body>/i, `${script}</body>`);
  if (/<\/html>/i.test(source)) return source.replace(/<\/html>/i, `${script}</html>`);
  return `${source}${script}`;
}

module.exports = {
  DIALECT_RULES,
  DIALECT_LABELS,
  rewriteContentText,
  rewriteHtmlTextNodes,
  dialectPayload,
  injectContentDialect,
};
