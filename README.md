# AI Exam Solver — Thi học phần Chuẩn đầu ra Trí tuệ nhân tạo

Web 1 lần bấm: kéo thả đề (+ ảnh/PDF cần trích xuất) → OpenAI API xử lý → trả về:

| Câu | Kết quả |
|---|---|
| 1. Slide giới thiệu sản phẩm + hình ảnh + audio thuyết trình | `.pptx` có ảnh AI, giọng đọc AI **tự phát** mỗi slide, tự chuyển slide, lời thuyết trình trong Notes |
| 2. Trích xuất ảnh/PDF ra Excel/Word | `.xlsx` + `.docx` (định dạng đẹp, số đã chuyển thành số) + xem trước trên web |
| 3. App học ngôn ngữ | Prompt tối ưu cho **Google AI Studio → Build**, nút “Copy & mở AI Studio”, prompt sửa lỗi, kịch bản demo |

Tab **“Làm tay (dự phòng)”** chứa sẵn prompt cho ChatGPT / Gemini / AI Studio nếu API lỗi.

## Deploy lên Render (≈5 phút)
1. Render Dashboard → **New → Blueprint** → chọn repo này (Render đọc `render.yaml`).
   Hoặc **New → Web Service** → repo này → Build `npm install`, Start `npm start`, Node 22.
2. Tab **Environment**: thêm `OPENAI_API_KEY` (bắt buộc), `ACCESS_CODE` (khuyên dùng — mã để vào web, tránh người lạ dùng key).
3. Deploy → mở URL `https://<ten-service>.onrender.com` → bấm **Kiểm tra API**.

> Gói Free của Render “ngủ” sau 15 phút không dùng, lần mở đầu chờ ~1 phút. Ngày thi: mở web trước 5 phút, hoặc nâng lên gói **Starter** trong ngày đó.
> Render không giới hạn thời gian như Netlify Functions; web chạy theo job + polling nên xử lý 1–3 phút vẫn ổn.

## Biến môi trường
| Biến | Mặc định | Ghi chú |
|---|---|---|
| `OPENAI_API_KEY` | — | bắt buộc |
| `ACCESS_CODE` | trống | mã truy cập web |
| `TEXT_MODEL` | `gpt-6-luna` → `gpt-4o` → `gpt-4.1` → `gpt-4o-mini` | model đọc đề/viết nội dung (cần hỗ trợ ảnh + PDF + JSON schema). Có thể ghi nhiều model, cách nhau dấu phẩy, web tự thử lần lượt |
| `IMAGE_MODEL` | `gpt-6-luna` → `gpt-image-1` → `gpt-image-1-mini` → `dall-e-3` | gpt-image cần **Organization verification** trên platform.openai.com. Lỗi hết → slide dùng nền màu |
| `IMAGE_QUALITY` | `low` | `low` rẻ + nhanh nhất (mặc định); `medium` / `high` đẹp hơn nhưng đắt hơn |
| `TTS_MODEL` | `gpt-4o-mini-tts-2025-12-15` → `gpt-4o-mini-tts` → `tts-1-hd` → `tts-1` | giọng đọc |
| `TTS_VOICE` | `nova` | alloy, echo, fable, onyx, nova, shimmer, coral… |

## Chạy thử local
```bash
npm install
OPENAI_API_KEY=sk-... npm start   # http://localhost:3000
```

## Cấu trúc
```
server.js            Express: /api/solve (tạo job), /api/jobs/:id (tiến độ), /api/jobs/:id/file, /api/health
lib/openai.js        Gọi OpenAI bằng fetch, retry, tự đổi model dự phòng
lib/inputs.js        Ảnh/PDF/DOCX/PPTX/TXT → content parts
lib/analyze.js       Phân tích đề → yêu cầu cụ thể từng câu (JSON schema)
lib/q1.js            Nội dung slide → ảnh + TTS song song → PptxGenJS → chèn XML autoplay audio
lib/q2.js            Trích xuất → ExcelJS + docx
lib/q3.js            Sinh prompt AI Studio Build
lib/mp3.js           Tính thời lượng mp3 (để tự chuyển slide)
public/index.html    Giao diện (1 file, không build)
prompts/*.md         Prompt làm tay dự phòng
```

Chi phí ước tính mỗi lần giải đủ 3 câu (7 slide): khoảng 0,3–0,6 USD (phần lớn là ảnh). Số liệu ước lượng, xem bảng giá OpenAI hiện hành.
