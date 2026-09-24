const { chatJSON } = require('./openai');

const DEFAULT_EXAM = `NỘI DUNG THI HỌC PHẦN CHUẨN ĐẦU RA TRÍ TUỆ NHÂN TẠO
1. Sử dụng công cụ AI để tạo slide kèm hình ảnh và lời thuyết trình bằng audio trên slide giới thiệu về một sản phẩm nào đó.
2. Sử dụng AI (các lệnh) để xử lý các hình ảnh để trích xuất ra file excel hoặc file word những thông tin cần thiết từ file ảnh hoặc pdf.
3. Sử dụng các công cụ AI để tạo ra 1 ứng dụng hỗ trợ học ngôn ngữ.`;

const str = { type: 'string' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });

const SCHEMA = obj({
  exam_summary: str,
  q1: obj({
    product: str,
    audience: str,
    slide_count: { type: 'integer' },
    language: str,
    requirements: arr(str),
    required_tool: str,
  }),
  q2: obj({
    task: str,
    fields_to_extract: arr(str),
    output_format: { type: 'string', enum: ['excel', 'word', 'both'] },
    required_tool: str,
  }),
  q3: obj({
    target_language: str,
    learner_language: str,
    app_name: str,
    features: arr(str),
    requirements: arr(str),
    required_tool: str,
  }),
  warnings: arr(str),
});

const SYSTEM = `Bạn là trợ lý phân tích đề thi thực hành "Chuẩn đầu ra Trí tuệ nhân tạo" của một trường đại học Việt Nam.
Đề thi thường có 3 câu: (1) tạo slide giới thiệu sản phẩm có hình ảnh + lời thuyết trình audio; (2) trích xuất thông tin từ ảnh/PDF ra Excel/Word; (3) tạo ứng dụng hỗ trợ học ngôn ngữ.
Nhiệm vụ: đọc đề (có thể là ảnh chụp, PDF, Word) + ghi chú của thí sinh, rút ra yêu cầu CỤ THỂ cho từng câu.
Quy tắc:
- Tôn trọng tuyệt đối mọi chi tiết đề nêu (sản phẩm, số slide, ngôn ngữ, trường thông tin, định dạng file, công cụ bắt buộc).
- Nếu đề không nêu: q1.product = một sản phẩm phổ biến, dễ trình bày (ưu tiên theo ghi chú thí sinh); slide_count = 7; language = "Tiếng Việt"; q2.output_format = "both"; q3.target_language = "Tiếng Anh", learner_language = "Tiếng Việt".
- q2.fields_to_extract: liệt kê các trường cần lấy; nếu đề không nói rõ, ghi ["Toàn bộ thông tin quan trọng trong ảnh/PDF (dạng bảng)"].
- required_tool: công cụ AI mà đề BẮT BUỘC dùng (ví dụ "Gamma", "Canva", "Gemini", "Google AI Studio"); nếu đề không bắt buộc thì để "".
- warnings: cảnh báo ngắn bằng tiếng Việt cho thí sinh nếu đề yêu cầu điều mà web này không tự làm được (ví dụ bắt buộc dùng Gamma/Canva, phải nộp link Google Slides, phải quay màn hình, phải ghi âm giọng thật...). Nếu không có thì mảng rỗng.
Viết tất cả bằng tiếng Việt, trừ tên riêng.`;

async function analyzeExam(examParts, note) {
  const content = [];
  if (examParts.length) content.push({ type: 'text', text: 'ĐỀ THI (đính kèm bên dưới):' }, ...examParts);
  else content.push({ type: 'text', text: 'Không có file đề riêng — dùng đề mẫu:\n' + DEFAULT_EXAM });
  if (note) content.push({ type: 'text', text: 'GHI CHÚ / YÊU CẦU THÊM CỦA THÍ SINH:\n' + note });
  const r = await chatJSON({ system: SYSTEM, content, schema: SCHEMA, name: 'exam_analysis' });
  r.q1.slide_count = Math.min(Math.max(parseInt(r.q1.slide_count) || 7, 3), 15);
  return r;
}

module.exports = { analyzeExam, DEFAULT_EXAM };
