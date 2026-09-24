const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const JSZip = require('jszip');
const { toParts } = require('./lib/inputs');
const { analyzeExam } = require('./lib/analyze');
const { solveQ1 } = require('./lib/q1');
const { solveQ2 } = require('./lib/q2');
const { solveQ3 } = require('./lib/q3');
const oa = require('./lib/openai');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });
const jobs = new Map();
const JOB_TTL = 3 * 60 * 60 * 1000;

const MIME = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
};

const slug = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'SanPham';

// ---- Bảo vệ bằng mã truy cập (tùy chọn) ----
function codeOk(given) {
  const code = process.env.ACCESS_CODE;
  if (!code) return true;
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(code).digest();
  return crypto.timingSafeEqual(a, b);
}
function guard(req, res, next) {
  if (codeOk(req.get('x-access-code') || req.query.code)) return next();
  // chậm lại khi sai mã để chống dò mã
  setTimeout(() => res.status(401).json({ error: 'Sai hoặc thiếu mã truy cập.' }), 600);
}

app.get('/api/config', (req, res) => {
  res.json({ needCode: !!process.env.ACCESS_CODE, hasKey: !!process.env.OPENAI_API_KEY });
});

app.get('/api/verify', guard, (req, res) => res.json({ ok: true }));

app.get('/api/health', guard, async (req, res) => {
  try {
    const models = await oa.listModels();
    const pick = (cands) => cands.filter((m) => models.includes(m));
    res.json({
      ok: true,
      text: pick(oa.TEXT_MODELS()),
      image: pick(oa.IMAGE_MODELS()),
      tts: pick(oa.TTS_MODELS()),
      total: models.length,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/solve', guard, upload.fields([{ name: 'exam', maxCount: 10 }, { name: 'data', maxCount: 10 }]), async (req, res) => {
  const id = crypto.randomBytes(8).toString('hex');
  const qs = String(req.body.questions || '1,2,3').split(',').map((x) => x.trim());
  const job = {
    id,
    created: Date.now(),
    status: 'running',
    logs: [],
    steps: { analyze: 'running', q1: qs.includes('1') ? 'pending' : 'skip', q2: qs.includes('2') ? 'pending' : 'skip', q3: qs.includes('3') ? 'pending' : 'skip' },
    errors: {},
    result: {},
    files: new Map(),
  };
  jobs.set(id, job);
  res.json({ id });

  const log = (m) => { job.logs.push({ t: Date.now(), m }); console.log(`[${id}] ${m}`); };
  const addFile = (name, buf) => job.files.set(name, { buf, mime: MIME[name.split('.').pop()] || 'application/octet-stream' });

  try {
    const examParts = await toParts(req.files?.exam, 'ĐỀ');
    const dataParts = await toParts(req.files?.data, 'DỮ LIỆU CẦN TRÍCH XUẤT');
    const note = (req.body.note || '').slice(0, 4000);

    log('Đang đọc và phân tích đề…');
    const a = await analyzeExam(examParts, note);
    job.result.analysis = a;
    job.steps.analyze = 'done';
    log('Đã phân tích đề: ' + a.exam_summary);

    const tasks = [];
    if (job.steps.q1 === 'pending') {
      job.steps.q1 = 'running';
      tasks.push(solveQ1(a, log).then((r) => {
        const base = 'Cau1_Slide_' + slug(a.q1.product);
        addFile(base + '.pptx', r.pptx);
        addFile('Cau1_LoiThuyetTrinh.txt', Buffer.from(r.script, 'utf8'));
        r.audios.forEach((b, i) => b && addFile(`audio/slide${String(i + 1).padStart(2, '0')}.mp3`, b));
        job.result.q1 = {
          pptx: base + '.pptx',
          script: 'Cau1_LoiThuyetTrinh.txt',
          title: r.deck.deck_title,
          slides: r.deck.slides.map((s) => ({ title: s.title, narration: s.narration })),
          totalSeconds: r.totalSeconds,
          imageErrors: r.imageErrors.length,
        };
        job.steps.q1 = 'done';
        log(`Câu 1: ✔ xong (${r.deck.slides.length} slide, ~${r.totalSeconds}s thuyết trình)`);
      }).catch((e) => { job.steps.q1 = 'error'; job.errors.q1 = e.message; log('Câu 1: ✖ ' + e.message); }));
    }
    if (job.steps.q2 === 'pending') {
      job.steps.q2 = 'running';
      // Không có file dữ liệu riêng → dùng ảnh trong đề
      const parts = dataParts.length ? dataParts : examParts.filter((p) => p.type !== 'text' || /ảnh|PDF/.test(p.text));
      tasks.push(solveQ2(a, parts, log).then((r) => {
        addFile('Cau2_TrichXuat.xlsx', r.xlsx);
        addFile('Cau2_TrichXuat.docx', r.docx);
        job.result.q2 = { xlsx: 'Cau2_TrichXuat.xlsx', docx: 'Cau2_TrichXuat.docx', format: a.q2.output_format, data: r.data, usedExamFiles: !dataParts.length };
        job.steps.q2 = 'done';
        log('Câu 2: ✔ xong');
      }).catch((e) => { job.steps.q2 = 'error'; job.errors.q2 = e.message; log('Câu 2: ✖ ' + e.message); }));
    }
    if (job.steps.q3 === 'pending') {
      job.steps.q3 = 'running';
      tasks.push(solveQ3(a, log).then((r) => {
        const txt = `${r.prompt}\n\n----- PROMPT SỬA LỖI (dán vào khung chat của AI Studio nếu cần) -----\n${r.fix_prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n----- KỊCH BẢN DEMO -----\n${r.demo_script_vi.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`;
        addFile('Cau3_Prompt_AIStudio.txt', Buffer.from(txt, 'utf8'));
        job.result.q3 = { ...r, file: 'Cau3_Prompt_AIStudio.txt' };
        job.steps.q3 = 'done';
        log('Câu 3: ✔ xong');
      }).catch((e) => { job.steps.q3 = 'error'; job.errors.q3 = e.message; log('Câu 3: ✖ ' + e.message); }));
    }
    await Promise.all(tasks);

    if (job.files.size) {
      const zip = new JSZip();
      for (const [name, f] of job.files) zip.file(name, f.buf);
      addFile('TatCa_KetQua.zip', await zip.generateAsync({ type: 'nodebuffer' }));
    }
    job.status = Object.values(job.steps).includes('error') ? 'partial' : 'done';
    log('Hoàn tất.');
  } catch (e) {
    job.status = 'error';
    job.steps.analyze = job.steps.analyze === 'done' ? 'done' : 'error';
    job.errors.fatal = e.message;
    log('✖ Lỗi: ' + e.message);
  }
});

app.get('/api/jobs/:id', guard, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Không tìm thấy phiên (server có thể đã khởi động lại).' });
  res.json({ id: job.id, status: job.status, steps: job.steps, errors: job.errors, logs: job.logs, result: job.result, files: [...job.files.keys()].filter((n) => !n.startsWith('audio/')) });
});

app.get('/api/jobs/:id/file', guard, (req, res) => {
  const job = jobs.get(req.params.id);
  const f = job?.files.get(String(req.query.name || ''));
  if (!f) return res.status(404).send('Không có file');
  const name = path.basename(String(req.query.name));
  res.set('Content-Type', f.mime);
  res.set('Content-Disposition', `attachment; filename="${name}"`);
  res.send(f.buf);
});

// Dọn job cũ
setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.created > JOB_TTL) jobs.delete(id);
}, 10 * 60 * 1000).unref();

app.use('/prompts', guard, express.static(path.join(__dirname, 'prompts')));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('AI Exam Solver chạy tại cổng ' + PORT));
