import React, { useState, useEffect } from 'react';

// Props: frame (array of 64 bytes), onChange(newFrame)
export default function CubeEditor({ frame, onChange }) {
  // layer now represents the front-to-back slice (y index 0..7)
  const [layer, setLayer] = useState(0);
  const [local, setLocal] = useState(
    frame ? frame.slice() : new Array(64).fill(0x00)
  );

  useEffect(() => {
    setLocal(frame ? frame.slice() : new Array(64).fill(0x00));
  }, [frame]);

  // toggle a cell in the currently selected layer (UI layer). Internally map
  // UI layer to frame Y index so that UI layer 0 => front (y=7), layer 7 => back (y=0).
  function toggle(x, z) {
    const mappedY = 7 - layer;
    const idx = 8 * mappedY + x; // frame index uses y (depth) as the array row
    const mask = 1 << z; // bits are Z
    const copy = local.slice();
    copy[idx] = copy[idx] ^ mask;
    setLocal(copy);
    if (onChange) onChange(copy);
  }

  function setLayerAllOn() {
    const copy = local.slice();
    // UI layer 0 is front -> mappedY = 7, UI layer 7 is back -> mappedY = 0
    const mappedY = 7 - layer;
    // for the fixed Y layer, set all Z bits for every X column
    for (let x = 0; x < 8; x++) copy[8 * mappedY + x] |= 0xff;
    setLocal(copy);
    onChange(copy);
  }

  function setLayerAllOff() {
    const copy = local.slice();
    const mappedY = 7 - layer;
    // clear all bits for this Y layer
    for (let x = 0; x < 8; x++) copy[8 * mappedY + x] = 0x00;
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
          title='Previous layer (towards back)'
          onClick={() => setLayer((layer + 7) % 8)}
        >
          ⬆
        </button>
        <span aria-live='polite'>Layer {layer + 1}</span>
        <button
          title='Next layer (towards front)'
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

      <div
        className='grid'
        role='grid'
        aria-label={`Front-to-back layer ${layer + 1} editor`}
      >
        {/* rows are Z (0..7 top->bottom), columns are X (0..7 left->right) */}
        {/* Flip Z order to match 3D display orientation */}
        {[...Array(8)].map((_, z) => (
          <div className='row' key={z} role='row'>
            {[...Array(8)].map((_, x) => {
              const mappedY = 7 - layer;
              const idx = 8 * mappedY + x; // column at depth= mappedY
              // Flip Z coordinate to match 3D display
              const flippedZ = 7 - z;
              const mask = 1 << flippedZ;
              const on = (local[idx] & mask) !== 0;
              return (
                <div
                  key={x}
                  role='gridcell'
                  tabIndex={0}
                  aria-checked={on}
                  title={`Toggle x=${x} z=${flippedZ} y=${mappedY + 1}`}
                  className={on ? 'cell on' : 'cell'}
                  onClick={() => toggle(x, flippedZ)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(x, flippedZ);
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
