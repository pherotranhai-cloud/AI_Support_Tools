# CÂU 2 — Trích xuất thông tin từ ảnh/PDF ra Excel hoặc Word (LÀM TAY bằng Gemini)

## CÁCH DÙNG (đọc trước)
1. Mở **gemini.google.com** (đăng nhập Google).
2. Bấm **+** → **Upload files** → chọn TẤT CẢ ảnh/PDF cần trích xuất (có thể kèm ảnh đề).
3. Bấm "Copy prompt" ở web → dán vào ô chat. **Sửa dòng "YÊU CẦU CỦA ĐỀ"** cho đúng đề (các cột/trường cần lấy) → Enter.
4. Xuất file:
   - **Excel:** di chuột vào bảng Gemini trả về → bấm **Export to Sheets** → Google Sheets mở ra → **File → Download → Microsoft Excel (.xlsx)**.
   - **Word:** bấm biểu tượng **Share & export (↗) → Export to Docs** → Google Docs mở ra → **File → Download → Microsoft Word (.docx)**.
   - Nếu không thấy nút Export: bôi đen bảng → Ctrl+C → dán vào Excel/Word (Ctrl+V).
5. Kiểm tra nhanh vài ô số/tên so với ảnh gốc trước khi nộp.

===== PROMPT (copy từ dòng dưới) =====
Bạn là chuyên gia OCR và trích xuất dữ liệu. Tôi đã tải lên các ảnh/PDF.

YÊU CẦU CỦA ĐỀ: [ghi lại yêu cầu câu 2 của đề, ví dụ: trích xuất tên sản phẩm, số lượng, đơn giá, thành tiền ra Excel — nếu để trống thì trích xuất toàn bộ thông tin quan trọng]

Hãy thực hiện:
1. Đọc kỹ từng ảnh/trang. Chép CHÍNH XÁC chữ, số, dấu tiếng Việt như trong tài liệu; không bịa. Ô không đọc được ghi "[không rõ]".
2. Trình bày kết quả thành BẢNG (markdown table) với dòng tiêu đề cột rõ ràng. Nếu có nhiều ảnh cùng loại (nhiều hóa đơn, nhiều danh thiếp…), gộp vào 1 bảng, mỗi ảnh là 1 dòng, thêm cột "Nguồn" (tên file/ảnh số mấy).
3. Các thông tin chung (tiêu đề, ngày, số hiệu, tổng tiền…) đặt trong 1 bảng riêng 2 cột "Thông tin | Giá trị".
4. Số tiền giữ nguyên dạng số (không thêm chữ "đồng" vào ô số) để tính toán được trong Excel.
5. Cuối cùng: ghi 1–3 lưu ý về ô không rõ hoặc giả định (nếu có).
Chỉ trả về bảng và lưu ý, không giải thích dài.
