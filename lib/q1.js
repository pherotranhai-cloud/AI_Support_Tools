// Câu 1: Slide giới thiệu sản phẩm + ảnh AI + lời thuyết trình audio (tự phát)
const PptxGenJS = require('pptxgenjs');
const JSZip = require('jszip');
const { chatJSON, image, tts, pool } = require('./openai');
const { mp3DurationMs } = require('./mp3');

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });

const SCHEMA = obj({
  deck_title: str,
  subtitle: str,
  primary_color: str,
  accent_color: str,
  image_style: str,
  slides: {
    type: 'array',
    items: obj({
      kind: { type: 'string', enum: ['title', 'content', 'closing'] },
      title: str,
      bullets: { type: 'array', items: str },
      narration: str,
      image_prompt: str,
    }),
  },
});

const SYSTEM = `Bạn là chuyên gia thiết kế bài thuyết trình giới thiệu sản phẩm.
Tạo nội dung slide ngắn gọn, chuyên nghiệp, đúng yêu cầu đề.
Quy tắc:
- Slide đầu kind="title" (bullets rỗng), slide cuối kind="closing" (lời cảm ơn / kêu gọi hành động, bullets tối đa 2), còn lại kind="content".
- Mỗi slide content có 3–5 bullets, mỗi bullet tối đa 14 từ, không đánh số, không ký tự "•".
- Nội dung nên có: vấn đề/nhu cầu, giới thiệu sản phẩm, tính năng nổi bật, lợi ích, thông số/giá (nếu hợp lý), đối tượng khách hàng, so sánh/lý do chọn.
- narration: lời thuyết trình để đọc thành audio, 45–80 từ, văn nói tự nhiên, đúng ngôn ngữ yêu cầu, không đọc lại y nguyên bullets, không ký hiệu đặc biệt.
- image_prompt: mô tả ảnh minh họa bằng TIẾNG ANH, chi tiết, phong cách nhất quán (theo image_style), ảnh KHÔNG chứa chữ/logo/watermark. Ảnh slide title là ảnh hero đẹp của sản phẩm.
- primary_color, accent_color: mã hex 6 ký tự không có dấu # (primary tối, đậm; accent tươi, tương phản), phù hợp nhận diện sản phẩm.
- image_style: 1 câu tiếng Anh mô tả phong cách ảnh chung (vd "clean studio product photography, soft lighting").`;

const HEX = /^[0-9a-f]{6}$/i;
const FONT = 'Segoe UI';
const W = 13.333;
const H = 7.5;

async function buildContent(a) {
  const q = a.q1;
  const text = `Sản phẩm: ${q.product}
Đối tượng người xem: ${q.audience || 'giảng viên, sinh viên'}
Số slide: đúng ${q.slide_count} slide (tính cả slide mở đầu và kết thúc)
Ngôn ngữ slide và lời thuyết trình: ${q.language || 'Tiếng Việt'}
Yêu cầu riêng của đề: ${(q.requirements || []).join('; ') || 'không có'}`;
  const r = await chatJSON({ system: SYSTEM, content: [{ type: 'text', text }], schema: SCHEMA, name: 'deck' });
  if (!HEX.test(r.primary_color || '')) r.primary_color = '1F2A44';
  if (!HEX.test(r.accent_color || '')) r.accent_color = 'F2A541';
  r.primary_color = r.primary_color.toUpperCase();
  r.accent_color = r.accent_color.toUpperCase();
  return r;
}

function addAudio(slide, mp3) {
  if (!mp3) return;
  slide.addMedia({ type: 'audio', data: 'audio/mpeg;base64,' + mp3.toString('base64'), extn: 'mp3', x: W - 0.85, y: H - 0.8, w: 0.5, h: 0.5, objectName: 'Narration' });
}

function heroSlide(pptx, deck, s, img, mp3, isClosing) {
  const slide = pptx.addSlide();
  slide.background = { color: deck.primary_color };
  if (img) {
    slide.addImage({ data: 'image/png;base64,' + img.toString('base64'), x: 0, y: 0, w: W, h: H, sizing: { type: 'cover', w: W, h: H } });
    slide.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: '000000', transparency: 45 }, line: { type: 'none' } });
  }
  slide.addShape('rect', { x: 0.8, y: 2.35, w: 0.12, h: 2.2, fill: { color: deck.accent_color }, line: { type: 'none' } });
  slide.addText(s.title || deck.deck_title, { x: 1.1, y: 2.2, w: 10.8, h: 1.5, fontFace: FONT, fontSize: 44, bold: true, color: 'FFFFFF', valign: 'bottom', margin: 0 });
  const sub = isClosing ? (s.bullets || []).join('\n') : deck.subtitle;
  if (sub) slide.addText(sub, { x: 1.1, y: 3.8, w: 10.8, h: 1.0, fontFace: FONT, fontSize: 20, color: 'E8E8E8', valign: 'top', margin: 0 });
  addAudio(slide, mp3);
  slide.addNotes(s.narration || '');
  return slide;
}

function contentSlide(pptx, deck, s, img, mp3, idx, total) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FAFAF7' };
  const imgLeft = idx % 2 === 0;
  const imgX = imgLeft ? 0 : W - 5.9;
  const txtX = imgLeft ? 6.4 : 0.7;
  const txtW = 6.2;
  if (img) {
    slide.addImage({ data: 'image/png;base64,' + img.toString('base64'), x: imgX, y: 0, w: 5.9, h: H, sizing: { type: 'cover', w: 5.9, h: H } });
  } else {
    slide.addShape('rect', { x: imgX, y: 0, w: 5.9, h: H, fill: { color: deck.primary_color }, line: { type: 'none' } });
    slide.addText(deck.deck_title, { x: imgX + 0.5, y: 3, w: 4.9, h: 1.5, fontFace: FONT, fontSize: 26, bold: true, color: 'FFFFFF', align: 'center' });
  }
  slide.addShape('rect', { x: txtX, y: 0.75, w: 0.9, h: 0.08, fill: { color: deck.accent_color }, line: { type: 'none' } });
  slide.addText(s.title, { x: txtX, y: 0.95, w: txtW, h: 1.3, fontFace: FONT, fontSize: 28, bold: true, color: deck.primary_color, valign: 'top', margin: 0, fit: 'shrink' });
  const bullets = (s.bullets || []).slice(0, 5).map((b) => ({ text: String(b).replace(/^[•\-\s]+/, ''), options: { bullet: { code: '25A0' }, paraSpaceAfter: 12 } }));
  if (bullets.length) {
    slide.addText(bullets, { x: txtX, y: 2.45, w: txtW, h: 4.2, fontFace: FONT, fontSize: 19, color: '333333', valign: 'top', margin: 0, lineSpacingMultiple: 1.1, fit: 'shrink' });
  }
  slide.addText(`${deck.deck_title}  |  ${idx + 1}/${total}`, { x: txtX, y: H - 0.65, w: txtW - 1, h: 0.35, fontFace: FONT, fontSize: 10, color: '8A8A8A', margin: 0 });
  addAudio(slide, mp3);
  slide.addNotes(s.narration || '');
  return slide;
}

// Chèn XML để audio TỰ PHÁT khi vào slide + tự chuyển slide khi đọc xong
function timingXml(spid, durMs) {
  return `<p:transition advTm="${durMs + 1200}"><p:fade/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="${durMs}" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq><p:audio><p:cMediaNode vol="80000"><p:cTn id="7" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:endCondLst><p:cond evt="onStopAudio" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:endCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cMediaNode></p:audio></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

async function addAutoplay(buf, durations) {
  const zip = await JSZip.loadAsync(buf);
  for (let i = 0; i < durations.length; i++) {
    if (!durations[i]) continue;
    const path = `ppt/slides/slide${i + 1}.xml`;
    const f = zip.file(path);
    if (!f) continue;
    let xml = await f.async('string');
    if (!/<p:cNvPr id="\d+" name="Narration"/.test(xml)) continue;
    // pptxgenjs đặt id audio = mediaRid+2 → trùng id với shape khác, PowerPoint không mở được file
    // (timing trỏ spid vào 2 shape). Cấp id mới, lớn nhất trong slide.
    const spid = Math.max(0, ...[...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((x) => +x[1])) + 1;
    xml = xml.replace(/<p:cNvPr id="\d+" name="Narration"/, `<p:cNvPr id="${spid}" name="Narration"`);
    // pptxgenjs ghi audio bằng thẻ videoFile → sửa thành audioFile chuẩn của PowerPoint
    xml = xml.replace(/(name="Narration"[\s\S]*?)<a:videoFile /, '$1<a:audioFile ');
    const t = timingXml(spid, durations[i]);
    if (xml.includes('</p:clrMapOvr>')) xml = xml.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + t);
    else xml = xml.replace('</p:cSld>', '</p:cSld>' + t);
    zip.file(path, xml);
  }
  const ct = zip.file('[Content_Types].xml');
  if (ct) {
    let x = (await ct.async('string')).replace('ContentType="audio/mp3"', 'ContentType="audio/mpeg"');
    // pptxgenjs khai báo slideMaster2..N (không tồn tại) → bỏ các Override trỏ tới part không có
    x = x.replace(/<Override PartName="\/([^"]+)"[^>]*\/>/g, (tag, p) => (zip.file(p) ? tag : ''));
    zip.file('[Content_Types].xml', x);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function solveQ1(a, log) {
  log('Câu 1: viết nội dung slide + lời thuyết trình…');
  const deck = await buildContent(a);
  const slides = deck.slides;
  log(`Câu 1: đã có ${slides.length} slide. Đang tạo ảnh AI và giọng đọc (song song)…`);

  let imgDone = 0;
  let audDone = 0;
  const imgErrors = [];
  const imgsP = pool(slides, 3, async (s) => {
    try {
      const b = await image(`${s.image_prompt}. Style: ${deck.image_style}. No text, no letters, no logos, no watermark.`);
      log(`Câu 1: ảnh ${++imgDone}/${slides.length}`);
      return b;
    } catch (e) {
      imgErrors.push(e.message);
      log(`Câu 1: ⚠ ảnh lỗi (${e.message.slice(0, 120)}) → dùng nền màu thay thế`);
      return null;
    }
  });
  const lang = a.q1.language || 'Tiếng Việt';
  const audErrors = [];
  const audsP = pool(slides, 4, async (s) => {
    try {
      const b = await tts(s.narration, { instructions: `Speak in ${lang} with a warm, confident, professional presenter tone. Natural pace, clear pronunciation.` });
      log(`Câu 1: giọng đọc ${++audDone}/${slides.length}`);
      return b;
    } catch (e) {
      audErrors.push(e.message);
      log(`Câu 1: ⚠ giọng đọc lỗi (${e.message.slice(0, 120)}) → slide này không có audio`);
      return null;
    }
  });
  const [imgs, auds] = await Promise.all([imgsP, audsP]);
  if (audErrors.length === slides.length) throw new Error('Không tạo được giọng đọc: ' + audErrors[0]);

  log('Câu 1: đóng gói file PowerPoint…');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = deck.deck_title;
  pptx.author = 'AI';
  const contentCount = slides.length;
  slides.forEach((s, i) => {
    if (s.kind === 'title' || i === 0) heroSlide(pptx, deck, s, imgs[i], auds[i], false);
    else if (s.kind === 'closing' || i === slides.length - 1) heroSlide(pptx, deck, s, imgs[i], auds[i], true);
    else contentSlide(pptx, deck, s, imgs[i], auds[i], i, contentCount);
  });
  let buf = await pptx.write({ outputType: 'nodebuffer' });
  const durations = auds.map((b) => (b ? mp3DurationMs(b) : 0));
  buf = await addAutoplay(buf, durations);

  const script = slides.map((s, i) => `Slide ${i + 1} – ${s.title}\n${s.narration}`).join('\n\n');
  return {
    deck,
    pptx: buf,
    script,
    audios: auds,
    imageErrors: imgErrors,
    totalSeconds: Math.round(durations.reduce((x, y) => x + y, 0) / 1000),
  };
}

module.exports = { solveQ1, addAutoplay };
