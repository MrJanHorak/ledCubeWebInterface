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
  const [frames, setFrames] = useState(framesForJAN());
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delayMs, setDelayMs] = useState(300);
  const [serialPort, setSerialPort] = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [textInput, setTextInput] = useState('HELLO');
  const [glyphInput, setGlyphInput] = useState('A');
  const [scrollSides, setScrollSides] = useState(1);
  const [glyphMode, setGlyphMode] = useState('flat');
  const [displayMirrorX, setDisplayMirrorX] = useState(false);
  const [transitionSteps, setTransitionSteps] = useState(6);
  const [activeTab, setActiveTab] = useState('playback');
  const [toast, setToast] = useState(null);

  const playRef = useRef(null);

  useEffect(() => {
    if (!playing) return;
    playRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % frames.length);
    }, Math.max(50, delayMs));
    return () => clearInterval(playRef.current);
  }, [playing, delayMs, frames.length]);

  const showToast = (msg, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  function updateFrame(i, newFrame) {
    setFrames((f) => {
      const copy = f.slice();
      copy[i] = newFrame.slice();
      return copy;
    });
  }

  function addBlankFrame() {
    setFrames((f) => [...f, new Array(64).fill(0x00)]);
    setCurrent(frames.length);
  }

  function duplicateFrame() {
    setFrames((f) => {
      const copy = f.slice();
      copy.splice(current + 1, 0, copy[current].slice());
      return copy;
    });
    setCurrent((c) => c + 1);
  }

  function deleteFrame() {
    if (frames.length <= 1) return;
    setFrames((f) => {
      const copy = f.slice();
      copy.splice(current, 1);
      return copy;
    });
    setCurrent((c) => Math.max(0, c - 1));
  }

  function startTextScroll() {
    const txtFrames = generateTextFrames(textInput, scrollSides, 'ltr');
    if (!txtFrames || txtFrames.length === 0)
      return showToast('No text to scroll');
    setFrames(txtFrames);
    setCurrent(0);
    setActiveTab('playback');
  }

  function startGlyphSpin() {
    const glyphFrames = generateGlyphFrames(glyphInput || 'A', 6, glyphMode);
    setFrames(glyphFrames);
    setCurrent(0);
    setActiveTab('playback');
  }

  function insertTransition() {
    const next = Math.min(current + 1, frames.length - 1);
    const a = frames[current];
    const b = frames[next];
    const tween = interpolateFrames(a, b, Number(transitionSteps) || 4);
    setFrames((f) => {
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
          setFrames(data);
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

  async function sendFrames() {
    if (!serialPort) return showToast('No serial port connected');
    setSending(true);
    try {
      const openCmd = new Uint8Array(70).fill(0xad);
      await writeToPort(serialPort, openCmd);
      for (const frame of frames) {
        const buf = new Uint8Array(65);
        buf[0] = 0xf2;
        for (let i = 0; i < 64; i++) buf[i + 1] = frame[i] || 0;
        await writeToPort(serialPort, buf);
      }
      const closeCmd = new Uint8Array(70).fill(0xed);
      await writeToPort(serialPort, closeCmd);
      showToast('Frames sent');
    } catch (e) {
      showToast('Send failed');
    } finally {
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

  const displayFrame = displayMirrorX
    ? mirrorX(frames[current])
    : frames[current];

  return (
    <div className='app-full'>
      <header>
        <h1>LED Cube Designer</h1>
        <button className='help-toggle' onClick={() => setShowHelp(true)}>
          ?
        </button>
      </header>

      <main>
        <div className='preview-row'>
          <Cube3D frame={displayFrame} size={1.2} />
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
              <button onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() =>
                  setCurrent((c) => Math.min(frames.length - 1, c + 1))
                }
              >
                ▶
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
              <button onClick={startTextScroll}>Scroll Text</button>
              <label>
                Sides:{' '}
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
              <button onClick={startGlyphSpin}>Spin Glyph</button>
              <select
                value={glyphMode}
                onChange={(e) => setGlyphMode(e.target.value)}
              >
                <option value='flat'>Flat</option>
                <option value='3d'>3D</option>
              </select>
            </div>
          </div>

          <div className='left'>
            <CubeEditor
              frame={frames[current]}
              onChange={(f) => updateFrame(current, f)}
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
                  <button onClick={deleteFrame}>🗑️ Delete</button>
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
                  <div className='serial'>
                    <button onClick={connectSerial} disabled={!!serialPort}>
                      Connect
                    </button>
                    <button
                      onClick={() => setConfirmSend(true)}
                      disabled={!serialPort || sending}
                    >
                      Send
                    </button>
                    {confirmSend && (
                      <button onClick={sendFrames}>Confirm Send</button>
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
                        'receiver.ino'
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
