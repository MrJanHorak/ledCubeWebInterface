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

export default function AppClean() {
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
  const [displayReverse, setDisplayReverse] = useState(true);
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

  // simplified UI to validate
  return (
    <div className='app-full'>
      <header>
        <h1>LED Cube Designer (clean)</h1>
      </header>

      <main>
        <div className='preview-row'>
          <Cube3D frame={frames[current]} />
        </div>

        <div className='timeline-row'>
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
        </div>

        <div className='editor-row centered-row'>
          <div className='text-animate card-panel'>
            <h4>Text & Glyph</h4>
            <input
              type='text'
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            <button onClick={startTextScroll}>Scroll</button>
            <input
              type='text'
              value={glyphInput}
              onChange={(e) => setGlyphInput(e.target.value)}
            />
            <button onClick={startGlyphSpin}>Spin</button>
          </div>

          <div className='left'>
            <CubeEditor
              frame={frames[current]}
              onChange={(f) => updateFrame(current, f)}
            />
          </div>

          <aside className='right card-panel'>
            <button onClick={() => setActiveTab('playback')}>Playback</button>
            <button onClick={() => setActiveTab('tools')}>Tools</button>
            <div>
              <button onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause' : 'Play'}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
