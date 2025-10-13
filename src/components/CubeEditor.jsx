import React, { useState, useEffect } from 'react';

// Props: frame (array of 64 bytes), onChange(newFrame)
export default function CubeEditor({ frame, onChange }) {
  const [layer, setLayer] = useState(0);
  const [local, setLocal] = useState(
    frame ? frame.slice() : new Array(64).fill(0x00)
  );

  useEffect(() => {
    setLocal(frame ? frame.slice() : new Array(64).fill(0x00));
  }, [frame]);

  function toggle(x, y) {
    const idx = 8 * y + x;
    const mask = 1 << layer;
    const copy = local.slice();
    copy[idx] = copy[idx] ^ mask;
    setLocal(copy);
    if (onChange) onChange(copy);
  }

  function setLayerAllOn() {
    const copy = local.slice();
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) copy[8 * y + x] |= 1 << layer;
    setLocal(copy);
    onChange(copy);
  }

  function setLayerAllOff() {
    const copy = local.slice();
    const inv = ~(1 << layer);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) copy[8 * y + x] &= inv;
    setLocal(copy);
    onChange(copy);
  }

  return (
    <div className='cube-editor'>
      <div
        className='layer-controls'
        role='toolbar'
        aria-label='Layer controls'
      >
        <button
          title='Previous layer (Shift+Up)'
          onClick={() => setLayer((layer + 7) % 8)}
        >
          ⬆
        </button>
        <span aria-live='polite'>Layer {layer}</span>
        <button
          title='Next layer (Shift+Down)'
          onClick={() => setLayer((layer + 1) % 8)}
        >
          ⬇
        </button>
        <button onClick={setLayerAllOn} title='Turn this layer on'>
          All On
        </button>
        <button onClick={setLayerAllOff} title='Turn this layer off'>
          All Off
        </button>
      </div>

      <div className='grid' role='grid' aria-label={`Layer ${layer} editor`}>
        {[...Array(8)].map((_, y) => (
          <div className='row' key={y} role='row'>
            {[...Array(8)].map((_, x) => {
              const idx = 8 * y + x;
              const mask = 1 << layer;
              const on = (local[idx] & mask) !== 0;
              return (
                <div
                  key={x}
                  role='gridcell'
                  tabIndex={0}
                  aria-checked={on}
                  title={`Toggle x=${x} y=${y} z=${layer}`}
                  className={on ? 'cell on' : 'cell'}
                  onClick={() => toggle(x, y)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(x, y);
                    }
                  }}
                ></div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
