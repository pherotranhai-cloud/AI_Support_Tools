// Tạo docs/HuongDan_ThiCDR_AI.docx — node scripts/build-guide.js [URL_WEB]
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat, PageBreak, Footer, PageNumber } = require('docx');

const WEB = process.argv[2] || 'https://<ten-service>.onrender.com';
const FONT = 'Arial';
const P = (text, opts = {}) => new Paragraph({ spacing: { after: 100 }, ...opts, children: runs(text) });
// **đậm** trong chuỗi
function runs(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true }) : new TextRun(t));
}
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const num = (ref) => (t) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: runs(t) });
const bullet = (t) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: runs(t) });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const borders = { top: border, bottom: border, left: border, right: border };
function table(head, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (t, i, h) => new TableCell({
    borders, width: { size: widths[i], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: h ? { fill: '1F4E79', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({ children: h ? [new TextRun({ text: t, bold: true, color: 'FFFFFF' })] : runs(t) })],
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: [new TableRow({ tableHeader: true, children: head.map((t, i) => cell(t, i, true)) }), ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, i, false)) }))] });
}
function box(lines) {
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: [new TableRow({ children: [new TableCell({
    borders: { top: border, bottom: border, left: { style: BorderStyle.SINGLE, size: 24, color: '2457D6' }, right: border },
    width: { size: 9360, type: WidthType.DXA }, shading: { fill: 'EEF3FD', type: ShadingType.CLEAR, color: 'auto' }, margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: lines.map((l) => new Paragraph({ spacing: { after: 60 }, children: runs(l) })) })] })] });
}
function mono(text) {
  return text.split('\n').map((l) => new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 18 })] }));
}
const prompt = (f) => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'prompts', f), 'utf8');
  return t.split('===== PROMPT (copy từ dòng dưới) =====')[1].trim();
};

const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'HƯỚNG DẪN LÀM BÀI THI', bold: true, size: 36, color: '1F4E79' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'Học phần Chuẩn đầu ra Trí tuệ nhân tạo', size: 26, color: '555555' })] }),
  box([
    '**Tóm tắt:** Mở web → dán/kéo đề vào ô ① (và ảnh cần trích xuất vào ô ②) → bấm **Giải đề** → chờ 1–3 phút → tải file Câu 1, Câu 2; Câu 3 bấm **Copy prompt & mở AI Studio** → Ctrl+V → Build.',
    `**Link web:** ${WEB}`,
    '**Dự phòng:** nếu web lỗi, dùng tab **“Làm tay (dự phòng)”** trên web hoặc mục 5 của tài liệu này.',
  ]),
  H1('1. Chuẩn bị trước giờ thi'),
  num('n1')('Mở link web, nhập **mã truy cập** (nếu được hỏi). Bấm **Kiểm tra API** → phải thấy dòng xanh “Key hoạt động”.'),
  num('n1')('Đăng nhập sẵn **tài khoản Google** trên trình duyệt (dùng cho Google AI Studio và Gemini).'),
  num('n1')('Máy có **PowerPoint** để mở/trình chiếu file slide (audio tự phát khi nhấn F5).'),
  num('n1')('Mở web trước giờ thi ~5 phút (server có thể mất ~1 phút để “thức dậy” lần đầu).'),

  H1('2. Dùng web tự động (đường chính)'),
  table(['Bước', 'Thao tác', 'Ghi chú'], [
    ['1', 'Đưa **đề thi** vào ô ① ĐỀ THI', 'Kéo thả file, bấm để chọn, hoặc chụp màn hình đề rồi bấm vào ô ① và **Ctrl+V**. Nhận ảnh, PDF, Word, TXT.'],
    ['2', 'Đưa **ảnh/PDF cần trích xuất** (câu 2) vào ô ②', 'Bấm vào ô ② trước rồi Ctrl+V để dán. Bỏ trống nếu ảnh đã nằm trong đề.'],
    ['3', '(Tùy chọn) Gõ ghi chú', 'Ví dụ: “sản phẩm là tai nghe Sony; 8 slide; app học tiếng Hàn”.'],
    ['4', 'Bấm **Giải đề**', 'Theo dõi tiến độ. Đủ 3 câu thường 1–3 phút.'],
    ['5', 'Tải kết quả', 'Từng file hoặc **Tải tất cả (.zip)**. Đọc các khung vàng (cảnh báo theo đề) nếu có.'],
  ], [900, 3200, 5260]),
  P(''),
  box(['Nếu một câu báo lỗi đỏ: bấm **Làm lại (giữ file đã chọn)** và chỉ tích câu bị lỗi. Nếu vẫn lỗi → làm câu đó theo mục 5.']),

  H1('3. Nộp bài từng câu'),
  H2('Câu 1 — Slide có hình ảnh + audio thuyết trình'),
  bullet('Mở file **Cau1_Slide_….pptx** bằng PowerPoint → nhấn **F5**: mỗi slide tự đọc lời thuyết trình và tự chuyển slide.'),
  bullet('Biểu tượng loa ở góc phải dưới mỗi slide = audio nhúng trên slide (đúng yêu cầu “audio trên slide”). Lời thuyết trình nằm trong phần **Notes**.'),
  bullet('Đề yêu cầu video: **File → Export → Create a Video** → chọn “Use Recorded Timings and Narrations” → Create Video.'),
  bullet('Đề yêu cầu Google Slides: tải PPTX lên Google Drive → mở bằng Google Slides (lưu ý: Google Slides có thể không phát audio nhúng; nên nộp kèm file PPTX).'),
  bullet('Đề bắt buộc dùng **Gamma/Canva**: làm theo prompt Câu 1 ở mục 5 (dán nội dung vào công cụ đó).'),
  H2('Câu 2 — Trích xuất ảnh/PDF ra Excel/Word'),
  bullet('Tải **Cau2_TrichXuat.xlsx** (Excel) hoặc **Cau2_TrichXuat.docx** (Word) — nút màu xanh đậm là định dạng đề yêu cầu.'),
  bullet('Mở file, so nhanh 3–5 ô với ảnh gốc (tên riêng, số tiền). Ô ghi “[không rõ]” → sửa tay theo ảnh.'),
  bullet('Nếu giám khảo yêu cầu thấy “các lệnh AI”: mở Gemini, tải ảnh lên, dán prompt Câu 2 ở mục 5 để minh họa.'),
  H2('Câu 3 — App học ngôn ngữ (Google AI Studio)'),
  num('n3')('Trên web bấm **Copy prompt & mở AI Studio** (trang https://aistudio.google.com/apps mở ra).'),
  num('n3')('Bấm vào ô mô tả → **Ctrl+V** → bấm **Build** (hoặc Enter). Chờ 1–3 phút.'),
  num('n3')('Thử app ở khung Preview. Lỗi → copy 1 “prompt sửa lỗi” trên web → dán vào khung chat bên trái AI Studio.'),
  num('n3')('Nộp: nút **Share** (lấy link) / **Deploy** / **Download** theo yêu cầu đề. Chụp màn hình app đang chạy để dự phòng.'),

  H1('4. Xử lý sự cố nhanh'),
  table(['Hiện tượng', 'Cách xử lý'], [
    ['Web tải mãi không vào được', 'Chờ 1 phút (server khởi động) rồi F5. Vẫn lỗi → làm theo mục 5.'],
    ['Báo “Sai hoặc thiếu mã truy cập”', 'Nhập đúng mã ở ô Mã truy cập đầu trang.'],
    ['Slide không có ảnh (nền màu)', 'Key chưa dùng được model tạo ảnh. Vẫn nộp được; hoặc PowerPoint → Insert → Pictures → Stock Images để chèn ảnh.'],
    ['PowerPoint không tự phát audio', 'Bấm vào biểu tượng loa; hoặc chọn loa → tab Playback → Start: Automatically.'],
    ['Câu 2 trích sai / thiếu', 'Ghi rõ trường cần lấy vào ô ghi chú → Làm lại chỉ câu 2. Ảnh mờ → chụp lại rõ hơn.'],
    ['AI Studio báo lỗi / app trắng', 'Dán prompt sửa lỗi; hoặc bấm tạo lại (Build) với cùng prompt.'],
  ], [3400, 5960]),

  new Paragraph({ children: [new PageBreak()] }),
  H1('5. Dự phòng — làm tay bằng prompt'),
  P('Mỗi prompt dưới đây cũng có trên web (tab “Làm tay”, nút Copy). Đính kèm ảnh/file đề cùng prompt.'),
  H2('Câu 1 — dán vào ChatGPT hoặc Gemini (kèm ảnh đề)'),
  P('Sau khi AI trả lời: dán mục (B) vào **gamma.app → Create → Paste in text** → Generate → Export PowerPoint → mở bằng PowerPoint → **Slide Show → Record** đọc lời thuyết trình (C). Hoặc tạo mp3 ở ttsmaker.com → Insert → Audio → Start: Automatically.'),
  ...mono(prompt('cau1_slide.md')),
  H2('Câu 2 — dán vào Gemini (kèm ảnh/PDF cần trích xuất)'),
  P('Sửa dòng YÊU CẦU CỦA ĐỀ. Kết quả: di chuột vào bảng → **Export to Sheets** → File → Download → .xlsx. Word: **Share & export → Export to Docs** → Download → .docx.'),
  ...mono(prompt('cau2_trich_xuat.md')),
  H2('Câu 3 — dán vào Google AI Studio → Build'),
  P('Đổi dòng TARGET LANGUAGE nếu đề yêu cầu ngôn ngữ khác tiếng Anh.'),
  ...mono(prompt('cau3_aistudio.md')),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, font: FONT, color: '1F4E79' }, paragraph: { spacing: { before: 300, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, font: FONT, color: '2457D6' }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    ...['n1', 'n3'].map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] })),
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1273, right: 1273 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Trang ', size: 18, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' })] })] }) },
    children,
  }],
});

fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(path.join(__dirname, '..', 'docs', 'HuongDan_ThiCDR_AI.docx'), b); console.log('OK docs/HuongDan_ThiCDR_AI.docx'); });
