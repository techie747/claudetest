# Pitch — Mobile Guitar / Bass / Ukulele Tuner

A self-contained, mobile-friendly tuner that uses your device's microphone
to detect pitch in real time and display it on an animated dial with a
live frequency spectrum and waveform.

## Features

- Real-time pitch detection (autocorrelation) via the Web Audio API
- Switch between Guitar, Bass, and Ukulele standard tunings
- Guitar supports 6, 7, and 8-string standard tunings (low B / low F#)
- Bass supports 4 and 5-string standard tunings (low B)
- Animated needle dial with cents-off-pitch readout and color feedback
  (blue = flat, amber = sharp, green = in tune)
- Live frequency spectrum + waveform visualizer
- Tap a string to see its target note, or just play — the nearest string
  is auto-highlighted
- Tap the play button on any string card to hear its exact reference
  pitch (a synthesized pluck tone at that precise frequency), so you can
  match it by ear as well as by eye — works for every note on every
  instrument and string-count variant
- When any string on any instrument locks into tune, a full-screen
  colorful particle burst + expanding rainbow rings fire, the spectrum
  visualizer shifts into a rotating rainbow, the dial glows, and the
  device vibrates (where supported)
- No build step, no dependencies — plain HTML/CSS/JS, works great on phones

## Running it

This is a static app — open `index.html` directly, or serve it from any
static file server. If you're running the repo's Express server:

```bash
npm start
```

Then visit `http://localhost:3000/tuner`.

For microphone access on a phone over the local network, most browsers
require HTTPS (localhost is exempt). Use a tunneling tool (e.g. ngrok) or
deploy to any static host with TLS to test on a real device.

## How it works

- `getUserMedia` captures microphone audio (echo cancellation / auto-gain
  disabled for cleaner pitch tracking).
- An `AnalyserNode` provides time-domain samples, which are fed into an
  autocorrelation-based pitch detector (ACF2+ with parabolic interpolation
  for sub-sample accuracy).
- The detected frequency is converted to the nearest note name + octave
  and a cents deviation from A4 = 440 Hz.
- The nearest string for the selected instrument is highlighted, and the
  needle/dial animates to show how far off pitch you are.
