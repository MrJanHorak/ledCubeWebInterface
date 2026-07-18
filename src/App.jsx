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
} from './utils/exporter';
import {
  mirrorX,
  mirrorY,
  mirrorZ,
  rotateZ90,
  interpolateFrames,
} from './utils/drawHelpers';

export default function App() {
  const [frames, setFrames] = useState([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playDirection, setPlayDirection] = useState(1);
  const [onionSkin, setOnionSkin] = useState(false);
  const [delayMs, setDelayMs] = useState(300);
  const [serialPort, setSerialPort] = useState(null);
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

  const playRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [historyTick, setHistoryTick] = useState(0); // forces re-render so Undo/Redo buttons enable/disable correctly

  // Use this instead of setFrames directly for any user edit that should be
  // undoable. Navigation (setCurrent, setPlaying, etc.) is intentionally NOT
  // tracked -- only the frame data itself.
  function commitFrames(updater) {
    setFrames((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      undoStack.current.push(prev);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      setHistoryTick((t) => t + 1);
      return next;
    });
  }

  function undo() {
    if (undoStack.current.length === 0) return;
    setFrames((prev) => {
      const last = undoStack.current.pop();
      redoStack.current.push(prev);
      setHistoryTick((t) => t + 1);
      setCurrent((c) => Math.min(c, Math.max(0, last.length - 1)));
      return last;
    });
  }

  function redo() {
    if (redoStack.current.length === 0) return;
    setFrames((prev) => {
      const next = redoStack.current.pop();
      undoStack.current.push(prev);
      setHistoryTick((t) => t + 1);
      setCurrent((c) => Math.min(c, Math.max(0, next.length - 1)));
      return next;
    });
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
    playRef.current = setInterval(
      () => {
        setCurrent(
          (c) => (c + playDirection + frames.length) % frames.length,
        );
      },
      Math.max(50, delayMs),
    );
    return () => clearInterval(playRef.current);
  }, [playing, playDirection, delayMs, frames.length]);

  const showToast = (msg, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  function updateFrame(i, newFrame) {
    commitFrames((f) => {
      const copy = f.slice();
      copy[i] = newFrame.slice();
      return copy;
    });
  }

  function addBlankFrame() {
    commitFrames((f) => [...f, new Array(64).fill(0x00)]);
    setCurrent(frames.length);
  }

  function duplicateFrame() {
    commitFrames((f) => {
      const copy = f.slice();
      copy.splice(current + 1, 0, copy[current].slice());
      return copy;
    });
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
    commitFrames((f) => {
      const copy = f.slice();
      copy.splice(current, 1);
      return copy;
    });
    setCurrent((c) => Math.max(0, c - 1));
  }

  function reverseFrames() {
    commitFrames((f) => f.slice().reverse());
    setCurrent((c) => Math.max(0, frames.length - 1 - c));
    showToast('Frame order reversed');
  }

  function startTextScroll() {
    const txtFrames = generateTextFrames(textInput, scrollSides, 'ltr');
    if (!txtFrames || txtFrames.length === 0)
      return showToast('No text to scroll');
    commitFrames(txtFrames);
    setCurrent(0);
    setActiveTab('playback');
  }

  function startGlyphSpin() {
    const glyphFrames = generateGlyphFrames(glyphInput || 'A', 6, glyphMode);
    commitFrames(glyphFrames);
    setCurrent(0);
    setActiveTab('playback');
  }

  function startEmoticonSpin() {
    // force 3D mode for emoticons
    const steps = 8; // smoothness of spin
    const glyphFrames = generateGlyphFrames(emoticon || 'SMILE', steps, '3d');
    if (!glyphFrames || glyphFrames.length === 0)
      return showToast('No emoticon frames');
    commitFrames(glyphFrames);
    setCurrent(0);
    setActiveTab('playback');
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
    commitFrames((f) => {
      const copy = f.slice();
      copy.splice(next, 0, ...tween);
      return copy;
    });
    showToast('Transition inserted');
  }

  function loadJSON(ev) {
    const f = ev?.target?.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          commitFrames(data);
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
      [name]: { frames, delayMs, savedAt: new Date().toISOString() },
    };
    persistPresets(next);
    setSelectedPreset(name);
    setPresetName('');
    showToast(`Saved preset "${name}"`);
  }

  function loadPreset() {
    const preset = presets[selectedPreset];
    if (!preset) return;
    commitFrames(preset.frames);
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
    const blob = new Blob([JSON.stringify(frames, null, 2)], {
      type: 'application/json',
    });
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
      setSerialPort(port);
      showToast('Connected to Serial');
    } catch (e) {
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

      // A previous Send that errored out partway can leave stray bytes
      // sitting in the queue (e.g. an ACK the device sent right as we gave
      // up). If we don't drain those first, this session's first readByte()
      // call picks up that leftover byte instead of the real response to
      // frame 1, misaligning everything that follows.
      for (let i = 0; i < 200; i++) {
        try {
          await readByte(20);
        } catch (e) {
          break; // nothing waiting -- queue is empty
        }
      }

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
          if (attempt > 1) totalRetries++;
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
              `If this keeps happening on random frames, displayFrame() may be blocking too long ` +
              `and overflowing the board's serial buffer before it can ACK.`,
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
          <div className='text-animate card-panel'>
            <h4>Text & Glyph Animation</h4>
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
                  <option value='SMILE'>🙂 SMILE</option>
                  <option value='SAD'>☹️ SAD</option>
                  <option value='WINK'>😉 WINK</option>
                  <option value='HEART'>💗 HEART</option>
                  <option value='SHOCK'>😮 SHOCK</option>
                  <option value='ANGRY'>😡 ANGRY</option>
                  <option value='BORED'>🫩 BORED</option>
                  <option value='TONGUE'>😛 TONGUE</option>
                </select>
                <button
                  className='btn-primary'
                  onClick={startEmoticonSpin}
                  style={{ marginLeft: 8 }}
                >
                  Spin Emoticon
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
                    <button onClick={connectSerial} disabled={!!serialPort}>
                      Connect
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
