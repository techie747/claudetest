(() => {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const A4 = 440;

  const INSTRUMENTS = {
    guitar: {
      label: 'Guitar',
      strings: [
        { name: 'E', sub: 'low', freq: 82.41 },
        { name: 'A', sub: '', freq: 110.00 },
        { name: 'D', sub: '', freq: 146.83 },
        { name: 'G', sub: '', freq: 196.00 },
        { name: 'B', sub: '', freq: 246.94 },
        { name: 'E', sub: 'high', freq: 329.63 },
      ],
    },
    bass: {
      label: 'Bass',
      strings: [
        { name: 'E', sub: 'low', freq: 41.20 },
        { name: 'A', sub: '', freq: 55.00 },
        { name: 'D', sub: '', freq: 73.42 },
        { name: 'G', sub: '', freq: 98.00 },
      ],
    },
    ukulele: {
      label: 'Ukulele',
      strings: [
        { name: 'G', sub: '', freq: 392.00 },
        { name: 'C', sub: '', freq: 261.63 },
        { name: 'E', sub: '', freq: 329.63 },
        { name: 'A', sub: '', freq: 440.00 },
      ],
    },
  };

  let currentInstrument = 'guitar';

  // --- DOM ---
  const startBtn = document.getElementById('startBtn');
  const instTabs = document.querySelectorAll('.inst-tab');
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

  // --- Audio state ---
  let audioCtx = null;
  let analyser = null;
  let mediaStream = null;
  let rafId = null;
  let timeData = null;
  let freqData = null;
  let listening = false;

  function renderStrings() {
    stringsEl.innerHTML = '';
    const inst = INSTRUMENTS[currentInstrument];
    inst.strings.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'string-btn';
      btn.dataset.index = i;
      btn.innerHTML = `<span>${s.name}</span><span class="sub">${s.sub || s.freq.toFixed(1) + ' Hz'}</span>`;
      stringsEl.appendChild(btn);
    });
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
    const inst = INSTRUMENTS[currentInstrument];
    let best = null, bestDiff = Infinity;
    inst.strings.forEach((s, i) => {
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

  function drawSpectrum() {
    const ctx = spectrumCanvas.getContext('2d');
    const rect = spectrumCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    analyser.getByteFrequencyData(freqData);

    ctx.clearRect(0, 0, w, h);
    const bars = 64;
    const step = Math.floor(freqData.length / 3 / bars); // focus on lower/mid freqs
    const barWidth = w / bars;

    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += freqData[i * step + j];
      const val = sum / step;
      const barH = (val / 255) * h * 0.95;
      const hue = 150 + (val / 255) * 60;
      ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${0.35 + (val / 255) * 0.5})`;
      const x = i * barWidth;
      ctx.fillRect(x, h - barH, barWidth - 2, barH);
    }
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

    drawSpectrum();
    drawWave();

    const freq = detectPitch(timeData, audioCtx.sampleRate);

    if (freq > 0 && freq < 1200) {
      silenceFrames = 0;
      lastGoodFreq = freq;

      const note = freqToNote(freq);
      noteLetterEl.textContent = note.name;
      noteOctaveEl.textContent = note.octave;
      centsEl.textContent = `${note.cents > 0 ? '+' : ''}${note.cents}¢`;
      freqEl.textContent = `${freq.toFixed(1)} Hz`;

      setNeedle(note.cents);

      const inTune = Math.abs(note.cents) <= 5;
      const flat = note.cents < -5;
      const sharp = note.cents > 5;

      noteDisplayEl.classList.toggle('in-tune', inTune);
      noteDisplayEl.classList.toggle('flat', flat);
      noteDisplayEl.classList.toggle('sharp', sharp);
      centsEl.classList.toggle('in-tune', inTune);
      centsEl.classList.toggle('flat', flat);
      centsEl.classList.toggle('sharp', sharp);

      const strIdx = nearestString(freq);
      highlightString(strIdx);

      statusEl.textContent = inTune ? 'In tune!' : (flat ? 'Tune up (too low)' : 'Tune down (too high)');
    } else {
      silenceFrames++;
      if (silenceFrames > 30) {
        noteDisplayEl.classList.remove('in-tune', 'flat', 'sharp');
        centsEl.classList.remove('in-tune', 'flat', 'sharp');
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  renderStrings();
  renderTicks();
})();
