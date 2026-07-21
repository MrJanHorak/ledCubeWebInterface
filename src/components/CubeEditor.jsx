import React, { useState, useEffect, useRef } from 'react';

// Props: frame (array of 64 bytes), onChange(newFrame), showToast(msg)
export default function CubeEditor({ frame, onChange, showToast }) {
  // layer now represents the front-to-back slice (y index 0..7)
  const [layer, setLayer] = useState(0);
  const [local, setLocal] = useState(
    frame ? frame.slice() : new Array(64).fill(0x00)
  );
  const [layerClipboard, setLayerClipboard] = useState(null);

  const localRef = useRef(local);
  const paintingRef = useRef(false); // true for the duration of any drag (freehand or rectangle)
  const paintValueRef = useRef(false); // freehand: the value being painted
  const rectModeRef = useRef(false);
  const rectStartRef = useRef({ x: 0, z: 0 });
  const rectBaseRef = useRef(null); // snapshot of `local` from before the rectangle drag began
  const rectTargetRef = useRef(false);

  useEffect(() => {
    setLocal(frame ? frame.slice() : new Array(64).fill(0x00));
  }, [frame]);

  useEffect(() => {
    localRef.current = local;
  }, [local]);

  // Ends any drag (freehand paint or rectangle select) and commits once,
  // whichever kind it was -- so a whole stroke is a single undo step.
  useEffect(() => {
    function finishPaint() {
      if (paintingRef.current) {
        paintingRef.current = false;
        rectModeRef.current = false;
        if (onChange) onChange(localRef.current);
      }
    }
    window.addEventListener('mouseup', finishPaint);
    window.addEventListener('touchend', finishPaint);
    window.addEventListener('touchcancel', finishPaint);
    return () => {
      window.removeEventListener('mouseup', finishPaint);
      window.removeEventListener('touchend', finishPaint);
      window.removeEventListener('touchcancel', finishPaint);
    };
  }, [onChange]);

  const notify = (msg) => {
    if (showToast) showToast(msg);
  };

  function applyCell(x, z, value) {
    const mappedY = 7 - layer;
    const idx = 8 * mappedY + x;
    const mask = 1 << z;
    setLocal((prev) => {
      const copy = prev.slice();
      if (value) copy[idx] |= mask;
      else copy[idx] &= ~mask;
      return copy;
    });
  }

  // Recomputes the rectangle from rectBaseRef (the state before this drag
  // started) each time, rather than accumulating -- so shrinking the
  // rectangle back correctly un-does cells it had briefly covered.
  function applyRectPreview(x, z) {
    const base = rectBaseRef.current;
    if (!base) return;
    const mappedY = 7 - layer;
    const { x: sx, z: sz } = rectStartRef.current;
    const minX = Math.min(sx, x);
    const maxX = Math.max(sx, x);
    const minZ = Math.min(sz, z);
    const maxZ = Math.max(sz, z);
    const copy = base.slice();
    for (let cx = minX; cx <= maxX; cx++) {
      const idx = 8 * mappedY + cx;
      for (let cz = minZ; cz <= maxZ; cz++) {
        const mask = 1 << cz;
        if (rectTargetRef.current) copy[idx] |= mask;
        else copy[idx] &= ~mask;
      }
    }
    setLocal(copy);
  }

  function startPaint(x, z, rectMode) {
    const mappedY = 7 - layer;
    const idx = 8 * mappedY + x;
    const mask = 1 << z;
    const currentlyOn = (local[idx] & mask) !== 0;
    const target = !currentlyOn;
    paintingRef.current = true;
    if (rectMode) {
      rectModeRef.current = true;
      rectStartRef.current = { x, z };
      rectBaseRef.current = local.slice();
      rectTargetRef.current = target;
      applyRectPreview(x, z);
    } else {
      rectModeRef.current = false;
      paintValueRef.current = target;
      applyCell(x, z, target);
    }
  }

  function continuePaint(x, z) {
    if (!paintingRef.current) return;
    if (rectModeRef.current) {
      applyRectPreview(x, z);
    } else {
      applyCell(x, z, paintValueRef.current);
    }
  }

  // Touch move events keep firing on the element the finger first touched
  // down on, not whatever's currently underneath it -- unlike mouse, there's
  // no per-element "enter" event to lean on. Resolve the element under the
  // finger manually so drag-across-cells (not just tap) works on touch.
  function handleTouchMove(e) {
    if (!paintingRef.current) return;
    e.preventDefault();
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.dataset && el.dataset.x !== undefined) {
      continuePaint(Number(el.dataset.x), Number(el.dataset.z));
    }
  }

  // Single explicit toggle, used for keyboard access (Enter/Space) where
  // there's no drag -- commits immediately as its own undo step.
  function toggle(x, z) {
    const mappedY = 7 - layer;
    const idx = 8 * mappedY + x;
    const mask = 1 << z;
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
    notify('Layer cleared');
  }

  function copyLayer() {
    const mappedY = 7 - layer;
    const bytes = [];
    for (let x = 0; x < 8; x++) bytes.push(local[8 * mappedY + x] || 0);
    setLayerClipboard(bytes);
    notify(`Copied layer ${layer + 1}`);
  }

  function pasteLayer() {
    if (!layerClipboard) return notify('No layer copied yet');
    const copy = local.slice();
    const mappedY = 7 - layer;
    for (let x = 0; x < 8; x++) copy[8 * mappedY + x] = layerClipboard[x];
    setLocal(copy);
    onChange(copy);
    notify(`Pasted into layer ${layer + 1}`);
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
        <button onClick={setLayerAllOff} title='Clear this layer'>
          Clear Layer
        </button>
        <button onClick={copyLayer} title='Copy this layer to paste elsewhere'>
          📋 Copy Layer
        </button>
        <button
          onClick={pasteLayer}
          disabled={!layerClipboard}
          title='Paste the copied layer onto this depth'
        >
          Paste Layer
        </button>
      </div>
      <p className='muted' style={{ margin: '4px 0 0' }}>
        Drag to paint several cells. Hold Shift and drag to fill a
        rectangle instead.
      </p>

      <div
        className='grid'
        role='grid'
        aria-label={`Front-to-back layer ${layer + 1} editor`}
        onDragStart={(e) => e.preventDefault()}
        onTouchMove={handleTouchMove}
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
                  data-x={x}
                  data-z={flippedZ}
                  title={`Toggle x=${x} z=${flippedZ} y=${mappedY + 1} (drag to paint, shift+drag to fill a box)`}
                  className={on ? 'cell on' : 'cell'}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    startPaint(x, flippedZ, e.shiftKey);
                  }}
                  onMouseEnter={() => continuePaint(x, flippedZ)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startPaint(x, flippedZ, false);
                  }}
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
