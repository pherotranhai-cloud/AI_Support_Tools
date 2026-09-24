// Chuyển file upload thành content-part cho Chat Completions
const mammoth = require('mammoth');
const JSZip = require('jszip');

const IMG = /^image\/(png|jpe?g|webp|gif)$/i;

function fixName(f) {
  // multer đọc tên file dạng latin1 → đổi sang utf8 để giữ tiếng Việt
  try { return Buffer.from(f.originalname, 'latin1').toString('utf8'); } catch { return f.originalname; }
}

async function pptxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  const out = [];
  for (const n of names) {
    const xml = await zip.file(n).async('string');
    out.push([...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' '));
  }
  return out.map((t, i) => `Slide ${i + 1}: ${t}`).join('\n');
}

/**
 * @returns {Promise<Array>} content parts
 */
async function toParts(files, label) {
  const parts = [];
  for (const f of files || []) {
    const name = fixName(f);
    const mime = (f.mimetype || '').toLowerCase();
    const ext = name.split('.').pop().toLowerCase();
    if (IMG.test(mime) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      const m = IMG.test(mime) ? mime : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      parts.push({ type: 'text', text: `[${label}: ảnh "${name}"]` });
      parts.push({ type: 'image_url', image_url: { url: `data:${m};base64,${f.buffer.toString('base64')}`, detail: 'high' } });
    } else if (mime === 'application/pdf' || ext === 'pdf') {
      parts.push({ type: 'text', text: `[${label}: PDF "${name}"]` });
      parts.push({ type: 'file', file: { filename: name, file_data: `data:application/pdf;base64,${f.buffer.toString('base64')}` } });
    } else if (ext === 'docx') {
      const { value } = await mammoth.extractRawText({ buffer: f.buffer });
      parts.push({ type: 'text', text: `[${label}: Word "${name}"]\n${value}` });
    } else if (ext === 'pptx') {
      parts.push({ type: 'text', text: `[${label}: PowerPoint "${name}"]\n${await pptxText(f.buffer)}` });
    } else {
      parts.push({ type: 'text', text: `[${label}: "${name}"]\n${f.buffer.toString('utf8').slice(0, 60000)}` });
    }
  }
  return parts;
}

module.exports = { toParts, fixName };
