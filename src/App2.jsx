import React, { useState, useEffect, useRef } from 'react';
import CubeEditor from './components/CubeEditor';
import Cube3D from './components/Cube3D';
import HelpOverlay from './components/HelpOverlay';
import { framesForJAN } from './utils/exporter';
import { mirrorX } from './utils/drawHelpers';

export default function App() {
  const [frames, setFrames] = useState(framesForJAN());
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delayMs, setDelayMs] = useState(200);
  const [textInput, setTextInput] = useState('HELLO');
  const [glyphInput, setGlyphInput] = useState('A');
  const [toast, setToast] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const playRef = useRef(null);
  useEffect(() => {
    if (!playing) return;
    playRef.current = setInterval(
      () => setCurrent((c) => (c + 1) % frames.length),
      Math.max(50, delayMs)
    );
    return () => clearInterval(playRef.current);
  }, [playing, delayMs, frames.length]);

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className='app-full'>
      <header>
        <h1>LED Cube Designer (Clean)</h1>
        <button className='help-toggle' onClick={() => setShowHelp(true)}>
          ?
        </button>
      </header>
      <main>
        <div className='preview-row'>
          <Cube3D frame={mirrorX(frames[current])} />
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
              <button onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>
        </div>

        <div className='editor-row centered-row'>
          <div className='text-animate card-panel'>
            <h4>Text & Glyph</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <button onClick={() => showToast('Text generated')}>
                Scroll
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={glyphInput}
                onChange={(e) => setGlyphInput(e.target.value.slice(0, 1))}
                style={{ width: 48 }}
              />
              <button onClick={() => showToast('Glyph spun')}>Spin</button>
            </div>
          </div>

          <div className='left'>
            <CubeEditor frame={frames[current]} onChange={() => {}} />
          </div>

          <aside className='right card-panel'>
            <button onClick={() => showToast('Exported')}>Export</button>
          </aside>
        </div>
      </main>
      {toast && <div className='toast'>{toast}</div>}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
