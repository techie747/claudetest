require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SUNO_API_KEY = process.env.SUNO_API_KEY;
const SUNO_API_BASE = process.env.SUNO_API_BASE || 'https://api.suno.ai';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for embeddable widget
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static('public'));

// ─── Suno API proxy helpers ────────────────────────────────────────────────

function sunoHeaders(userKey) {
  const key = userKey || SUNO_API_KEY;
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

function requireApiKey(req, res, next) {
  const userKey = req.headers['x-suno-key'];
  if (!userKey && !SUNO_API_KEY) {
    return res.status(400).json({
      error: 'No Suno API key configured. Set SUNO_API_KEY on the server or pass X-Suno-Key header.'
    });
  }
  req.sunoKey = userKey || null;
  next();
}

// ─── Suno API routes ──────────────────────────────────────────────────────

// Generate music from a text prompt
app.post('/api/suno/generate', requireApiKey, async (req, res) => {
  const {
    prompt,
    title,
    tags,
    make_instrumental = false,
    model = 'chirp-v3-5',
    negative_tags = ''
  } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  try {
    const response = await axios.post(
      `${SUNO_API_BASE}/api/generate/v2/`,
      { gpt_description_prompt: prompt, title, tags, make_instrumental, mv: model, negative_tags },
      { headers: sunoHeaders(req.sunoKey) }
    );

    console.log(`[FIE] Generated music for prompt: "${prompt.slice(0, 60)}..."`);
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.detail || err.message;
    console.error('[FIE] Suno generate error:', message);
    res.status(status).json({ error: message });
  }
});

// Custom generation with lyrics
app.post('/api/suno/generate/custom', requireApiKey, async (req, res) => {
  const {
    prompt,
    lyrics,
    title,
    tags,
    make_instrumental = false,
    model = 'chirp-v3-5'
  } = req.body;

  if (!prompt && !lyrics) return res.status(400).json({ error: 'prompt or lyrics is required' });

  try {
    const response = await axios.post(
      `${SUNO_API_BASE}/api/generate/v2/`,
      {
        prompt: lyrics || '',
        gpt_description_prompt: prompt || '',
        title,
        tags,
        make_instrumental,
        mv: model,
        custom_mode: true
      },
      { headers: sunoHeaders(req.sunoKey) }
    );

    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

// Poll generation status by clip IDs
app.get('/api/suno/status', requireApiKey, async (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: 'ids query param required' });

  try {
    const response = await axios.get(
      `${SUNO_API_BASE}/api/feed/?ids=${encodeURIComponent(ids)}`,
      { headers: sunoHeaders(req.sunoKey) }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

// Get a single clip
app.get('/api/suno/clip/:id', requireApiKey, async (req, res) => {
  try {
    const response = await axios.get(
      `${SUNO_API_BASE}/api/clip/${req.params.id}`,
      { headers: sunoHeaders(req.sunoKey) }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

// Check remaining credits
app.get('/api/suno/credits', requireApiKey, async (req, res) => {
  try {
    const response = await axios.get(
      `${SUNO_API_BASE}/api/billing/info/`,
      { headers: sunoHeaders(req.sunoKey) }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

// Extend / continue a clip
app.post('/api/suno/extend', requireApiKey, async (req, res) => {
  const { clip_id, prompt, continue_at } = req.body;
  if (!clip_id) return res.status(400).json({ error: 'clip_id is required' });

  try {
    const response = await axios.post(
      `${SUNO_API_BASE}/api/generate/v2/`,
      { continue_clip_id: clip_id, continue_at, gpt_description_prompt: prompt || '' },
      { headers: sunoHeaders(req.sunoKey) }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

// ─── Widget embed script ──────────────────────────────────────────────────

app.get('/fie-widget.js', (req, res) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  var FIE_HOST = '${host}';
  var containers = document.querySelectorAll('[data-fie-widget]');
  if (!containers.length) {
    var s = document.currentScript;
    var wrapper = document.createElement('div');
    s.parentNode.insertBefore(wrapper, s.nextSibling);
    containers = [wrapper];
  }
  containers.forEach(function(el) {
    var theme = el.getAttribute('data-theme') || 'dark';
    var width = el.getAttribute('data-width') || '100%';
    var height = el.getAttribute('data-height') || '640px';
    var iframe = document.createElement('iframe');
    iframe.src = FIE_HOST + '/widget?theme=' + theme;
    iframe.width = width;
    iframe.height = height;
    iframe.style.border = 'none';
    iframe.style.borderRadius = '16px';
    iframe.allow = 'autoplay';
    iframe.title = 'Frequency Intelligence Engine';
    el.appendChild(iframe);
  });
})();
`);
});

// ─── Page routes ──────────────────────────────────────────────────────────

app.get('/widget', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widget.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Frequency Intelligence Engine`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Widget:    http://localhost:${PORT}/widget`);
  console.log(`  Embed JS:  http://localhost:${PORT}/fie-widget.js`);
  console.log(`  Suno API:  ${SUNO_API_KEY ? 'Configured' : 'NOT configured — set SUNO_API_KEY'}\n`);
});
