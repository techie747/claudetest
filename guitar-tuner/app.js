(() => {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const A4 = 440;

  const INSTRUMENTS = {
    guitar: {
      label: 'Guitar',
      variants: {
        '6': {
          label: '6-String',
          strings: [
            { name: 'E', sub: 'low', freq: 82.41 },
            { name: 'A', sub: '', freq: 110.00 },
            { name: 'D', sub: '', freq: 146.83 },
            { name: 'G', sub: '', freq: 196.00 },
            { name: 'B', sub: '', freq: 246.94 },
            { name: 'E', sub: 'high', freq: 329.63 },
          ],
        },
        '7': {
          label: '7-String',
          strings: [
            { name: 'B', sub: 'low', freq: 61.74 },
            { name: 'E', sub: '', freq: 82.41 },
            { name: 'A', sub: '', freq: 110.00 },
            { name: 'D', sub: '', freq: 146.83 },
            { name: 'G', sub: '', freq: 196.00 },
            { name: 'B', sub: '', freq: 246.94 },
            { name: 'E', sub: 'high', freq: 329.63 },
          ],
        },
        '8': {
          label: '8-String',
          strings: [
            { name: 'F#', sub: 'low', freq: 46.25 },
            { name: 'B', sub: '', freq: 61.74 },
            { name: 'E', sub: '', freq: 82.41 },
            { name: 'A', sub: '', freq: 110.00 },
            { name: 'D', sub: '', freq: 146.83 },
            { name: 'G', sub: '', freq: 196.00 },
            { name: 'B', sub: '', freq: 246.94 },
            { name: 'E', sub: 'high', freq: 329.63 },
          ],
        },
      },
    },
    bass: {
      label: 'Bass',
      variants: {
        '4': {
          label: '4-String',
          strings: [
            { name: 'E', sub: 'low', freq: 41.20 },
            { name: 'A', sub: '', freq: 55.00 },
            { name: 'D', sub: '', freq: 73.42 },
            { name: 'G', sub: '', freq: 98.00 },
          ],
        },
        '5': {
          label: '5-String',
          strings: [
            { name: 'B', sub: 'low', freq: 30.87 },
            { name: 'E', sub: '', freq: 41.20 },
            { name: 'A', sub: '', freq: 55.00 },
            { name: 'D', sub: '', freq: 73.42 },
            { name: 'G', sub: '', freq: 98.00 },
          ],
        },
      },
    },
    ukulele: {
      label: 'Ukulele',
      variants: {
        standard: {
          label: 'Standard',
          strings: [
            { name: 'G', sub: '', freq: 392.00 },
            { name: 'C', sub: '', freq: 261.63 },
            { name: 'E', sub: '', freq: 329.63 },
            { name: 'A', sub: '', freq: 440.00 },
          ],
        },
      },
    },
  };

  const DEFAULT_VARIANT = { guitar: '6', bass: '4', ukulele: 'standard' };

  let currentInstrument = 'guitar';
  let currentVariant = DEFAULT_VARIANT[currentInstrument];

  function currentStrings() {
    return INSTRUMENTS[currentInstrument].variants[currentVariant].strings;
  }

  // --- DOM ---
  const startBtn = document.getElementById('startBtn');
  const instTabs = document.querySelectorAll('.inst-tab');
  const variantRow = document.getElementById('variantRow');
  const stringsEl = document.getElementById('strings');
  const noteLetterEl = document.getElementById('noteLetter');
  const noteOctaveEl = document.getElementById('noteOctave');
  const centsEl = document.getElementById('cents');
  const freqEl = document.getElementById('freq');
  const noteDisplayEl = document.querySelector('.note-display');
  const needleGroup = document.getElementById('needleGroup');
  const statusEl = document.getElementById('status');
  const ticksGroup = document.getElementById('ticks');
  const spectrumCanvas = document.getElementById('spectrum');
  const waveCanvas = document.getElementById('wave');
  const celebrationCanvas = document.getElementById('celebration');
  const appEl = document.querySelector('.app');
  const dialWrapEl = document.querySelector('.dial-wrap');

  // --- Audio state ---
  let audioCtx = null;
  let analyser = null;
  let mediaStream = null;
  let rafId = null;
  let timeData = null;
  let freqData = null;
  let listening = false;

  function renderVariants() {
    variantRow.innerHTML = '';
    const variants = INSTRUMENTS[currentInstrument].variants;
    const keys = Object.keys(variants);
    if (keys.length <= 1) {
      variantRow.hidden = true;
      return;
    }
    variantRow.hidden = false;
    keys.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'variant-tab' + (key === currentVariant ? ' active' : '');
      btn.dataset.variant = key;
      btn.textContent = variants[key].label;
      btn.addEventListener('click', () => {
        currentVariant = key;
        renderVariants();
        renderStrings();
      });
      variantRow.appendChild(btn);
    });
  }

  function renderStrings() {
    stringsEl.innerHTML = '';
    const strings = currentStrings();
    stringsEl.classList.toggle('strings-many', strings.length > 6);
    strings.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'string-btn';
      btn.dataset.index = i;
      btn.setAttribute('aria-label', `Play reference tone for ${s.name} ${s.sub || ''} (${s.freq.toFixed(1)} Hz)`);
      btn.innerHTML = `
        <span class="note">${s.name}</span>
        <span class="sub">${s.sub || s.freq.toFixed(1) + ' Hz'}</span>
        <span class="play-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </span>
      `;
      btn.addEventListener('click', () => playStringTone(btn, s.freq));
      stringsEl.appendChild(btn);
    });
    clearActiveString();
  }

  function renderTicks() {
    ticksGroup.innerHTML = '';
    const cx = 150, cy = 150, r1 = 118, r2 = 130;
    for (let c = -50; c <= 50; c += 10) {
      const angleDeg = (c / 50) * 90;
      const rad = (angleDeg - 90) * (Math.PI / 180);
      const x1 = cx + r1 * Math.cos(rad);
      const y1 = cy + r1 * Math.sin(rad);
      const x2 = cx + r2 * Math.cos(rad);
      const y2 = cy + r2 * Math.sin(rad);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('stroke', c === 0 ? '#5cffb1' : '#3a4560');
      line.setAttribute('stroke-width', c === 0 ? '3' : '2');
      line.setAttribute('stroke-linecap', 'round');
      ticksGroup.appendChild(line);
    }
  }

  instTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      instTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentInstrument = tab.dataset.inst;
      currentVariant = DEFAULT_VARIANT[currentInstrument];
      renderVariants();
      renderStrings();
    });
  });

  startBtn.addEventListener('click', () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  });

  async function startListening() {
    try {
      statusEl.classList.remove('error');
      statusEl.textContent = 'Requesting microphone access…';
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      await audioCtx.resume();

      const source = audioCtx.createMediaStreamSource(mediaStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      timeData = new Float32Array(analyser.fftSize);
      freqData = new Uint8Array(analyser.frequencyBinCount);

      listening = true;
      startBtn.classList.add('listening');
      startBtn.querySelector('span:last-child').textContent = 'Stop';
      statusEl.textContent = 'Listening… play a note.';

      resizeCanvases();
      loop();
    } catch (err) {
      console.error(err);
      statusEl.classList.add('error');
      statusEl.textContent = 'Microphone access denied or unavailable. Check permissions and try again.';
    }
  }

  function stopListening() {
    listening = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    if (audioCtx) audioCtx.close();
    audioCtx = null;
    analyser = null;
    mediaStream = null;
    startBtn.classList.remove('listening');
    startBtn.querySelector('span:last-child').textContent = 'Start';
    statusEl.textContent = 'Tap Start and allow microphone access to begin tuning.';
    setNeedle(0);
    noteLetterEl.textContent = '–';
    noteOctaveEl.textContent = '';
    centsEl.textContent = '0¢';
    freqEl.textContent = '0.0 Hz';
    clearActiveString();
    clearCanvas(spectrumCanvas);
    clearCanvas(waveCanvas);
    dialWrapEl.classList.remove('tuned');
    particles = [];
    rings = [];
    wasInTune = false;
    clearCanvas(celebrationCanvas);
  }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function resizeCanvases() {
    [spectrumCanvas, waveCanvas].forEach(c => {
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  window.addEventListener('resize', () => { if (listening) resizeCanvases(); });

  // --- Reference tone playback: hear the exact pitch for any string/note ---
  let playbackCtx = null;
  function getPlaybackCtx() {
    if (!playbackCtx) {
      playbackCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return playbackCtx;
  }

  // Harmonic stack (like a plucked string's overtone series) + a lowpass
  // filter that sweeps down as the note decays, so the pluck starts bright
  // and mellows out — much closer to a real string than a bare sine wave.
  const PARTIALS = [
    { mult: 1, gain: 1.00, type: 'sine' },
    { mult: 2, gain: 0.55, type: 'sine' },
    { mult: 3, gain: 0.28, type: 'triangle' },
    { mult: 4, gain: 0.14, type: 'triangle' },
    { mult: 5, gain: 0.07, type: 'sine' },
  ];

  // Soft-saturation curve (tanh) for the volume boost below. A plain gain
  // boost this large would hard-clip and sound broken; driving a WaveShaper
  // instead rounds off the peaks smoothly — measured ~3x the RMS loudness
  // of the original signal with zero samples over 0.97, i.e. genuinely
  // louder rather than distorted.
  const SATURATION_DRIVE = 2.5;
  const SATURATION_K = 1.8;
  const SATURATION_CEILING = 0.97;
  function buildSaturationCurve() {
    const n = 4096;
    const curve = new Float32Array(n);
    const norm = Math.tanh(SATURATION_K) / SATURATION_CEILING;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(SATURATION_K * x) / norm;
    }
    return curve;
  }
  const SATURATION_CURVE = buildSaturationCurve();

  async function playStringTone(btn, freq) {
    const ctx = getPlaybackCtx();
    try {
      if (ctx.state !== 'running') await ctx.resume();
    } catch (err) {
      console.error('AudioContext resume failed', err);
    }

    // Read currentTime only after resume settles — scheduling against a
    // stale/frozen currentTime from a suspended context is what caused
    // notes to schedule (and get cut off) before the context ever woke up.
    const now = ctx.currentTime;
    const attack = 0.006;
    const duration = 1.3;
    const stopAt = now + duration + 0.1;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(freq * 7, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.4, 200), now + duration);

    const drive = ctx.createGain();
    drive.gain.value = SATURATION_DRIVE;
    filter.connect(drive);

    const saturator = ctx.createWaveShaper();
    saturator.curve = SATURATION_CURVE;
    saturator.oversample = '4x';
    drive.connect(saturator);
    saturator.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.4, now + attack);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    master.connect(filter);

    const nodes = [];
    PARTIALS.forEach(p => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq * p.mult, now);
      const gain = ctx.createGain();
      gain.gain.value = p.gain;
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(stopAt);
      nodes.push(osc, gain);
    });
    nodes.push(master, filter, drive, saturator);

    const cleanupAt = (stopAt - ctx.currentTime) * 1000 + 50;
    setTimeout(() => nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }), Math.max(0, cleanupAt));

    if (btn) {
      btn.classList.add('playing');
      setTimeout(() => btn.classList.remove('playing'), duration * 1000);
    }
  }

  // --- In-tune celebration: particle burst + expanding rings + haptic pulse ---
  let celW = 0, celH = 0;
  function resizeCelebration() {
    const dpr = window.devicePixelRatio || 1;
    celW = window.innerWidth;
    celH = window.innerHeight;
    celebrationCanvas.width = celW * dpr;
    celebrationCanvas.height = celH * dpr;
    celebrationCanvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCelebration);
  resizeCelebration();

  let particles = [];
  let rings = [];
  let wasInTune = false;
  let lastCelebrationAt = -Infinity;
  let rainbowPhase = 0;

  function spawnCelebration() {
    const cx = celW / 2;
    const cy = celH * 0.4;
    const count = 140;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 7;
      particles.push({
        x: cx, y: cy,
        angle, speed,
        life: 0,
        maxLife: 50 + Math.random() * 40,
        hue: Math.random() * 360,
        size: 2 + Math.random() * 4,
      });
    }
    for (let i = 0; i < 3; i++) {
      rings.push({
        x: cx, y: cy,
        life: -i * 6,
        maxLife: 55,
        maxRadius: Math.max(celW, celH) * 0.55,
        hue: Math.random() * 360,
      });
    }

    appEl.classList.remove('pulse');
    void appEl.offsetWidth; // restart animation
    appEl.classList.add('pulse');
    setTimeout(() => appEl.classList.remove('pulse'), 500);

    if (navigator.vibrate) navigator.vibrate([70, 40, 110]);
  }

  function updateCelebration(ctx) {
    ctx.clearRect(0, 0, celW, celH);

    rings.forEach(r => { r.life++; });
    rings = rings.filter(r => r.life < r.maxLife);
    rings.forEach(r => {
      if (r.life < 0) return;
      const t = r.life / r.maxLife;
      const radius = t * r.maxRadius;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${(r.hue + r.life * 5) % 360}, 95%, 62%, ${(1 - t) * 0.8})`;
      ctx.lineWidth = 3 + (1 - t) * 5;
      ctx.stroke();
    });

    particles.forEach(p => {
      p.life++;
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.speed *= 0.965;
    });
    particles = particles.filter(p => p.life < p.maxLife);
    particles.forEach(p => {
      const t = p.life / p.maxLife;
      const hue = (p.hue + p.life * 6) % 360;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * (1 - t * 0.6)), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${1 - t})`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  // Autocorrelation-based pitch detection (ACF2+)
  function detectPitch(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // too quiet

    let r1 = 0, r2 = SIZE - 1;
    const thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    const trimmed = buf.slice(r1, r2);
    const n = trimmed.length;
    const c = new Array(n).fill(0);
    for (let lag = 0; lag < n; lag++) {
      for (let i = 0; i < n - lag; i++) {
        c[lag] += trimmed[i] * trimmed[i + lag];
      }
    }

    let d = 0;
    while (d < n - 1 && c[d] > c[d + 1]) d++;

    let maxVal = -1, maxPos = -1;
    for (let i = d; i < n; i++) {
      if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
    }
    let T0 = maxPos;

    if (T0 <= 0) return -1;

    const x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0;
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    if (T0 === 0) return -1;
    return sampleRate / T0;
  }

  function freqToNote(freq) {
    const semitonesFromA4 = 12 * Math.log2(freq / A4);
    const rounded = Math.round(semitonesFromA4);
    const cents = Math.round((semitonesFromA4 - rounded) * 100);
    const noteIndex = ((rounded % 12) + 12 + 9) % 12; // +9 to shift base from A to C
    const octave = 4 + Math.floor((rounded + 9) / 12);
    return { name: NOTE_NAMES[noteIndex], octave, cents };
  }

  function nearestString(freq) {
    const strings = currentStrings();
    let best = null, bestDiff = Infinity;
    strings.forEach((s, i) => {
      const diff = Math.abs(12 * Math.log2(freq / s.freq));
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  }

  function setNeedle(cents) {
    const clamped = Math.max(-50, Math.min(50, cents));
    const angle = (clamped / 50) * 90;
    needleGroup.style.transform = `rotate(${angle}deg)`;
  }

  let activeStringIndex = -1;
  function clearActiveString() {
    stringsEl.querySelectorAll('.string-btn').forEach(b => b.classList.remove('active', 'detected'));
    activeStringIndex = -1;
  }

  function highlightString(idx) {
    if (idx === activeStringIndex) return;
    stringsEl.querySelectorAll('.string-btn').forEach(b => b.classList.remove('detected'));
    const btn = stringsEl.querySelector(`.string-btn[data-index="${idx}"]`);
    if (btn) btn.classList.add('detected');
    activeStringIndex = idx;
  }

  function drawSpectrum(inTune) {
    const ctx = spectrumCanvas.getContext('2d');
    const rect = spectrumCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    analyser.getByteFrequencyData(freqData);

    ctx.clearRect(0, 0, w, h);
    const bars = 64;
    const step = Math.floor(freqData.length / 3 / bars); // focus on lower/mid freqs
    const barWidth = w / bars;

    if (inTune) rainbowPhase = (rainbowPhase + 3) % 360;

    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += freqData[i * step + j];
      const val = sum / step;
      const barH = (val / 255) * h * 0.95;
      const hue = inTune
        ? (rainbowPhase + (i / bars) * 360) % 360
        : 150 + (val / 255) * 60;
      const sat = inTune ? 100 : 90;
      const light = inTune ? 65 : 60;
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${0.45 + (val / 255) * 0.55})`;
      if (inTune) {
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 6;
      } else {
        ctx.shadowBlur = 0;
      }
      const x = i * barWidth;
      ctx.fillRect(x, h - barH, barWidth - 2, barH);
    }
    ctx.shadowBlur = 0;
  }

  function drawWave() {
    const ctx = waveCanvas.getContext('2d');
    const rect = waveCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(234,255,245,0.5)';
    const sliceWidth = w / timeData.length;
    let x = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i];
      const y = h / 2 + v * h * 0.4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
  }

  let lastGoodFreq = 0;
  let silenceFrames = 0;

  function loop() {
    if (!listening) return;
    analyser.getFloatTimeDomainData(timeData);

    const freq = detectPitch(timeData, audioCtx.sampleRate);
    let inTune = false;

    if (freq > 0 && freq < 1200) {
      silenceFrames = 0;
      lastGoodFreq = freq;

      const note = freqToNote(freq);
      noteLetterEl.textContent = note.name;
      noteOctaveEl.textContent = note.octave;
      centsEl.textContent = `${note.cents > 0 ? '+' : ''}${note.cents}¢`;
      freqEl.textContent = `${freq.toFixed(1)} Hz`;

      setNeedle(note.cents);

      inTune = Math.abs(note.cents) <= 5;
      const flat = note.cents < -5;
      const sharp = note.cents > 5;

      noteDisplayEl.classList.toggle('in-tune', inTune);
      noteDisplayEl.classList.toggle('flat', flat);
      noteDisplayEl.classList.toggle('sharp', sharp);
      centsEl.classList.toggle('in-tune', inTune);
      centsEl.classList.toggle('flat', flat);
      centsEl.classList.toggle('sharp', sharp);
      dialWrapEl.classList.toggle('tuned', inTune);

      const strIdx = nearestString(freq);
      highlightString(strIdx);

      statusEl.textContent = inTune ? 'In tune!' : (flat ? 'Tune up (too low)' : 'Tune down (too high)');

      if (inTune && !wasInTune && (performance.now() - lastCelebrationAt) > 1200) {
        spawnCelebration();
        lastCelebrationAt = performance.now();
      }
      wasInTune = inTune;
    } else {
      silenceFrames++;
      if (silenceFrames > 30) {
        noteDisplayEl.classList.remove('in-tune', 'flat', 'sharp');
        centsEl.classList.remove('in-tune', 'flat', 'sharp');
        dialWrapEl.classList.remove('tuned');
      }
      wasInTune = false;
    }

    drawSpectrum(inTune);
    drawWave();
    updateCelebration(celebrationCanvas.getContext('2d'));

    rafId = requestAnimationFrame(loop);
  }

  renderVariants();
  renderStrings();
  renderTicks();
})();
