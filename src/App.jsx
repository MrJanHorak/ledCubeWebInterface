import React, { useState, useEffect, useRef } from 'react';
import CubeEditor from './components/CubeEditor';
import Cube3D from './components/Cube3D';
import HelpOverlay from './components/HelpOverlay';
import {
  requestPort,
  openPort,
  writeToPort,
  closePort,
  createByteReader,
} from './utils/serial';
import {
  framesToCArray,
  generateHFile,
  generateSketch,
  generateTextFrames,
  generateGlyphFrames,
  generateStreamingReceiverSketch,
  generateImageFrames,
} from './utils/exporter';
import {
  mirrorX,
  mirrorY,
  mirrorZ,
  rotateZ90,
  interpolateFrames,
} from './utils/drawHelpers';
import {
  generateSphereFrames,
  generateRainFrames,
  generateScannerFrames,
  generateSparkleFrames,
  generateWireframeCubeFrames,
  generateSpiralFrames,
  generateBouncingBallFrames,
  generateFireworksFrames,
  generateExpandingCubeFrames,
  generateWaveFrames,
  generateSnakeFrames,
  generateFillDrainFrames,
  generateCheckerboardFrames,
  generateDiagonalScannerFrames,
  generateEdgeChaseFrames,
  generateOrbitFrames,
} from './utils/patterns';

function loadAutosave() {
  try {
    const saved = localStorage.getItem('ledcube-autosave');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.frames) && parsed.frames.length > 0) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

export default function App() {
  const [frames, setFrames] = useState(() => {
    const auto = loadAutosave();
    return auto ? auto.frames : [new Array(64).fill(0x00)];
  });
  const [restoredFromAutosave] = useState(() => !!loadAutosave());
  const [current, setCurrent] = useState(0);
  // Per-frame hold-time overrides. null at an index means "use the global
  // delayMs slider for this frame". Kept in lockstep with `frames` via
  // commitFrames/undo/redo below, same as the frame data itself.
  const [frameDelays, setFrameDelays] = useState(() => {
    const auto = loadAutosave();
    if (
      auto &&
      Array.isArray(auto.frameDelays) &&
      Array.isArray(auto.frames) &&
      auto.frameDelays.length === auto.frames.length
    ) {
      return auto.frameDelays;
    }
    const len = auto && Array.isArray(auto.frames) ? auto.frames.length : 1;
    return new Array(len).fill(null);
  });
  const [playing, setPlaying] = useState(false);
  const [playDirection, setPlayDirection] = useState(1);
  const [onionSkin, setOnionSkin] = useState(false);
  const [appendMode, setAppendMode] = useState(true);
  const [scannerAxis, setScannerAxis] = useState('z');
  const [delayMs, setDelayMs] = useState(() => {
    const auto = loadAutosave();
    return auto && typeof auto.delayMs === 'number' ? auto.delayMs : 300;
  });
  const [serialPort, setSerialPort] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [textInput, setTextInput] = useState('HELLO');
  const [glyphInput, setGlyphInput] = useState('A');
  const [scrollSides, setScrollSides] = useState(1);
  const [glyphMode, setGlyphMode] = useState('flat');
  const [transitionSteps, setTransitionSteps] = useState(6);
  const [transitionEasing, setTransitionEasing] = useState('linear');
  const [emoticon, setEmoticon] = useState('SMILE');
  const [imageThreshold, setImageThreshold] = useState(128);
  const [imageSpin, setImageSpin] = useState(true);
  const [audioRecording, setAudioRecording] = useState(false);
  const [audioSecondsLeft, setAudioSecondsLeft] = useState(0);
  const [audioDuration, setAudioDuration] = useState(6);
  const audioStateRef = useRef(null);
  const [activeTab, setActiveTab] = useState('playback');
  const [toast, setToast] = useState(null);
  const [frameClipboard, setFrameClipboard] = useState(null);
  const [presets, setPresets] = useState(() => {
    try {
      const saved = localStorage.getItem('ledcube-presets');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('ledcube-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('ledcube-theme', theme);
    } catch (e) {}
  }, [theme]);

  // Silent autosave: if the tab reloads or crashes, the next visit picks
  // up where you left off. Separate from Presets (named, manual saves) and
  // JSON export (portable files) -- this is just a local safety net.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          'ledcube-autosave',
          JSON.stringify({
            frames,
            delayMs,
            frameDelays,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch (e) {
        // best-effort only -- storage full or unavailable is not fatal
      }
    }, 600);
    return () => clearTimeout(t);
  }, [frames, delayMs, frameDelays]);

  useEffect(() => {
    if (restoredFromAutosave) showToast('Restored your last session');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playRef = useRef(null);
  const cubeCanvasRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [historyTick, setHistoryTick] = useState(0); // forces re-render so Undo/Redo buttons enable/disable correctly

  // Use this instead of setFrames directly for any user edit that should be
  // undoable. Navigation (setCurrent, setPlaying, etc.) is intentionally NOT
  // tracked -- only the frame data (and its per-frame delays) is.
  // `delaysUpdater` works exactly like `updater` but operates on
  // frameDelays; if omitted, delays are just padded/trimmed at the end to
  // match the new frame count (a safe but imprecise fallback -- callers
  // that insert/remove frames in the middle should pass one explicitly).
  function commitFrames(updater, delaysUpdater) {
    const prevFrames = frames;
    const prevDelays = frameDelays;
    const nextFrames = typeof updater === 'function' ? updater(prevFrames) : updater;
    let nextDelays;
    if (delaysUpdater) {
      nextDelays =
        typeof delaysUpdater === 'function'
          ? delaysUpdater(prevDelays)
          : delaysUpdater;
    } else {
      nextDelays = prevDelays.slice(0, nextFrames.length);
      while (nextDelays.length < nextFrames.length) nextDelays.push(null);
    }

    undoStack.current.push({ frames: prevFrames, delays: prevDelays });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setHistoryTick((t) => t + 1);
    setFrames(nextFrames);
    setFrameDelays(nextDelays);
  }

  function undo() {
    if (undoStack.current.length === 0) return;
    const { frames: lastFrames, delays: lastDelays } = undoStack.current.pop();
    redoStack.current.push({ frames, delays: frameDelays });
    setHistoryTick((t) => t + 1);
    setCurrent((c) => Math.min(c, Math.max(0, lastFrames.length - 1)));
    setFrames(lastFrames);
    setFrameDelays(lastDelays);
  }

  function redo() {
    if (redoStack.current.length === 0) return;
    const { frames: nextFrames, delays: nextDelays } = redoStack.current.pop();
    undoStack.current.push({ frames, delays: frameDelays });
    setHistoryTick((t) => t + 1);
    setCurrent((c) => Math.min(c, Math.max(0, nextFrames.length - 1)));
    setFrames(nextFrames);
    setFrameDelays(nextDelays);
  }

  useEffect(() => {
    function handleKeyDown(e) {
      // Don't hijack shortcuts while the person is typing in a field
      const tag = e.target?.tagName;
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        return;
      }

      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrent((c) => Math.max(0, c - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrent((c) => Math.min(frames.length - 1, c + 1));
      } else if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        e.preventDefault();
        setShowHelp((h) => !h);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelp, frames.length]);

  useEffect(() => {
    if (!playing) return;
    const holdMs = frameDelays[current];
    const effectiveMs = typeof holdMs === 'number' ? holdMs : delayMs;
    playRef.current = setTimeout(() => {
      setCurrent((c) => (c + playDirection + frames.length) % frames.length);
    }, Math.max(50, effectiveMs));
    return () => clearTimeout(playRef.current);
  }, [playing, current, playDirection, delayMs, frames.length, frameDelays]);

  const showToast = (msg, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  function updateFrame(i, newFrame) {
    commitFrames(
      (f) => {
        const copy = f.slice();
        copy[i] = newFrame.slice();
        return copy;
      },
      (d) => d, // content-only change, delays untouched
    );
  }

  function addBlankFrame() {
    commitFrames(
      (f) => [...f, new Array(64).fill(0x00)],
      (d) => [...d, null],
    );
    setCurrent(frames.length);
  }

  function duplicateFrame() {
    commitFrames(
      (f) => {
        const copy = f.slice();
        copy.splice(current + 1, 0, copy[current].slice());
        return copy;
      },
      (d) => {
        const copy = d.slice();
        // the clone starts with the same hold time as its source
        copy.splice(current + 1, 0, copy[current] ?? null);
        return copy;
      },
    );
    setCurrent((c) => c + 1);
  }

  function copyFrame() {
    setFrameClipboard(frames[current].slice());
    showToast(`Copied frame ${current + 1}`);
  }

  function pasteFrame() {
    if (!frameClipboard) return showToast('No frame copied yet');
    updateFrame(current, frameClipboard.slice());
    showToast(`Pasted into frame ${current + 1}`);
  }

  function deleteFrame() {
    if (frames.length <= 1) return;
    commitFrames(
      (f) => {
        const copy = f.slice();
        copy.splice(current, 1);
        return copy;
      },
      (d) => {
        const copy = d.slice();
        copy.splice(current, 1);
        return copy;
      },
    );
    setCurrent((c) => Math.max(0, c - 1));
  }

  function reverseFrames() {
    commitFrames(
      (f) => f.slice().reverse(),
      (d) => d.slice().reverse(),
    );
    setCurrent((c) => Math.max(0, frames.length - 1 - c));
    showToast('Frame order reversed');
  }

  function clearAllFrames() {
    commitFrames([new Array(64).fill(0x00)], [null]);
    setCurrent(0);
    showToast('Timeline cleared (Undo to bring it back)');
  }

  function setCurrentFrameDelay(ms) {
    setFrameDelays((d) => {
      const copy = d.slice();
      copy[current] = ms;
      return copy;
    });
  }

  function clearCurrentFrameDelay() {
    setFrameDelays((d) => {
      const copy = d.slice();
      copy[current] = null;
      return copy;
    });
  }

  // Roughly where a typical small board (e.g. an Uno's 32KB flash) starts
  // getting tight once the sketch code itself is counted too. This is a
  // soft heads-up, not a hard limit -- nothing in this app stops you from
  // going well past it.
  const FRAME_COUNT_SOFT_WARNING = 300;

  function appendOrReplaceFrames(newFrames, label) {
    if (!newFrames || newFrames.length === 0) {
      showToast(`${label}: nothing generated`);
      return;
    }
    let totalAfter;
    if (appendMode) {
      const insertAt = frames.length;
      commitFrames(
        (f) => [...f, ...newFrames],
        (d) => [...d, ...new Array(newFrames.length).fill(null)],
      );
      totalAfter = frames.length + newFrames.length;
      setCurrent(insertAt);
    } else {
      commitFrames(newFrames, new Array(newFrames.length).fill(null));
      totalAfter = newFrames.length;
      setCurrent(0);
    }
    setActiveTab('playback');

    const base = appendMode
      ? `${label}: added ${newFrames.length} frame(s) — ${totalAfter} total`
      : `${label}: replaced timeline with ${newFrames.length} frame(s)`;
    showToast(
      totalAfter > FRAME_COUNT_SOFT_WARNING
        ? `${base}. That's a lot of frames — may not fit a small board's flash memory once exported.`
        : base,
      totalAfter > FRAME_COUNT_SOFT_WARNING ? 4500 : 2500,
    );
  }

  function startTextScroll() {
    const txtFrames = generateTextFrames(textInput, scrollSides, 'ltr');
    if (!txtFrames || txtFrames.length === 0)
      return showToast('No text to scroll');
    appendOrReplaceFrames(txtFrames, 'Scroll Text');
  }

  function startGlyphSpin() {
    const glyphFrames = generateGlyphFrames(glyphInput || 'A', 6, glyphMode);
    appendOrReplaceFrames(glyphFrames, 'Spin Glyph');
  }

  function handleImageImport(ev) {
    const file = ev?.target?.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 8;
          canvas.height = 8;
          const ctx = canvas.getContext('2d');
          // white background first so transparent pixels read as "off"
          // rather than picking up whatever was previously on the canvas
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 8, 8);
          ctx.drawImage(img, 0, 0, 8, 8);
          const data = ctx.getImageData(0, 0, 8, 8).data;
          const columns = new Array(8).fill(0);
          for (let row = 0; row < 8; row++) {
            for (let x = 0; x < 8; x++) {
              const idx = (row * 8 + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
              const on = a > 32 && luminance < imageThreshold;
              if (on) {
                const z = 7 - row; // image top -> cube top
                columns[x] |= 1 << z;
              }
            }
          }
          const imgFrames = generateImageFrames(columns, 6, imageSpin);
          appendOrReplaceFrames(imgFrames, 'Image Import');
        } catch (err) {
          showToast('Could not process that image');
        }
      };
      img.onerror = () => showToast('Could not load that image');
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    ev.target.value = ''; // allow re-selecting the same file later
  }

  async function startAudioRecording() {
    if (audioRecording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return showToast('Microphone access is not available in this browser');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      return showToast('Microphone permission denied or unavailable');
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; // 128 frequency bins
    source.connect(analyser);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const binsPerColumn = Math.max(1, Math.floor(bufferLength / 8));

    const captured = [];
    const intervalMs = 66; // ~15fps
    const totalTicks = Math.max(1, Math.round((audioDuration * 1000) / intervalMs));
    let tick = 0;

    setAudioRecording(true);
    setAudioSecondsLeft(audioDuration);

    function cleanup() {
      clearInterval(intervalId);
      setAudioRecording(false);
      setAudioSecondsLeft(0);
      audioStateRef.current = null;
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close().catch(() => {});
    }

    function finish() {
      cleanup();
      if (captured.length > 0) {
        appendOrReplaceFrames(captured, 'Audio Reactive');
      } else {
        showToast('No audio captured');
      }
    }

    const intervalId = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const frame = new Array(64).fill(0);
      for (let x = 0; x < 8; x++) {
        let sum = 0;
        for (let b = 0; b < binsPerColumn; b++) {
          sum += dataArray[x * binsPerColumn + b] || 0;
        }
        const avg = sum / binsPerColumn;
        const height = Math.min(8, Math.round((avg / 255) * 8));
        let mask = 0;
        for (let z = 0; z < height; z++) mask |= 1 << z;
        // full depth so the bar reads clearly from any viewing angle
        for (let y = 0; y < 8; y++) frame[8 * y + x] = mask;
      }
      captured.push(frame);
      tick++;
      setAudioSecondsLeft(
        Math.max(0, Math.ceil(((totalTicks - tick) * intervalMs) / 1000)),
      );
      if (tick >= totalTicks) finish();
    }, intervalMs);

    audioStateRef.current = { intervalId, cleanup, captured, finish };
  }

  function stopAudioRecording() {
    const st = audioStateRef.current;
    if (!st) return;
    st.finish();
  }

  function exportVideo() {
    const canvas = cubeCanvasRef.current;
    if (!canvas || !canvas.captureStream) {
      return showToast('Video export is not supported in this browser');
    }
    if (!frames.length) return showToast('Nothing to export');
    if (!window.MediaRecorder) {
      return showToast('Video recording is not supported in this browser');
    }
    const mimeCandidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) {
      return showToast('Video recording is not supported in this browser');
    }

    const wasPlaying = playing;
    const wasCurrent = current;
    const wasDirection = playDirection;

    const totalMs = frames.reduce((sum, _, i) => {
      const holdMs = frameDelays[i];
      return sum + Math.max(50, typeof holdMs === 'number' ? holdMs : delayMs);
    }, 0);

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cube-animation.webm';
      a.click();
      URL.revokeObjectURL(url);
      setPlaying(wasPlaying);
      setCurrent(wasCurrent);
      setPlayDirection(wasDirection);
      showToast('Video exported');
    };

    setPlayDirection(1);
    setCurrent(0);
    setPlaying(true);
    recorder.start();
    showToast(`Recording ${Math.round(totalMs / 1000)}s of video…`, 3000);
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, totalMs + 300);
  }

  function startEmoticonSpin() {
    // force 3D mode for emoticons
    const steps = 8; // smoothness of spin
    const glyphFrames = generateGlyphFrames(emoticon || 'SMILE', steps, '3d');
    if (!glyphFrames || glyphFrames.length === 0)
      return showToast('No emoticon frames');
    appendOrReplaceFrames(glyphFrames, 'Spin Emoticon');
  }

  function startSpherePattern() {
    appendOrReplaceFrames(generateSphereFrames(20), 'Sphere');
  }
  function startRainPattern() {
    appendOrReplaceFrames(generateRainFrames(30, 0.15), 'Rain');
  }
  function startScannerPattern() {
    appendOrReplaceFrames(generateScannerFrames(scannerAxis, 16), 'Scanner');
  }
  function startSparklePattern() {
    appendOrReplaceFrames(generateSparkleFrames(30, 0.12), 'Sparkle');
  }
  function startWireframeCubePattern() {
    appendOrReplaceFrames(generateWireframeCubeFrames(24), 'Wireframe Cube');
  }
  function startSpiralPattern() {
    appendOrReplaceFrames(generateSpiralFrames(32, 3), 'Spiral');
  }
  function startBouncingBallPattern() {
    appendOrReplaceFrames(generateBouncingBallFrames(40), 'Bouncing Ball');
  }
  function startFireworksPattern() {
    appendOrReplaceFrames(generateFireworksFrames(3, 10), 'Fireworks');
  }
  function startExpandingCubePattern() {
    appendOrReplaceFrames(generateExpandingCubeFrames(20), 'Expanding Cube');
  }
  function startWavePattern() {
    appendOrReplaceFrames(generateWaveFrames(32), 'Wave');
  }
  function startSnakePattern() {
    appendOrReplaceFrames(generateSnakeFrames(40, 6), 'Snake');
  }
  function startFillDrainPattern() {
    appendOrReplaceFrames(generateFillDrainFrames(2), 'Fill / Drain');
  }
  function startCheckerboardPattern() {
    appendOrReplaceFrames(generateCheckerboardFrames(20), 'Checkerboard');
  }
  function startDiagonalScannerPattern() {
    appendOrReplaceFrames(
      generateDiagonalScannerFrames(20),
      'Diagonal Scanner',
    );
  }
  function startEdgeChasePattern() {
    appendOrReplaceFrames(generateEdgeChaseFrames(32, 3), 'Edge Chase');
  }
  function startOrbitPattern() {
    appendOrReplaceFrames(generateOrbitFrames(32, 0.5), 'Orbit');
  }

  function startRandomPattern() {
    const options = [
      ['Sphere', () => generateSphereFrames(12 + Math.floor(Math.random() * 16))],
      ['Rain', () => generateRainFrames(20 + Math.floor(Math.random() * 20), 0.1 + Math.random() * 0.15)],
      ['Scanner', () => generateScannerFrames(['x', 'y', 'z'][Math.floor(Math.random() * 3)], 12 + Math.floor(Math.random() * 12))],
      ['Sparkle', () => generateSparkleFrames(20 + Math.floor(Math.random() * 20), 0.08 + Math.random() * 0.15)],
      ['Wireframe Cube', () => generateWireframeCubeFrames(16 + Math.floor(Math.random() * 20))],
      ['Spiral', () => generateSpiralFrames(24 + Math.floor(Math.random() * 20), 2 + Math.floor(Math.random() * 3))],
      ['Bouncing Ball', () => generateBouncingBallFrames(25 + Math.floor(Math.random() * 30))],
      ['Fireworks', () => generateFireworksFrames(2 + Math.floor(Math.random() * 3), 8 + Math.floor(Math.random() * 8))],
      ['Expanding Cube', () => generateExpandingCubeFrames(12 + Math.floor(Math.random() * 16))],
      ['Wave', () => generateWaveFrames(24 + Math.floor(Math.random() * 20))],
      ['Snake', () => generateSnakeFrames(30 + Math.floor(Math.random() * 20), 4 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 10000))],
      ['Fill / Drain', () => generateFillDrainFrames(1 + Math.floor(Math.random() * 3))],
      ['Checkerboard', () => generateCheckerboardFrames(12 + Math.floor(Math.random() * 16))],
      ['Diagonal Scanner', () => generateDiagonalScannerFrames(14 + Math.floor(Math.random() * 14))],
      ['Edge Chase', () => generateEdgeChaseFrames(24 + Math.floor(Math.random() * 20), 2 + Math.floor(Math.random() * 4))],
      ['Orbit', () => generateOrbitFrames(24 + Math.floor(Math.random() * 20), Math.random() * 1.2)],
    ];
    const [name, gen] = options[Math.floor(Math.random() * options.length)];
    appendOrReplaceFrames(gen(), `Random: ${name}`);
  }

  function insertTransition() {
    const next = Math.min(current + 1, frames.length - 1);
    const a = frames[current];
    const b = frames[next];
    const tween = interpolateFrames(
      a,
      b,
      Number(transitionSteps) || 4,
      transitionEasing,
    );
    commitFrames(
      (f) => {
        const copy = f.slice();
        copy.splice(next, 0, ...tween);
        return copy;
      },
      (d) => {
        const copy = d.slice();
        copy.splice(next, 0, ...new Array(tween.length).fill(null));
        return copy;
      },
    );
    showToast('Transition inserted');
  }

  function loadJSON(ev) {
    const f = ev?.target?.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let loadedFrames = null;
        let loadedDelays = null;
        if (Array.isArray(data)) {
          // legacy format: a plain array of frames, no per-frame delays
          loadedFrames = data;
        } else if (data && Array.isArray(data.frames)) {
          loadedFrames = data.frames;
          if (
            Array.isArray(data.delays) &&
            data.delays.length === data.frames.length
          ) {
            loadedDelays = data.delays;
          }
        }
        if (loadedFrames) {
          const delays = loadedDelays || new Array(loadedFrames.length).fill(null);
          commitFrames(loadedFrames, delays);
          setCurrent(0);
          showToast('Loaded JSON');
        } else {
          showToast('Invalid JSON');
        }
      } catch (err) {
        showToast('Invalid JSON');
      }
    };
    r.readAsText(f);
  }

  function persistPresets(next) {
    setPresets(next);
    try {
      localStorage.setItem('ledcube-presets', JSON.stringify(next));
    } catch (e) {
      showToast('Could not save preset (storage full or unavailable)');
    }
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const next = {
      ...presets,
      [name]: {
        frames,
        delayMs,
        frameDelays,
        savedAt: new Date().toISOString(),
      },
    };
    persistPresets(next);
    setSelectedPreset(name);
    setPresetName('');
    showToast(`Saved preset "${name}"`);
  }

  function loadPreset() {
    const preset = presets[selectedPreset];
    if (!preset) return;
    const delays =
      Array.isArray(preset.frameDelays) &&
      preset.frameDelays.length === preset.frames.length
        ? preset.frameDelays
        : new Array(preset.frames.length).fill(null);
    commitFrames(preset.frames, delays);
    if (typeof preset.delayMs === 'number') setDelayMs(preset.delayMs);
    setCurrent(0);
    showToast(`Loaded preset "${selectedPreset}"`);
  }

  function deletePreset() {
    if (!selectedPreset) return;
    const next = { ...presets };
    delete next[selectedPreset];
    persistPresets(next);
    showToast(`Deleted preset "${selectedPreset}"`);
    setSelectedPreset('');
  }

  function saveJSON() {
    const blob = new Blob(
      [JSON.stringify({ frames, delays: frameDelays }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'frames.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Saved JSON');
  }

  async function connectSerial() {
    try {
      const port = await requestPort();
      await openPort(port, 38400);
      // Opening the port toggles DTR on most Arduino Uno/Nano-style boards,
      // which resets them. If we report "connected" immediately, a fast
      // Send click can fire the Open command and frame 1 before the
      // board's bootloader has even handed off to the sketch -- those
      // bytes are lost, and it looks like the device just isn't
      // responding. Wait out the reset window first.
      setConnecting(true);
      showToast('Connected — waiting for board to finish resetting…');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSerialPort(port);
      setConnecting(false);
      showToast('Ready to send');
    } catch (e) {
      setConnecting(false);
      showToast('Serial connection failed');
    }
  }

  async function disconnectSerial() {
    if (!serialPort) return;
    await closePort(serialPort);
    setSerialPort(null);
    setConfirmSend(false);
    showToast('Serial disconnected');
  }

  // If the cube is unplugged mid-session, don't leave the UI stuck thinking
  // it's still connected.
  useEffect(() => {
    if (!('serial' in navigator)) return;
    function handleDisconnect(e) {
      if (e.target === serialPort) {
        setSerialPort(null);
        setConfirmSend(false);
        showToast('Serial device disconnected');
      }
    }
    navigator.serial.addEventListener('disconnect', handleDisconnect);
    return () =>
      navigator.serial.removeEventListener('disconnect', handleDisconnect);
  }, [serialPort]);

  async function sendFrames() {
    if (!serialPort) return showToast('No serial port connected');
    setSending(true);
    let reader = null;
    try {
      // Read back ACK (0xAA) / NACK (0xFF) per frame so a silent failure
      // (e.g. the board isn't running the Receiver Sketch) is visible
      // instead of reporting false success.
      reader = serialPort.readable.getReader();
      const readByte = createByteReader(reader);

      // Drains any bytes sitting in the queue right now (e.g. a stray
      // leftover from a previous failed send, or a late response to an
      // attempt we already gave up on) so the next readByte() call can't
      // pick up something stale instead of the response it's actually
      // waiting for.
      async function drainStale() {
        for (let i = 0; i < 200; i++) {
          try {
            await readByte(20);
          } catch (e) {
            break; // nothing waiting -- queue is empty
          }
        }
      }

      // A previous Send that errored out partway can leave stray bytes
      // sitting in the queue (e.g. an ACK the device sent right as we gave
      // up). If we don't drain those first, this session's first readByte()
      // call picks up that leftover byte instead of the real response to
      // frame 1, misaligning everything that follows.
      await drainStale();

      const openCmd = new Uint8Array(70).fill(0xad);
      await writeToPort(serialPort, openCmd);

      let totalRetries = 0;
      const maxAttempts = 3;

      for (let fi = 0; fi < frames.length; fi++) {
        // Apply mirroring transformation to match physical cube orientation
        const transformedFrame = mirrorX(frames[fi]);
        const buf = new Uint8Array(66);
        buf[0] = 0xf2;
        let checksum = 0;
        for (let i = 0; i < 64; i++) {
          const b = transformedFrame[i] || 0;
          buf[i + 1] = b;
          checksum = (checksum + b) & 0xff;
        }
        buf[65] = checksum; // receiver sketch validates this before ACKing

        let acked = false;
        let lastFailReason = null;
        for (let attempt = 1; attempt <= maxAttempts && !acked; attempt++) {
          if (attempt > 1) {
            totalRetries++;
            // give a slow-but-real response a moment to land, then discard
            // it -- otherwise it could get misattributed to this new
            // attempt's write below.
            await drainStale();
          }
          await writeToPort(serialPort, buf);
          try {
            const ack = await readByte(1500);
            if (ack === 0xaa) {
              acked = true;
            } else if (ack === 0xff) {
              lastFailReason = 'checksum mismatch';
            } else {
              lastFailReason = `unexpected response 0x${ack.toString(16)}`;
            }
          } catch (readErr) {
            lastFailReason = 'no response (timeout)';
          }
        }

        if (!acked) {
          throw new Error(
            `Frame ${fi + 1}/${frames.length} failed after ${maxAttempts} attempts (${lastFailReason}). ` +
              (lastFailReason === 'no response (timeout)'
                ? `If this is happening right at frame 1, the board may still be resetting ` +
                  `(opening the serial port resets most Arduino boards) — try Disconnect, ` +
                  `wait a couple seconds, then Connect and Send again.`
                : `If this keeps happening on random frames, displayFrame() may be blocking too long ` +
                  `and overflowing the board's serial buffer before it can ACK.`),
          );
        }
      }

      const closeCmd = new Uint8Array(70).fill(0xed);
      await writeToPort(serialPort, closeCmd);
      showToast(
        totalRetries > 0
          ? `Sent ${frames.length} frame(s) — all acknowledged (${totalRetries} retry${
              totalRetries === 1 ? '' : 'ies'
            } needed)`
          : `Sent ${frames.length} frame(s) — all acknowledged`,
      );
    } catch (e) {
      showToast(e.message || 'Send failed');
    } finally {
      if (reader) {
        try {
          reader.releaseLock();
        } catch (e) {}
      }
      setSending(false);
      setConfirmSend(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('Copied to clipboard'));
  }

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  }

  const displayFrame = frames[current];

  return (
    <div className='app-full'>
      <header>
        <h1>LED Cube Designer</h1>
        <button
          className='help-toggle'
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title='Toggle light/dark theme'
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className='help-toggle' onClick={() => setShowHelp(true)}>
          ?
        </button>
      </header>

      <main>
        <div className='preview-row'>
          <Cube3D
            frame={displayFrame}
            size={1.2}
            theme={theme}
            onionSkin={onionSkin}
            prevFrame={current > 0 ? frames[current - 1] : null}
            nextFrame={
              current < frames.length - 1 ? frames[current + 1] : null
            }
            onReady={(canvas) => {
              cubeCanvasRef.current = canvas;
            }}
          />
          <label className='onion-toggle'>
            <input
              type='checkbox'
              checked={onionSkin}
              onChange={(e) => setOnionSkin(e.target.checked)}
            />
            Onion skin (show neighboring frames as ghosts)
          </label>
        </div>

        <div className='timeline-row'>
          <div className='timeline-wrapper'>
            <div className='timeline-strip'>
              {frames.map((_, i) => (
                <div
                  key={i}
                  className={i === current ? 'tile active' : 'tile'}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className='playback-bar'>
              <button onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
                ◀
              </button>
              <button
                className='btn-primary'
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() =>
                  setCurrent((c) => Math.min(frames.length - 1, c + 1))
                }
              >
                ▶
              </button>
              <button
                onClick={() => setPlayDirection((d) => -d)}
                title={
                  playDirection === 1
                    ? 'Playing forward — click to reverse'
                    : 'Playing in reverse — click for forward'
                }
              >
                {playDirection === 1 ? '⇥ Forward' : '⇤ Reverse'}
              </button>
              <span className='time-indicator'>
                Frame {current + 1} / {frames.length}
              </span>
              <label>
                Delay (ms):{' '}
                <input
                  type='number'
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  style={{ width: 60 }}
                />
              </label>
              <label title="Override just this frame's hold time (blank = use the Delay above)">
                Frame hold (ms):{' '}
                <input
                  type='number'
                  placeholder={String(delayMs)}
                  value={
                    typeof frameDelays[current] === 'number'
                      ? frameDelays[current]
                      : ''
                  }
                  onChange={(e) =>
                    setCurrentFrameDelay(
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                  style={{ width: 70 }}
                />
              </label>
              <button
                onClick={clearCurrentFrameDelay}
                disabled={typeof frameDelays[current] !== 'number'}
                title="Clear this frame's override and use the global Delay again"
              >
                Use Default
              </button>
              <button
                onClick={undo}
                disabled={undoStack.current.length === 0}
                title='Undo (Ctrl+Z)'
              >
                ↺ Undo
              </button>
              <button
                onClick={redo}
                disabled={redoStack.current.length === 0}
                title='Redo (Ctrl+Shift+Z)'
              >
                ↻ Redo
              </button>
            </div>
          </div>
        </div>

        <div className='centered-row'>
          <div className='left-column'>
            <div className='text-animate card-panel'>
              <h4>Text & Glyph Animation</h4>
              <label
                className='onion-toggle'
                style={{ marginTop: 0, marginBottom: 12 }}
              >
                <input
                  type='checkbox'
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                />
                Add to end of timeline (unchecked replaces it)
              </label>
              <div style={{ marginBottom: 10 }}>
                <input
                  type='text'
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder='Text'
                />
                <button className='btn-primary' onClick={startTextScroll}>
                  Scroll Text
                </button>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>
                  Number of Sides to display text:{' '}
                  <input
                    type='number'
                    min={1}
                    max={4}
                    value={scrollSides}
                    onChange={(e) => setScrollSides(Number(e.target.value))}
                    style={{ width: 50 }}
                  />
                </label>
              </div>
              <div>
                <input
                  type='text'
                  value={glyphInput}
                  onChange={(e) =>
                    setGlyphInput(e.target.value.slice(0, 1).toUpperCase())
                  }
                  placeholder='A'
                  style={{ width: 50 }}
                />
                <button className='btn-primary' onClick={startGlyphSpin}>
                  Spin Glyph
                </button>
                <select
                  value={glyphMode}
                  onChange={(e) => setGlyphMode(e.target.value)}
                >
                  <option value='flat'>Flat</option>
                  <option value='3d'>3D</option>
                </select>
                {/* Emoticon selector - uses 3D spinner */}
                <div style={{ marginTop: 8 }}>
                  <select
                    value={emoticon}
                    onChange={(e) => setEmoticon(e.target.value)}
                  >
                    <optgroup label='Emoticons'>
                      <option value='SMILE'>🙂 SMILE</option>
                      <option value='SAD'>☹️ SAD</option>
                      <option value='WINK'>😉 WINK</option>
                      <option value='HEART'>💗 HEART</option>
                      <option value='SHOCK'>😮 SHOCK</option>
                      <option value='ANGRY'>😡 ANGRY</option>
                      <option value='BORED'>🫩 BORED</option>
                      <option value='TONGUE'>😛 TONGUE</option>
                    </optgroup>
                    <optgroup label='Arrows'>
                      <option value='ARROW_UP'>⬆️ ARROW UP</option>
                      <option value='ARROW_DOWN'>⬇️ ARROW DOWN</option>
                      <option value='ARROW_LEFT'>⬅️ ARROW LEFT</option>
                      <option value='ARROW_RIGHT'>➡️ ARROW RIGHT</option>
                    </optgroup>
                    <optgroup label='Card Suits'>
                      <option value='SPADE'>♠️ SPADE</option>
                      <option value='DIAMOND'>♦️ DIAMOND</option>
                      <option value='CLUB'>♣️ CLUB</option>
                    </optgroup>
                    <optgroup label='Seasonal'>
                      <option value='SNOWFLAKE'>❄️ SNOWFLAKE</option>
                      <option value='TREE'>🎄 TREE</option>
                      <option value='PUMPKIN'>🎃 PUMPKIN</option>
                    </optgroup>
                    <optgroup label='Retro'>
                      <option value='GHOST'>👻 GHOST</option>
                      <option value='PACMAN'>🟡 PAC-MAN</option>
                      <option value='INVADER'>👾 INVADER</option>
                    </optgroup>
                  </select>
                  <button
                    className='btn-primary'
                    onClick={startEmoticonSpin}
                    style={{ marginLeft: 8 }}
                  >
                    Spin Selected Icon
                  </button>
                </div>
              </div>
            </div>

            <div className='card-panel'>
              <h4>Import Image</h4>
              <p className='muted' style={{ marginTop: -4 }}>
                Downsampled to 8×8 and thresholded to on/off — also respects
                "Add to end of timeline" above.
              </p>
              <div className='files'>
                <label>
                  <input
                    type='file'
                    accept='image/*'
                    onChange={handleImageImport}
                    style={{ display: 'none' }}
                  />
                  <button as='span'>🖼️ Choose Image…</button>
                </label>
              </div>
              <div style={{ marginTop: 8 }}>
                <label>
                  Threshold:{' '}
                  <input
                    type='range'
                    min={0}
                    max={255}
                    value={imageThreshold}
                    onChange={(e) =>
                      setImageThreshold(Number(e.target.value))
                    }
                  />{' '}
                  {imageThreshold}
                </label>
              </div>
              <label
                className='onion-toggle'
                style={{ marginTop: 8, marginBottom: 0 }}
              >
                <input
                  type='checkbox'
                  checked={imageSpin}
                  onChange={(e) => setImageSpin(e.target.checked)}
                />
                Spin it (unchecked = single static frame)
              </label>
            </div>

            <div className='card-panel'>
              <h4>Audio Reactive</h4>
              <p className='muted' style={{ marginTop: -4 }}>
                Records your mic for a few seconds into bar-chart frames you
                can then edit, save, or export like anything else.
              </p>
              <div className='files'>
                <label>
                  Seconds:{' '}
                  <input
                    type='number'
                    min={1}
                    max={30}
                    value={audioDuration}
                    disabled={audioRecording}
                    onChange={(e) => setAudioDuration(Number(e.target.value))}
                    style={{ width: 50 }}
                  />
                </label>
                {!audioRecording ? (
                  <button className='btn-primary' onClick={startAudioRecording}>
                    🎤 Record
                  </button>
                ) : (
                  <button className='btn-danger' onClick={stopAudioRecording}>
                    ⏹ Stop ({audioSecondsLeft}s left)
                  </button>
                )}
              </div>
            </div>

            <div className='card-panel'>
              <h4>Patterns</h4>
              <p className='muted' style={{ marginTop: -4 }}>
                Procedural animations — respect the "Add to end of timeline"
                toggle above.
              </p>
              <div className='files'>
                <button onClick={startSpherePattern}>💠 Sphere</button>
                <button onClick={startRainPattern}>🌧️ Rain</button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <select
                  value={scannerAxis}
                  onChange={(e) => setScannerAxis(e.target.value)}
                >
                  <option value='z'>Z axis</option>
                  <option value='x'>X axis</option>
                  <option value='y'>Y axis</option>
                </select>
                <button onClick={startScannerPattern}>📡 Scanner</button>
                <button onClick={startSparklePattern}>✨ Sparkle</button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <button onClick={startWireframeCubePattern}>
                  🧊 Wireframe Cube
                </button>
                <button onClick={startSpiralPattern}>🌀 Spiral</button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <button onClick={startBouncingBallPattern}>
                  🏓 Bouncing Ball
                </button>
                <button onClick={startFireworksPattern}>🎆 Fireworks</button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <button onClick={startExpandingCubePattern}>
                  📦 Expanding Cube
                </button>
                <button onClick={startWavePattern}>🌊 Wave</button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <button onClick={startSnakePattern}>🐍 Snake</button>
                <button onClick={startFillDrainPattern}>
                  🥤 Fill / Drain
                </button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <button onClick={startCheckerboardPattern}>
                  🏁 Checkerboard
                </button>
                <button onClick={startDiagonalScannerPattern}>
                  ↗️ Diagonal Scanner
                </button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <button onClick={startEdgeChasePattern}>
                  🔗 Edge Chase
                </button>
                <button onClick={startOrbitPattern}>🛰️ Orbit</button>
              </div>
              <div className='files' style={{ marginTop: 8 }}>
                <button className='btn-primary' onClick={startRandomPattern}>
                  🎲 Randomize
                </button>
              </div>
            </div>
          </div>

          <div className='left'>
            <CubeEditor
              frame={frames[current]}
              onChange={(f) => updateFrame(current, f)}
              showToast={showToast}
            />
          </div>

          <aside className='right'>
            <div className='sidebar-tabs'>
              <button
                className={activeTab === 'playback' ? 'active' : ''}
                onClick={() => setActiveTab('playback')}
              >
                Playback
              </button>
              <button
                className={activeTab === 'tools' ? 'active' : ''}
                onClick={() => setActiveTab('tools')}
              >
                Tools
              </button>
              <button
                className={activeTab === 'export' ? 'active' : ''}
                onClick={() => setActiveTab('export')}
              >
                Export
              </button>
            </div>

            <div className='sidebar-content'>
              {activeTab === 'playback' && (
                <div>
                  <button onClick={addBlankFrame}>➕ New Frame</button>
                  <button onClick={duplicateFrame}>📋 Duplicate</button>
                  <button onClick={copyFrame}>Copy Frame</button>
                  <button onClick={pasteFrame} disabled={!frameClipboard}>
                    Paste Frame
                  </button>
                  <button className='btn-danger' onClick={deleteFrame}>
                    🗑️ Delete
                  </button>
                  <button onClick={insertTransition}>Insert Transition</button>
                  <label>
                    Steps:{' '}
                    <input
                      type='number'
                      value={transitionSteps}
                      onChange={(e) =>
                        setTransitionSteps(Number(e.target.value))
                      }
                      style={{ width: 50 }}
                    />
                  </label>
                  <label>
                    Easing:{' '}
                    <select
                      value={transitionEasing}
                      onChange={(e) => setTransitionEasing(e.target.value)}
                    >
                      <option value='linear'>Linear</option>
                      <option value='easeIn'>Ease In</option>
                      <option value='easeOut'>Ease Out</option>
                      <option value='easeInOut'>Ease In-Out</option>
                    </select>
                  </label>
                </div>
              )}

              {activeTab === 'tools' && (
                <div className='tools-panel'>
                  <h4>Transform</h4>
                  <button
                    onClick={() =>
                      updateFrame(current, mirrorX(frames[current]))
                    }
                  >
                    Mirror X
                  </button>
                  <button
                    onClick={() =>
                      updateFrame(current, mirrorY(frames[current]))
                    }
                  >
                    Mirror Y
                  </button>
                  <button
                    onClick={() =>
                      updateFrame(current, mirrorZ(frames[current]))
                    }
                  >
                    Mirror Z
                  </button>
                  <button
                    onClick={() =>
                      updateFrame(current, rotateZ90(frames[current]))
                    }
                  >
                    Rotate 90°
                  </button>

                  <h4>Sequence</h4>
                  <button onClick={reverseFrames} disabled={frames.length < 2}>
                    ⇄ Reverse Frame Order
                  </button>
                  <button className='btn-danger' onClick={clearAllFrames}>
                    🗑️ Clear All Frames
                  </button>
                  <p className='muted' style={{ marginTop: 4 }}>
                    Scroll Text / Spin Glyph / Spin Emoticon / Patterns now
                    add to the end of the timeline by default — use this to
                    start a fresh animation instead. (Undo works here too.)
                  </p>

                  <h4>Presets</h4>
                  <p className='muted' style={{ marginTop: -4 }}>
                    Saved in this browser only (not synced or shared).
                  </p>
                  <div className='files'>
                    <input
                      type='text'
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder='Preset name'
                      style={{ width: 120 }}
                    />
                    <button onClick={savePreset} disabled={!presetName.trim()}>
                      Save Preset
                    </button>
                  </div>
                  <div className='files' style={{ marginTop: 8 }}>
                    <select
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                    >
                      <option value=''>— choose a preset —</option>
                      {Object.keys(presets).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={loadPreset}
                      disabled={!selectedPreset}
                    >
                      Load
                    </button>
                    <button
                      className='btn-danger'
                      onClick={deletePreset}
                      disabled={!selectedPreset}
                    >
                      Delete
                    </button>
                  </div>

                  <h4>Files</h4>
                  <div className='files'>
                    <label>
                      <input
                        type='file'
                        accept='application/json'
                        onChange={loadJSON}
                        style={{ display: 'none' }}
                      />
                      <button as='span'>Load JSON</button>
                    </label>
                    <button onClick={saveJSON}>Save JSON</button>
                  </div>

                  <h4>Serial</h4>
                  <p className='muted' style={{ marginTop: -4 }}>
                    "Send" streams frames live to a board running the{' '}
                    <strong>Receiver Sketch</strong> (Export tab). It won't
                    do anything if your board has a different sketch
                    flashed — reflash with the Receiver Sketch first.
                  </p>
                  <div className='serial'>
                    <button
                      onClick={connectSerial}
                      disabled={!!serialPort || connecting}
                    >
                      {connecting ? 'Connecting…' : 'Connect'}
                    </button>
                    <button
                      onClick={disconnectSerial}
                      disabled={!serialPort}
                    >
                      Disconnect
                    </button>
                    <button
                      className='btn-danger'
                      onClick={() => setConfirmSend(true)}
                      disabled={!serialPort || sending}
                    >
                      Send
                    </button>
                    {confirmSend && (
                      <button className='btn-danger' onClick={sendFrames}>
                        Confirm Send
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'export' && (
                <div>
                  <h4>Export Options</h4>
                  <button
                    onClick={() =>
                      copyToClipboard(framesToCArray(frames, 'ANIM'))
                    }
                  >
                    Copy C Array
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(generateHFile('ANIM', frames), 'ANIM.h')
                    }
                  >
                    Download .h
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(generateSketch('ANIM', frames), 'ANIM.ino')
                    }
                  >
                    Download .ino
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(
                        generateStreamingReceiverSketch(),
                        'receiver.ino',
                      )
                    }
                  >
                    Receiver Sketch
                  </button>

                  <h4>Share</h4>
                  <button onClick={exportVideo}>🎥 Export Video</button>
                  <p className='muted' style={{ marginTop: 4 }}>
                    Records one full loop of the 3D preview as a .webm
                    video, for sharing without needing the physical cube on
                    camera. Briefly takes over playback while recording.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {toast && <div className='toast'>{toast}</div>}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
