# CLAUDE.md — Bối cảnh dự án (bàn giao từ phiên Claude Cowork)

## Mục tiêu
Giúp một sinh viên (bạn của chủ repo) làm bài **thi thực hành “Chuẩn đầu ra Trí tuệ nhân tạo”** với **ít thao tác nhất**. Phòng thi cho vào web ngoài thoải mái. Đề mẫu:
1. Dùng công cụ AI tạo **slide kèm hình ảnh + lời thuyết trình bằng audio trên slide** giới thiệu 1 sản phẩm.
2. Dùng AI xử lý **ảnh/PDF → trích xuất ra Excel hoặc Word** thông tin cần thiết.
3. Dùng công cụ AI tạo **1 ứng dụng hỗ trợ học ngôn ngữ** (chủ repo muốn dùng https://aistudio.google.com/apps).
Đề thi thật có thể chi tiết hơn (bắt buộc tool nào, chủ đề gì) → web phải **đọc đề trước** rồi mới làm.

## Quyết định đã chốt với chủ repo
- Hướng **C**: web tự động (đường chính) + prompt làm tay dự phòng (tab “Làm tay” + `prompts/*.md`).
- Dùng **OpenAI API** (key đặt ở biến môi trường server, KHÔNG để ở client).
- Host backend trên **Render** (không dùng Netlify Functions vì timeout ngắn). Một Web Service Node phục vụ cả frontend tĩnh lẫn API.
- Xử lý dài → mô hình **job + polling** (POST /api/solve trả id ngay, frontend poll /api/jobs/:id mỗi 1,5 s).
- Chủ repo nhắc “nhập key vào env Netlify” nhưng backend ở Render → key phải nhập ở **Render → Environment** (`OPENAI_API_KEY`).

## Kiến trúc (xem README.md để biết chi tiết file)
- `lib/openai.js`: fetch thuần, retry 429/5xx, **tự thử model dự phòng** khi model không tồn tại/không có quyền (cache model chạy được). Model mặc định: text `gpt-4o`, image `gpt-image-1`, tts `gpt-4o-mini-tts` — override bằng env (`TEXT_MODEL`, `IMAGE_MODEL`, `TTS_MODEL`, danh sách phân cách dấu phẩy). Tên model OpenAI thay đổi theo thời gian → nếu lỗi, kiểm tra `/api/health` (liệt kê model mà key dùng được) rồi chỉnh env.
- `lib/analyze.js`: đề (ảnh/PDF/DOCX/TXT) + ghi chú → JSON schema yêu cầu từng câu + `warnings` (vd đề bắt buộc Gamma).
- `lib/q1.js`: GPT viết nội dung + narration + image_prompt → ảnh (pool 3) & TTS mp3 (pool 4) song song → PptxGenJS (LAYOUT_WIDE, slide bìa/nội dung/kết) → hậu xử lý bằng JSZip:
  - đổi `<a:videoFile>` → `<a:audioFile>` (PptxGenJS ghi audio sai thẻ), content-type `audio/mp3` → `audio/mpeg`;
  - chèn `<p:transition advTm=…>` + `<p:timing>` để **audio tự phát** khi vào slide và **tự chuyển slide** khi đọc xong (thời lượng lấy từ `lib/mp3.js`).
  - Ảnh lỗi → dùng khối màu thay thế, không làm hỏng cả job.
- `lib/q2.js`: GPT vision trích xuất → `{fields, tables, notes}` → ExcelJS (header màu, freeze, autofilter, chuyển “1.200.000” → số) + docx. Luôn xuất cả 2 file; UI tô đậm file đề yêu cầu. Không có file ở ô ② → dùng ảnh trong đề.
- `lib/q3.js`: sinh prompt tiếng Anh cho AI Studio Build (UI tiếng Việt, Gemini JSON schema, Web Speech API, quiz, localStorage progress) + fix_prompts + kịch bản demo.
- `public/index.html`: 1 file vanilla JS; kéo thả, **Ctrl+V dán ảnh chụp đề**, chọn câu, tiến độ, tải từng file / zip, nút “Copy prompt & mở AI Studio”, nút Kiểm tra API, tab Làm tay.
- `ACCESS_CODE` (tùy chọn): header `x-access-code` hoặc `?code=`.

## Trạng thái
- ✅ Code hoàn chỉnh, đã test end-to-end với **OpenAI giả lập** (mock server): job chạy đủ 3 câu, PPTX hợp lệ (python-pptx đọc được, LibreOffice render đúng bố cục, có audio + timing), XLSX/DOCX đúng, UI không lỗi console.
- ⏳ CHƯA test với **OpenAI key thật** (phiên trước không có key). Việc cần làm tiếp:
  1. Push code lên GitHub `https://github.com/pherotranhai-cloud/AI_Support_Tools` (nhánh main).
  2. Deploy Render (Blueprint từ `render.yaml` hoặc Web Service thủ công), nhập `OPENAI_API_KEY`, `ACCESS_CODE`.
  3. Mở web → “Kiểm tra API” → chạy thử với đề mẫu + 1 ảnh hóa đơn thật. Kiểm tra: tên model hợp lệ, gpt-image có cần Organization verification không, giọng TTS tiếng Việt ổn không.
  4. Mở file PPTX bằng **PowerPoint thật** (Windows) → F5 → xác nhận audio tự phát & tự chuyển slide. Nếu PowerPoint báo cần sửa file → xem lại XML timing trong `lib/q1.js` (`timingXml`).
  5. (Tùy chọn) tinh chỉnh thiết kế slide, thêm lựa chọn giọng đọc trên UI.
- File hướng dẫn cho thí sinh: `docs/HuongDan_ThiCDR_AI.docx`.

## Quy ước
- Giao diện & thông báo: tiếng Việt. Prompt gửi model tạo ảnh/AI Studio: tiếng Anh.
- Không commit `.env`/key. Không đưa key xuống client.
