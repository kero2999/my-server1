// Only called for explicitly marked authored packages; uploaded text, diagrams and interactions stay intact.
const FONT_STYLESHEET = "https://www.quadralevel.com/css/academy-v3-fonts.css";
function optimizeAuthoredHtml(html) {
  let changed = false;
  let result = String(html).replace(/@font-face\s*\{[^}]*\}/gi, (rule) => {
    const family = rule.match(/font-family\s*:\s*(["']?)([^;"']+)\1\s*;/i);
    if (family && ["Alexandria", "Space Grotesk", "IBM Plex Sans Arabic"].includes(family[2].trim()) && /url\(\s*["']?data:font\//i.test(rule)) {
      changed = true;
      return "";
    }
    return rule;
  });
  if (changed && !result.includes(FONT_STYLESHEET)) result = result.replace(/<\/head>/i, '<link rel="stylesheet" href="' + FONT_STYLESHEET + '"></head>');
  // Reveal readable content without waiting for every image or optional resource to load.
  if (/<main\b/i.test(result) && !/id=["']ql-reader-ready["']/.test(result)) {
    const readyScript = '<script id="ql-reader-ready">(function(){if(parent===window)return;var done=false,observer;function ready(){if(done)return;var main=document.querySelector("main"),text=main&&main.querySelector("p");if(!text||!text.textContent.trim())return;done=true;if(observer)observer.disconnect();parent.postMessage({type:"ql-reader-ready"},"https://www.quadralevel.com");}observer=new MutationObserver(ready);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});document.addEventListener("DOMContentLoaded",ready,{once:true});ready();})();</script>';
    result = result.replace(/<head\b[^>]*>/i, '$&' + readyScript);
  }
  // Keep the approved mark separate from course/chapter titles; never alter lesson content.
  result = result.replace(/<header\b[^>]*class=["'][^"']*\b(?:index-top|mast|assessment-top)\b[^"']*["'][^>]*>[\s\S]*?<\/header>/gi, (header) =>
    header.replace(/<img\b[^>]*>/gi, (img) => img.replace(/\bsrc=["'][^"']*["']/i, 'src="https://www.quadralevel.com/images/quadralevel-signature-original.png"'))
  );
  if (!result.includes('id="ql-mark-only"')) result = result.replace(/<\/head>/i, '<style id="ql-mark-only">.index-top,.mast,.assessment-top{direction:rtl!important}.ql-index-brand>span{display:none!important}.index-top .ql-index-brand,.mast>.brand{order:-1!important}.index-top .ql-index-brand img,.mast>.brand>img,.assessment-top>img.logo{width:220px!important;height:60px!important;max-width:220px!important;flex-shrink:0!important;object-fit:cover!important;object-position:center!important;padding:0!important;border-radius:8px}.assessment-top>img.logo{order:-1!important}@media(max-width:600px){.index-top .ql-index-brand img,.mast>.brand>img,.assessment-top>img.logo{width:176px!important;height:48px!important}}</style></head>');
  return result;
}
module.exports = { optimizeAuthoredHtml };

