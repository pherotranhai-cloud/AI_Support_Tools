// Câu 2: Trích xuất thông tin từ ảnh/PDF → Excel + Word
const ExcelJS = require('exceljs');
const docx = require('docx');
const { chatJSON } = require('./openai');

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });

const SCHEMA = obj({
  title: str,
  summary: str,
  fields: { type: 'array', items: obj({ label: str, value: str }) },
  tables: {
    type: 'array',
    items: obj({
      name: str,
      columns: { type: 'array', items: str },
      rows: { type: 'array', items: { type: 'array', items: str } },
    }),
  },
  notes: { type: 'array', items: str },
});

const SYSTEM = `Bạn là chuyên gia OCR và trích xuất dữ liệu có cấu trúc từ ảnh/PDF (hóa đơn, bảng điểm, danh sách, CV, danh thiếp, biểu mẫu, bảng giá, thời khóa biểu...).
Quy tắc:
- Đọc KỸ từng ảnh/trang. Chép CHÍNH XÁC chữ, số, dấu tiếng Việt như trong tài liệu; không bịa. Chỗ không đọc được ghi "[không rõ]".
- fields: các thông tin dạng "nhãn: giá trị" (tiêu đề, ngày, số hiệu, người bán/mua, tổng tiền...).
- tables: mọi bảng/danh sách lặp lại → bảng; mỗi hàng đúng số cột như columns. Nhiều ảnh cùng loại (vd nhiều danh thiếp/hóa đơn) → gộp thành 1 bảng, mỗi ảnh 1 hàng, thêm cột "Nguồn" (tên file).
- Số liệu: giữ nguyên định dạng gốc trong chuỗi.
- Nếu đề chỉ định trường cần lấy → tables/fields phải có đúng các trường đó (đúng tên cột đề yêu cầu).
- title: tiêu đề ngắn cho file kết quả. summary: 1–2 câu mô tả đã trích xuất gì. notes: lưu ý (ô không rõ, giả định).`;

async function extract(a, dataParts) {
  const q = a.q2;
  const content = [
    { type: 'text', text: `YÊU CẦU CỦA ĐỀ: ${q.task}\nCác trường cần trích xuất: ${(q.fields_to_extract || []).join('; ')}\nĐịnh dạng đầu ra đề yêu cầu: ${q.output_format}` },
    ...dataParts,
  ];
  return chatJSON({ system: SYSTEM, content, schema: SCHEMA, name: 'extraction' });
}

function toNumber(v) {
  const s = String(v).trim();
  if (!s || /^0\d/.test(s) || s.length > 15) return s; // mã số, SĐT giữ dạng text
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, '')); // 1.200.000 hoặc 1,200,000
  if (/^-?\d+[.,]\d{1,2}$/.test(s)) return Number(s.replace(',', '.'));
  return s;
}

function sheetName(n, used) {
  let base = (n || 'Bang').replace(/[\\/*?:[\]]/g, ' ').slice(0, 28).trim() || 'Bang';
  let name = base;
  let k = 2;
  while (used.has(name.toLowerCase())) name = `${base.slice(0, 25)} ${k++}`;
  used.add(name.toLowerCase());
  return name;
}

async function buildXlsx(r) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AI';
  const used = new Set();
  const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  const border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };

  if ((r.fields || []).length) {
    const ws = wb.addWorksheet(sheetName('Thông tin chung', used));
    ws.addRow(['Thông tin', 'Giá trị']);
    for (const f of r.fields) ws.addRow([f.label, toNumber(f.value)]);
    ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEAD; });
    ws.eachRow((row) => row.eachCell((c) => { c.border = border; c.alignment = { vertical: 'top', wrapText: true }; }));
    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 60;
  }
  for (const t of r.tables || []) {
    const ws = wb.addWorksheet(sheetName(t.name, used));
    const cols = t.columns.length ? t.columns : ['Nội dung'];
    ws.addRow(cols);
    for (const row of t.rows) ws.addRow(cols.map((_, i) => toNumber(row[i] ?? '')));
    ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEAD; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
    ws.getRow(1).height = 24;
    ws.eachRow((row) => row.eachCell({ includeEmpty: true }, (c) => { c.border = border; if (typeof c.value === 'number') c.numFmt = Number.isInteger(c.value) ? '#,##0' : '#,##0.00'; }));
    ws.columns.forEach((col, i) => {
      const lens = [cols[i], ...t.rows.map((r) => r[i])].map((v) => String(v ?? '').length);
      col.width = Math.min(Math.max(...lens, 8) + 3, 60);
      col.alignment = { vertical: 'top', wrapText: true };
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
  if (!wb.worksheets.length) wb.addWorksheet('Ket qua').addRow(['Không trích xuất được dữ liệu']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function buildDocx(r) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ShadingType, BorderStyle, AlignmentType } = docx;
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const FULL = 9360; // twips, A4 lề 1 inch
  const mkTable = (header, rows) => {
    const n = header.length;
    const w = Math.floor(FULL / n);
    const cell = (text, head) => new TableCell({
      borders,
      width: { size: w, type: WidthType.DXA },
      shading: head ? { fill: '1F4E79', type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: head, color: head ? 'FFFFFF' : undefined, size: 20 })] })],
    });
    return new Table({
      width: { size: FULL, type: WidthType.DXA },
      columnWidths: Array(n).fill(w),
      rows: [new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }), ...rows.map((row) => new TableRow({ children: header.map((_, i) => cell(row[i], false)) }))],
    });
  };
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.title || 'Kết quả trích xuất' })] }),
  ];
  if (r.summary) children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: r.summary, italics: true })] }));
  if ((r.fields || []).length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Thông tin chung')] }));
    children.push(mkTable(['Thông tin', 'Giá trị'], r.fields.map((f) => [f.label, f.value])));
  }
  for (const t of r.tables || []) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300 }, children: [new TextRun(t.name || 'Bảng dữ liệu')] }));
    children.push(mkTable(t.columns.length ? t.columns : ['Nội dung'], t.rows));
  }
  if ((r.notes || []).length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300 }, children: [new TextRun('Ghi chú')] }));
    for (const n of r.notes) children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(n)] }));
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1273, right: 1273 } } }, children }],
  });
  return Packer.toBuffer(doc);
}

async function solveQ2(a, dataParts, log) {
  if (!dataParts.length) throw new Error('Câu 2: chưa có ảnh/PDF cần trích xuất (kéo vào ô số 2, hoặc đề có kèm ảnh).');
  log('Câu 2: AI đang đọc ảnh/PDF và trích xuất…');
  const r = await extract(a, dataParts);
  log(`Câu 2: trích được ${(r.tables || []).reduce((s, t) => s + t.rows.length, 0)} dòng dữ liệu, ${(r.fields || []).length} trường. Đang tạo Excel + Word…`);
  const [xlsx, docxBuf] = await Promise.all([buildXlsx(r), buildDocx(r)]);
  return { data: r, xlsx, docx: docxBuf };
}

module.exports = { solveQ2, buildXlsx, buildDocx };
