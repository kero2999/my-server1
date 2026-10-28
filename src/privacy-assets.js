const ROOT = 'https://www.quadralevel.com';
function sanitizeLearningAssets(html) {
  let result = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => /clarity\.ms|hotjar\.com|rrweb/i.test(tag) ? '' : tag)
    .replace(/<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/gi, '')
    .replace(/@import\s+(?:url\(\s*)?["']?https?:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^;]+;/gi, '')
    .replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"'\s]+\/css\/all(?:\.min)?\.css/g, ROOT + '/css/fontawesome-local.css');
  if (!result.includes('/css/academy-v3-fonts.css')) result = result.replace(/<\/head>/i, '<link rel="stylesheet" href="' + ROOT + '/css/academy-v3-fonts.css"></head>');
  return result;
}
module.exports = { sanitizeLearningAssets };
