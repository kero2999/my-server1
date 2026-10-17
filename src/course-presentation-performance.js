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
  return result;
}
module.exports = { optimizeAuthoredHtml };
