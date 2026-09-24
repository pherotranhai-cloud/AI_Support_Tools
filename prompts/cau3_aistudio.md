# CÂU 3 — Tạo ứng dụng hỗ trợ học ngôn ngữ bằng Google AI Studio (LÀM TAY)

## CÁCH DÙNG (đọc trước)
1. Mở **https://aistudio.google.com/apps** (đăng nhập Google).
2. Bấm "Copy prompt" ở web. Nếu đề yêu cầu ngôn ngữ khác tiếng Anh (vd tiếng Nhật, Hàn, Trung) → sửa dòng "TARGET LANGUAGE" trong prompt.
3. Dán vào ô "Describe your idea / Build…" → bấm **Build** (hoặc Enter). Chờ 1–3 phút đến khi Preview bên phải hiện app.
4. Thử nhanh: tab Từ vựng → bấm nghe; tab Hội thoại → gõ 1 câu; tab Quiz → làm 1 câu.
5. App lỗi/chưa đẹp → gõ vào khung chat bên trái, ví dụ:
   - `The app shows an error. Please fix all errors and make sure every button works.`
   - `Make sure all UI text is in Vietnamese.`
   - `Text-to-speech does not play. Use window.speechSynthesis with lang "en-US" and add a fallback message.`
   - `Make the design more modern and colorful, with cards, icons and smooth animations.`
6. Nộp bài: nút **Share** (lấy link) hoặc **Deploy / Publish** (Cloud Run) hoặc **Download** (tải zip mã nguồn) — theo yêu cầu đề. Có thể chụp màn hình app đang chạy.

===== PROMPT (copy từ dòng dưới) =====
Build a polished, fully working LANGUAGE-LEARNING web app called "LinguaBuddy AI".

TARGET LANGUAGE (what the user learns): English
LEARNER LANGUAGE (all UI text, explanations and translations): Vietnamese

## Core features (implement all, every button must work)
1. **AI Vocabulary & Flashcards** — The user picks or types a topic (e.g. Travel, Food, Work, Shopping) and a level (Beginner / Intermediate / Advanced). Use Gemini to generate 10 words as JSON: word, IPA, part of speech, Vietnamese meaning, example sentence + Vietnamese translation. Show them as flip cards (front: word + IPA, back: meaning + example). Buttons: "Nghe" (listen) and "Đã thuộc" (mark as learned).
2. **Pronunciation practice** — "Nghe" uses the browser Web Speech API `window.speechSynthesis` with lang "en-US" (slow and normal speed). "Luyện nói" uses `SpeechRecognition` / `webkitSpeechRecognition` to record the user, show what was heard, and give a similarity score 0–100 with a colored progress bar. If speech recognition is not supported, show a friendly Vietnamese message instead of crashing.
3. **AI Conversation Tutor** — A chat screen where the user role-plays a scenario (ordering coffee, job interview, asking directions, hotel check-in). Gemini replies in simple English matching the level, then adds a short Vietnamese note correcting the user's grammar/vocabulary mistakes. Each AI message has a "Nghe" button.
4. **Quiz** — Generate a 10-question multiple-choice quiz from the chosen topic (meaning, fill-in-the-blank, choose the correct sentence). Show instant feedback with explanation in Vietnamese and a final score with a "Làm lại" button.
5. **Progress dashboard** — Saved in localStorage: learning streak (days), words learned, quizzes taken, average score, simple bar chart of the last 7 days.

## Gemini usage
- Use the `@google/genai` SDK with the default fast Gemini model. The API key is provided by the environment — do NOT add any API key input.
- Request structured JSON with `responseMimeType: "application/json"` and a `responseSchema`; parse safely with try/catch.
- Show loading spinners/skeletons and friendly Vietnamese error messages with a retry button.

## UI / UX
- Modern, clean, responsive (mobile + desktop). Left sidebar on desktop, bottom tab bar on mobile: "Từ vựng", "Luyện nói", "Hội thoại", "Kiểm tra", "Tiến độ".
- Card layout, rounded corners, soft gradient header, friendly colors (indigo + teal), large readable fonts, icons, subtle animations (card flip, fade-in).
- A welcome screen explaining the app in 2 lines and a "Bắt đầu học" button.
- No lorem ipsum or placeholder content; no login; no backend except Gemini.

## Quality
- Organize code into clear components. Handle all errors gracefully. Make sure the app runs without errors on first load.
