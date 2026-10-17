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
  return result;
}
module.exports = { optimizeAuthoredHtml };
