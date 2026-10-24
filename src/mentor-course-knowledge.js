const crypto = require('node:crypto');
const SLUGS = ['marketing-launch', 'marketing-growth', 'marketing-mastery', 'marketing-leadership'];

function safePath(value) {
  const path = String(value || '').replace(/\\/g, '/');
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':'))) throw new Error('invalid_knowledge_path');
  return path;
}

function decodeText(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? whole;
    const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
  });
}

function extractLessonText(html) {
  let value = String(html);
  if (Buffer.byteLength(value) > 5 * 1024 * 1024) throw new Error('knowledge_html_too_large');
  value = value.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const main = value.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i);
  const slides = value.match(/<div\b[^>]*id=["']slidesContainer["'][^>]*>([\s\S]*)/i);
  if (!main && !slides) throw new Error('knowledge_lesson_container_missing');
  value = (main || slides)[1];
  value = value.replace(/<(nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  value = decodeText(value.replace(/<[^>]*>/g, '\n')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  if (value.length < 300 || value.length > 100000) throw new Error('knowledge_text_invalid');
  return value;
}

// Fetch pointers afresh on every request: an upload changes the active version immediately.
// Only current-course chapter text is downloaded; other levels contribute published titles only.
async function loadCourseKnowledge(db, slug, chapter) {
  if (!SLUGS.includes(slug) || !Number.isInteger(chapter) || chapter < 1 || chapter > 12) throw new Error('invalid_knowledge_context');
  const { data: courses, error } = await db.from('courses').select('id,slug,title,status,entry_file,content_bucket,content_prefix,current_version_id').in('slug', SLUGS).eq('status', 'published');
  if (error) throw error;
  const course = (courses || []).find(c => c.slug === slug);
  if (!course?.current_version_id || !course.content_bucket || !course.content_prefix) throw new Error('active_knowledge_unavailable');
  const { data: version, error: versionError } = await db.from('course_versions').select('id,course_id,storage_bucket,storage_prefix,manifest').eq('id', course.current_version_id).maybeSingle();
  if (versionError) throw versionError;
  if (!version || String(version.course_id) !== String(course.id) || version.storage_bucket !== course.content_bucket || version.storage_prefix !== course.content_prefix) throw new Error('knowledge_version_mismatch');
  const { data: lessons, error: lessonError } = await db.from('lessons').select('course_id,title,position').in('course_id', courses.map(c => c.id)).order('position', { ascending: true });
  if (lessonError) throw lessonError;
  const outline = courses.map(c => ({ slug: c.slug, title: c.title, level: SLUGS.indexOf(c.slug) + 1, chapters: (lessons || []).filter(l => String(l.course_id) === String(c.id) && Number.isInteger(Number(l.position)) && Number(l.position) >= 1 && Number(l.position) <= 12).map(l => ({ number: Number(l.position), title: l.title })) }));
  const title = outline.find(c => c.slug === slug)?.chapters.find(c => c.number === chapter)?.title;
  if (!title) throw new Error('knowledge_chapter_missing');
  const files = (version.manifest?.files || []).map(String);
  const entry = safePath(course.entry_file);
  const directory = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '';
  const filename = `${directory}ch${chapter}.html`;
  if (!files.includes(filename)) throw new Error('knowledge_chapter_file_missing');
  const storagePath = `${safePath(course.content_prefix)}/${safePath(filename)}`;
  const { data: file, error: fileError } = await db.storage.from(course.content_bucket).download(storagePath);
  if (fileError || !file) throw new Error('knowledge_download_failed');
  if (file.size > 5 * 1024 * 1024) throw new Error('knowledge_html_too_large');
  const html = await file.text();
  const content = extractLessonText(html);
  // Check the pointer after download so a mid-request upload cannot quietly bind an old lesson.
  const { data: latest, error: latestError } = await db.from('courses').select('current_version_id,content_bucket,content_prefix,entry_file').eq('id', course.id).maybeSingle();
  if (latestError) throw latestError;
  if (!latest || latest.current_version_id !== course.current_version_id || latest.content_bucket !== course.content_bucket || latest.content_prefix !== course.content_prefix || latest.entry_file !== course.entry_file) throw new Error('knowledge_changed_during_read');
  return { courseSlug: slug, chapter, title, versionId: course.current_version_id, file: filename, sha256: crypto.createHash('sha256').update(html).digest('hex'), content, outline };
}

module.exports = { loadCourseKnowledge, extractLessonText, safePath };
