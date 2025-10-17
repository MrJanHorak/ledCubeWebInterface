import React, { useState, useEffect, useRef } from 'react';
import CubeEditor from './components/CubeEditor';
import Cube3D from './components/Cube3D';
import HelpOverlay from './components/HelpOverlay';
import { requestPort, openPort, writeToPort, closePort } from './utils/serial';
import {
  framesForJAN,
  framesToCArray,
  generateHFile,
  generateSketch,
  generateTextFrames,
  generateGlyphFrames,
} from './utils/exporter';
import {
  mirrorX,
  mirrorY,
  mirrorZ,
  rotateZ90,
  interpolateFrames,
} from './utils/drawHelpers';

export default function App() {
  const [frames, setFrames] = useState(framesForJAN());
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delayMs, setDelayMs] = useState(300);
  const playRef = useRef(null);
  const [serialPort, setSerialPort] = useState(null);
  const [transitionSteps, setTransitionSteps] = useState(6);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [textInput, setTextInput] = useState('HELLO');
  const [glyphInput, setGlyphInput] = useState('A');
  const [scrollSides, setScrollSides] = useState(1);
  const [glyphMode, setGlyphMode] = useState('flat');
  const [displayMirrorX, setDisplayMirrorX] = useState(false);
  // default preview shows Right->Left (western reading flow)
  const [displayReverse, setDisplayReverse] = useState(true);

  // keyboard shortcuts: space = play/pause, left/right = prev/next
  useEffect(() => {
    function onKey(e) {
      if (
        e.target &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      )
        if (e.code === 'KeyH' || e.key === '?') {
          // toggle help with H or ?
          setShowHelp((s) => !s);
        }
      // close help with Escape
      if (e.key === 'Escape') {
        setShowHelp(false);
      }
      return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.code === 'ArrowLeft') {
        setCurrent((c) => Math.max(0, c - 1));
      }
      if (e.code === 'ArrowRight') {
        setCurrent((c) => Math.min(frames.length - 1, current + 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length, current]);

  // frame ops
  const updateFrame = (i, f) => {
    // incoming f is from the editor (visual). The editor shows a mirrored/flipped
    // view for convenience; we need to unmirror before storing so transmitted
    // frames retain logical orientation. If displayMirrorX is enabled we flip back.
    const nf = frames.slice();
    let toStore = f;
    if (displayMirrorX) toStore = mirrorX(toStore);
    nf[i] = toStore;
    setFrames(nf);
  };
  const addBlankFrame = () => {
    setFrames((s) => s.concat([new Array(64).fill(0x00)]));
    setCurrent(frames.length);
  };
  const deleteFrame = () => {
    if (frames.length <= 1) return;
    const nf = frames.slice();
    nf.splice(current, 1);
    setFrames(nf);
    setCurrent(Math.max(0, current - 1));
  };
  const duplicateFrame = () => {
    const nf = frames.slice();
    nf.splice(current + 1, 0, frames[current].slice());
    setFrames(nf);
    setCurrent(current + 1);
  };

  // exports
  const [toast, setToast] = useState(null);
  const showToast = (msg, ms = 2500) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, ms);
  };

  const copyOrShow = (text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast('Copied to clipboard'))
        .catch(() => {
          const w = window.open('', '_blank');
          w.document.body.innerHTML = '<pre>' + escapeHtml(text) + '</pre>';
        });
    } else {
      const w = window.open('', '_blank');
      w.document.body.innerHTML = '<pre>' + escapeHtml(text) + '</pre>';
    }
  };
  const exportC = () => copyOrShow(framesToCArray(frames, 'MY_ANIMATION'));
  const copyH = () => copyOrShow(generateHFile('MY_ANIMATION', frames));
  const downloadH = () => {
    const h = generateHFile('MY_ANIMATION', frames);
    const b = new Blob([h], { type: 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'MY_ANIMATION.h';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  };
  const exportSketch = () => copyOrShow(generateSketch('MY_ANIMATION', frames));
  const downloadSketch = () => {
    const s = generateSketch('MY_ANIMATION', frames);
    const b = new Blob([s], { type: 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'MY_ANIMATION.ino';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  };
  // download PROGMEM-ready sketch
  const downloadProgmemSketch = () => {
    const s = generateSketch('MY_ANIMATION', frames);
    const b = new Blob([s], { type: 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'MY_ANIMATION_PROGMEM.ino';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  };

  // download streaming receiver sketch
  const downloadReceiverSketch = () => {
    const s = generateStreamingReceiverSketch();
    const b = new Blob([s], { type: 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'LEDCube_StreamingReceiver.ino';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  };

  // file
  const saveJSON = () => {
    const b = new Blob([JSON.stringify(frames)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'animation.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  };
  const loadJSON = (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const arr = JSON.parse(e.target.result);
        setFrames(arr);
        setCurrent(0);
        showToast('Loaded JSON');
      } catch {
        showToast('Invalid JSON');
      }
    };
    r.readAsText(f);
  };

  // serial
  const connectSerial = async () => {
    try {
      const port = await requestPort();
      await openPort(port, 38400);
      setSerialPort(port);
      showToast('Serial opened');
    } catch (e) {
      showToast('Serial failed: ' + String(e));
    }
  };
  const disconnectSerial = async () => {
    if (serialPort) await closePort(serialPort);
    setSerialPort(null);
  };

  async function doSendFrames(port) {
    if (!port) {
      showToast('No serial port selected');
      return;
    }

    // Check if animation is too long for Arduino memory
    const maxFrames = 100; // Conservative limit for Arduino memory
    if (frames.length > maxFrames) {
      showToast(
        `Warning: ${frames.length} frames may exceed Arduino memory. Max recommended: ${maxFrames}`,
        5000
      );
      // Continue anyway but warn user
    }

    try {
      setSending(true);
      showToast(`Sending ${frames.length} frames...`, 2000);

      const openCmd = new Uint8Array(70).fill(0xad);
      await writeToPort(port, openCmd);
      await new Promise((r) => setTimeout(r, 100)); // Give Arduino time to process

      for (let idx = 0; idx < frames.length; idx++) {
        const f = frames[idx];
        const buf = new Uint8Array(65);
        buf[0] = 0xf2;
        for (let i = 0; i < 64; i++) buf[1 + i] = f[i] || 0;
        await writeToPort(port, buf);

        // Add small delay between frames to prevent buffer overflow
        await new Promise((r) => setTimeout(r, 50));

        // Update progress every 10 frames
        if (idx % 10 === 0) {
          showToast(`Sending frame ${idx + 1}/${frames.length}...`, 500);
        }
      }

      await new Promise((r) => setTimeout(r, 100));
      const closeCmd = new Uint8Array(70).fill(0xed);
      await writeToPort(port, closeCmd);

      showToast(`Successfully sent ${frames.length} frames!`, 3000);
    } catch (e) {
      showToast('Send failed: ' + String(e), 4000);
      console.error('Serial send error:', e);
    } finally {
      setSending(false);
      setConfirmSend(false);
    }
  }

  // send frames with checksum/ACK protocol (uses generateStreamingReceiverSketch protocol)
  async function sendWithAck(port) {
    if (!port) return;
    const FRAME_MARKER = 0xf2;
    const ACK = 0xaa;
    const NACK = 0xff;

    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();
    try {
      setSending(true);
      showToast(`Sending ${frames.length} frames with ACK...`, 2000);
      for (let idx = 0; idx < frames.length; idx++) {
        const f = frames[idx];
        const buf = new Uint8Array(66);
        buf[0] = FRAME_MARKER;
        for (let i = 0; i < 64; i++) buf[1 + i] = f[i] || 0;
        // checksum
        let sum = 0;
        for (let i = 0; i < 64; i++) sum = (sum + (f[i] || 0)) & 0xff;
        buf[65] = sum;

        // write
        await writer.write(buf);

        // wait for ACK/NACK (with timeout)
        let ok = false;
        const start = Date.now();
        while (Date.now() - start < 1000) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length) {
            for (let b of value) {
              if (b === ACK) {
                ok = true;
                break;
              }
              if (b === NACK) {
                ok = false;
                break;
              }
            }
          }
          if (ok) break;
        }
        if (!ok) {
          showToast(`Frame ${idx + 1} not ACKed`, 2000);
          // try again a couple times
          let retried = 0;
          while (!ok && retried < 2) {
            await writer.write(buf);
            retried++;
            const start2 = Date.now();
            while (Date.now() - start2 < 1000) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value && value.length) {
                for (let b of value) {
                  if (b === ACK) {
                    ok = true;
                    break;
                  }
                  if (b === NACK) {
                    ok = false;
                    break;
                  }
                }
              }
              if (ok) break;
            }
          }
        }
        if (!ok) {
          showToast(`Failed to send frame ${idx + 1}`, 3000);
          break;
        }
        if (idx % 10 === 0) showToast(`Sent ${idx + 1}/${frames.length}`, 500);
      }
      showToast('Done sending with ACK', 2000);
    } catch (e) {
      console.error('sendWithAck error', e);
      showToast('sendWithAck error: ' + String(e), 4000);
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {}
      try {
        writer.releaseLock();
      } catch (e) {}
      setSending(false);
      setConfirmSend(false);
    }
  }

  // All-On self-test
  const allOnTest = (transmit = false) => {
    const frame = new Array(64).fill(0x7f);
    setFrames([frame]);
    setCurrent(0);
    setPlaying(true);
    showToast('All-On test frame set');
    if (transmit && serialPort) {
      doSendFrames(serialPort);
    }
  };

  const sendOverSerial = () => {
    if (!serialPort) {
      showToast('No serial port. Please Connect first.');
      return;
    }
    // open confirm modal
    setConfirmSend(true);
  };

  // transforms
  const applyMirrorX = () => {
    const nf = frames.slice();
    nf[current] = mirrorX(nf[current]);
    setFrames(nf);
  };
  const applyMirrorY = () => {
    const nf = frames.slice();
    nf[current] = mirrorY(nf[current]);
    setFrames(nf);
  };
  const applyMirrorZ = () => {
    const nf = frames.slice();
    nf[current] = mirrorZ(nf[current]);
    setFrames(nf);
  };
  const applyRotateZ = () => {
    const nf = frames.slice();
    nf[current] = rotateZ90(nf[current]);
    setFrames(nf);
  };
  const insertTransition = () => {
    const next = (current + 1) % frames.length;
    const t = interpolateFrames(
      frames[current],
      frames[next],
      Number(transitionSteps) || 6
    );
    const nf = frames.slice();
    nf.splice(current + 1, 0, ...t);
    setFrames(nf);
  };

  // text & glyph animations
  const startTextScroll = () => {
    // generate preview frames RTL for on-screen reading, but keep device frames LTR
    const previewFrames = generateTextFrames(
      textInput || '',
      scrollSides,
      'rtl'
    );
    const deviceFrames = generateTextFrames(
      textInput || '',
      scrollSides,
      'ltr'
    );
    if (deviceFrames && deviceFrames.length) {
      // set the device frames for sending/playing
      setFrames(deviceFrames);
      setCurrent(0);
      setPlaying(true);
      const sidesText = scrollSides === 1 ? '1 side' : `${scrollSides} sides`;
      showToast(
        `Generated ${deviceFrames.length} frames scrolling on ${sidesText}`
      );
    } else {
      showToast('No frames generated for text');
    }
  };

  const startGlyphSpin = () => {
    const f = generateGlyphFrames(glyphInput || 'A', 12, glyphMode);
    if (f && f.length) {
      setFrames(f);
      setCurrent(0);
      setPlaying(true);
      const modeText = glyphMode === '3d' ? '3D center' : 'flat';
      showToast(`Generated ${f.length} frames (${modeText} spin)`);
    } else {
      showToast('No frames generated for glyph');
    }
  };

  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(
        () => setCurrent((c) => (c + 1) % frames.length),
        delayMs
      );
    } else {
      if (playRef.current) {
        clearInterval(playRef.current);
        playRef.current = null;
      }
    }
    return () => {
      if (playRef.current) {
        clearInterval(playRef.current);
        playRef.current = null;
      }
    };
  }, [playing, delayMs, frames.length]);

  return (
    <div className='app-full'>
      <header>
        <h1>LED Cube Designer</h1>
        <button
          className='help-toggle'
          aria-label='Show help'
          onClick={() => setShowHelp(true)}
        >
          ?
        </button>
      </header>
      <main>
        <div className='preview-row'>
          {
            // compute a display-only preview frame and an editor frame
          }
          {(() => {
            // Preview frame (for Cube3D)
            let previewIdx = displayReverse
              ? Math.max(0, frames.length - 1 - current)
              : current;
            let previewFrame =
              frames && frames[previewIdx]
                ? frames[previewIdx].slice()
                : new Array(64).fill(0x00);
            if (displayMirrorX) previewFrame = mirrorX(previewFrame);
            return <Cube3D frame={previewFrame} />;
          })()}
        </div>

        <div className='editor-row'>
          <div className='left'>
            <CubeEditor
              frame={
                displayMirrorX ? mirrorX(frames[current]) : frames[current]
              }
              onChange={(f) => updateFrame(current, f)}
            />
            <div className='controls' role='group' aria-label='Frame controls'>
              <button
                title='Previous frame (Left)'
                aria-label='Previous frame'
                onClick={() => setCurrent(Math.max(0, current - 1))}
              >
                ◀
              </button>
              <span>
                Frame {current + 1}/{frames.length}
              </span>
              <button
                title='Next frame (Right)'
                aria-label='Next frame'
                onClick={() =>
                  setCurrent(Math.min(frames.length - 1, current + 1))
                }
              >
                ▶
              </button>
              <button
                title='Add blank frame after current'
                aria-label='Add frame'
                onClick={addBlankFrame}
              >
                ＋
              </button>
              <button
                title='Duplicate current frame'
                aria-label='Duplicate frame'
                onClick={duplicateFrame}
              >
                ⎘
              </button>
              <button
                title='Delete current frame'
                aria-label='Delete frame'
                onClick={deleteFrame}
              >
                ✖
              </button>
            </div>
          </div>

          <aside className='right'>
            <h3>Timeline</h3>
            <div className='timeline'>
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

            <div className='toolbar'>
              <div
                className='play'
                role='toolbar'
                aria-label='Playback controls'
              >
                <button
                  title='Play / Stop (Space)'
                  aria-pressed={playing}
                  onClick={() => setPlaying((p) => !p)}
                >
                  {playing ? '⏸ Stop' : '▶ Play'}
                </button>
                <label title='Frame delay in milliseconds'>
                  Delay{' '}
                  <input
                    aria-label='Delay milliseconds'
                    type='number'
                    value={delayMs}
                    onChange={(e) => setDelayMs(Number(e.target.value) || 100)}
                  />
                </label>
                <label style={{ marginLeft: 12 }}>
                  <input
                    type='checkbox'
                    checked={displayMirrorX}
                    onChange={(e) => setDisplayMirrorX(e.target.checked)}
                    style={{ marginLeft: 8, marginRight: 6 }}
                  />
                  Mirror display
                </label>
                <label style={{ marginLeft: 12 }}>
                  <input
                    type='checkbox'
                    checked={displayReverse}
                    onChange={(e) => setDisplayReverse(e.target.checked)}
                    style={{ marginLeft: 8, marginRight: 6 }}
                  />
                  Reverse display direction
                </label>
              </div>

              <div className='exports'>
                <button onClick={exportC}>C Array</button>
                <button onClick={copyH}>Copy .h</button>
                <button onClick={downloadH}>Download .h</button>
                <button onClick={exportSketch}>Sketch</button>
                <button onClick={downloadSketch}>Download .ino</button>
                <button onClick={downloadProgmemSketch}>
                  Download PROGMEM .ino
                </button>
                <button onClick={downloadReceiverSketch}>
                  Download Receiver .ino
                </button>
              </div>

              <div className='files'>
                <button onClick={saveJSON}>Save JSON</button>
                <label className='load-file'>
                  <input
                    type='file'
                    accept='application/json'
                    style={{ display: 'none' }}
                    onChange={loadJSON}
                  />
                  Load JSON
                </label>
              </div>

              <div className='serial'>
                {!serialPort ? (
                  <button onClick={connectSerial}>Connect</button>
                ) : (
                  <button onClick={disconnectSerial}>Disconnect</button>
                )}
                <button onClick={sendOverSerial}>Send</button>
                <button onClick={() => sendWithAck(serialPort)}>
                  Send (with ACK)
                </button>
                <button onClick={() => allOnTest(true)}>All On & Send</button>
              </div>

              {confirmSend ? (
                <div
                  style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.35)',
                  }}
                >
                  <div
                    style={{
                      background: '#fff',
                      padding: 18,
                      borderRadius: 8,
                      minWidth: 320,
                      maxWidth: 400,
                    }}
                  >
                    <h3>Send frames to cube?</h3>
                    <p>
                      Sending <strong>{frames.length} frames</strong> to the
                      cube.
                      {frames.length > 100 && (
                        <span
                          style={{
                            color: '#d32f2f',
                            display: 'block',
                            marginTop: 8,
                          }}
                        >
                          ⚠️ Warning: Large animations ({frames.length} frames)
                          may exceed Arduino memory limits. Consider reducing to
                          &lt;100 frames for best results.
                        </span>
                      )}
                      {frames.length > 50 && frames.length <= 100 && (
                        <span
                          style={{
                            color: '#f57c00',
                            display: 'block',
                            marginTop: 8,
                          }}
                        >
                          Note: This animation has {frames.length} frames.
                          Transmission may take a while.
                        </span>
                      )}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button onClick={() => setConfirmSend(false)}>
                        Cancel
                      </button>
                      <button
                        disabled={sending}
                        onClick={() => doSendFrames(serialPort)}
                      >
                        {sending ? 'Sending...' : 'Confirm & Send'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className='helpers'>
                <button onClick={applyMirrorX}>Mirror X</button>
                <button onClick={applyMirrorY}>Mirror Y</button>
                <button onClick={applyMirrorZ}>Mirror Z</button>
                <button onClick={applyRotateZ}>Rotate Z</button>
              </div>

              <div className='trans'>
                <label>
                  Steps{' '}
                  <input
                    type='number'
                    value={transitionSteps}
                    onChange={(e) => setTransitionSteps(e.target.value)}
                  />
                </label>
                <button onClick={insertTransition}>Insert Transition</button>
              </div>

              <div className='text-animate'>
                <h4 style={{ marginTop: 16, marginBottom: 8 }}>
                  Text & Glyph Animation
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    padding: 12,
                    background: '#f5f5f5',
                    borderRadius: 8,
                  }}
                >
                  {/* Text Scrolling Section */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      <input
                        type='text'
                        aria-label='Text to scroll'
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder='Text to scroll'
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          border: '1px solid #ccc',
                          flex: 1,
                          minWidth: 120,
                        }}
                      />
                      <button onClick={startTextScroll}>Scroll Text</button>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center' }}>
                        Sides:
                        <select
                          value={scrollSides}
                          onChange={(e) =>
                            setScrollSides(Number(e.target.value))
                          }
                          style={{
                            marginLeft: 6,
                            padding: 4,
                            borderRadius: 4,
                            border: '1px solid #ccc',
                          }}
                        >
                          <option value={1}>1 (Front)</option>
                          <option value={2}>2 (Front + Right)</option>
                          <option value={3}>3 (Front + Right + Back)</option>
                          <option value={4}>4 (All sides)</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {/* Glyph Spinning Section */}
                  <div style={{ borderTop: '1px solid #ddd', paddingTop: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      <input
                        type='text'
                        aria-label='Single glyph'
                        value={glyphInput}
                        onChange={(e) =>
                          setGlyphInput(
                            e.target.value.slice(0, 1).toUpperCase()
                          )
                        }
                        placeholder='Glyph'
                        maxLength={1}
                        style={{
                          width: 48,
                          padding: 6,
                          borderRadius: 6,
                          border: '1px solid #ccc',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: 16,
                        }}
                      />
                      <button onClick={startGlyphSpin}>Spin Glyph</button>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        (A-Z, 0-9, symbols)
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type='radio'
                          name='glyphMode'
                          value='flat'
                          checked={glyphMode === 'flat'}
                          onChange={(e) => setGlyphMode(e.target.value)}
                          style={{ marginRight: 4 }}
                        />
                        Flat rotation
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type='radio'
                          name='glyphMode'
                          value='3d'
                          checked={glyphMode === '3d'}
                          onChange={(e) => setGlyphMode(e.target.value)}
                          style={{ marginRight: 4 }}
                        />
                        3D center spin
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      {toast && (
        <div className='toast' role='status'>
          {toast}
        </div>
      )}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// export { default } from './AppFull';
