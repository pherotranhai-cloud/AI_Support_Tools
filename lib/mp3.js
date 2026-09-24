// Tính thời lượng MP3 (ms) bằng cách duyệt frame header — đủ chính xác cho TTS.
const BR = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG1 L3
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG2/2.5 L3
};
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function mp3DurationMs(buf) {
  let i = 0;
  // bỏ qua ID3v2
  if (buf.slice(0, 3).toString() === 'ID3') {
    const size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
    i = 10 + size;
  }
  let seconds = 0;
  let frames = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const ver = (buf[i + 1] >> 3) & 3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
      const layer = (buf[i + 1] >> 1) & 3; // 1 = Layer III
      const bri = (buf[i + 2] >> 4) & 15;
      const sri = (buf[i + 2] >> 2) & 3;
      const pad = (buf[i + 2] >> 1) & 1;
      if (ver !== 1 && layer === 1 && bri > 0 && bri < 15 && sri < 3) {
        const br = BR[ver === 3 ? 1 : 2][bri] * 1000;
        const sr = SR[ver][sri];
        const samples = ver === 3 ? 1152 : 576;
        const len = Math.floor(((ver === 3 ? 144 : 72) * br) / sr) + pad;
        if (len > 0) {
          seconds += samples / sr;
          frames++;
          i += len;
          continue;
        }
      }
    }
    i++;
  }
  if (!frames) return Math.round((buf.length * 8) / 64); // ước lượng 64kbps
  return Math.round(seconds * 1000);
}

module.exports = { mp3DurationMs };
