// Minimal OpenAI client (fetch) with model fallback + retry.
const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

function key() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('Chưa cấu hình OPENAI_API_KEY trên server (Render → Environment).');
  return k;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function list(envName, defaults) {
  const fromEnv = (process.env[envName] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...fromEnv, ...defaults])];
}

// Model đang dùng được (cache sau lần gọi thành công đầu tiên)
const working = {};

class ApiError extends Error {
  constructor(status, body) {
    const msg = body?.error?.message || JSON.stringify(body).slice(0, 300);
    super(`OpenAI ${status}: ${msg}`);
    this.status = status;
    this.body = body;
  }
  get isModelProblem() {
    const code = this.body?.error?.code || '';
    const m = (this.body?.error?.message || '').toLowerCase();
    return (
      this.status === 404 ||
      code === 'model_not_found' ||
      m.includes('model') && (m.includes('does not exist') || m.includes('not found') || m.includes('not supported') || m.includes('verify') || m.includes('verified') || m.includes('access'))
    );
  }
}

async function post(path, payload, { raw = false, timeoutMs = 240000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let body;
        try { body = await res.json(); } catch { body = { error: { message: await res.text().catch(() => '') } }; }
        const err = new ApiError(res.status, body);
        if (res.status === 429 || res.status >= 500) {
          // hết quota thì không retry
          if (body?.error?.code === 'insufficient_quota') throw err;
          lastErr = err;
          await sleep(1500 * 2 ** attempt);
          continue;
        }
        throw err;
      }
      return raw ? Buffer.from(await res.arrayBuffer()) : await res.json();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      lastErr = e; // network / abort
      await sleep(1500 * 2 ** attempt);
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

async function withModels(kind, candidates, fn) {
  const order = working[kind] ? [working[kind], ...candidates.filter((m) => m !== working[kind])] : candidates;
  let lastErr;
  for (const model of order) {
    try {
      const out = await fn(model);
      working[kind] = model;
      return out;
    } catch (e) {
      lastErr = e;
      if (e instanceof ApiError && (e.isModelProblem || e.status === 400 && kind !== 'text')) continue;
      throw e;
    }
  }
  throw lastErr;
}

const TEXT_MODELS = () => list('TEXT_MODEL', ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini']);
const IMAGE_MODELS = () => list('IMAGE_MODEL', ['gpt-image-1', 'gpt-image-1-mini', 'dall-e-3']);
const TTS_MODELS = () => list('TTS_MODEL', ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1']);

/**
 * Gọi chat và nhận JSON theo schema. content: mảng content-part của Chat Completions.
 */
async function chatJSON({ system, content, schema, name = 'result' }) {
  return withModels('text', TEXT_MODELS(), async (model) => {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content },
    ];
    let data;
    try {
      data = await post('/chat/completions', {
        model,
        messages,
        response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      });
    } catch (e) {
      // Model không hỗ trợ json_schema → thử json_object
      if (e instanceof ApiError && e.status === 400 && /response_format|json_schema/i.test(e.message)) {
        messages[0].content = system + '\n\nTrả về DUY NHẤT JSON đúng schema sau:\n' + JSON.stringify(schema);
        data = await post('/chat/completions', { model, messages, response_format: { type: 'json_object' } });
      } else throw e;
    }
    const msg = data.choices?.[0]?.message;
    if (msg?.refusal) throw new Error('Model từ chối: ' + msg.refusal);
    const txt = msg?.content || '';
    try {
      return JSON.parse(txt);
    } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Model trả về không phải JSON');
    }
  });
}

/** Tạo ảnh → Buffer PNG/JPEG */
async function image(prompt, { landscape = true } = {}) {
  return withModels('image', IMAGE_MODELS(), async (model) => {
    const isDalle = model.startsWith('dall-e');
    const payload = { model, prompt: prompt.slice(0, 3800), n: 1 };
    if (isDalle) {
      payload.size = landscape ? '1792x1024' : '1024x1024';
      payload.response_format = 'b64_json';
    } else {
      payload.size = landscape ? '1536x1024' : '1024x1024';
      payload.quality = process.env.IMAGE_QUALITY || 'medium';
    }
    const data = await post('/images/generations', payload);
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return Buffer.from(b64, 'base64');
    const url = data.data?.[0]?.url;
    if (url) return Buffer.from(await (await fetch(url)).arrayBuffer());
    throw new Error('Không nhận được ảnh');
  });
}

/** Text-to-speech → Buffer mp3 */
async function tts(text, { voice, instructions } = {}) {
  return withModels('tts', TTS_MODELS(), async (model) => {
    const payload = { model, input: text.slice(0, 4000), voice: voice || process.env.TTS_VOICE || 'nova', response_format: 'mp3' };
    if (model.includes('gpt-') && instructions) payload.instructions = instructions;
    return post('/audio/speech', payload, { raw: true });
  });
}

/** Liệt kê model khả dụng với key (để kiểm tra trước giờ thi) */
async function listModels() {
  const res = await fetch(BASE + '/models', { headers: { Authorization: `Bearer ${key()}` } });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  const data = await res.json();
  return data.data.map((m) => m.id).sort();
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

module.exports = { chatJSON, image, tts, listModels, pool, working, TEXT_MODELS, IMAGE_MODELS, TTS_MODELS };
