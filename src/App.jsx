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
    const nf = frames.slice();
    nf[i] = f;
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
    try {
      setSending(true);
      const openCmd = new Uint8Array(70).fill(0xad);
      await writeToPort(port, openCmd);
      for (const f of frames) {
        const buf = new Uint8Array(65);
        buf[0] = 0xf2;
        for (let i = 0; i < 64; i++) buf[1 + i] = f[i] || 0;
        await writeToPort(port, buf);
        await new Promise((r) => setTimeout(r, delayMs));
      }
      const closeCmd = new Uint8Array(70).fill(0xed);
      await writeToPort(port, closeCmd);
      showToast('Sent');
    } catch (e) {
      showToast('Send failed: ' + String(e));
    } finally {
      setSending(false);
      setConfirmSend(false);
    }
  }

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
          <Cube3D frame={frames[current]} />
        </div>

        <div className='editor-row'>
          <div className='left'>
            <CubeEditor
              frame={frames[current]}
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
              </div>

              <div className='exports'>
                <button onClick={exportC}>C Array</button>
                <button onClick={copyH}>Copy .h</button>
                <button onClick={downloadH}>Download .h</button>
                <button onClick={exportSketch}>Sketch</button>
                <button onClick={downloadSketch}>Download .ino</button>
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
                    }}
                  >
                    <h3>Send frames to cube?</h3>
                    <p>
                      Frames will be sent over the currently connected serial
                      port. Continue?
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
