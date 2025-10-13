import React from 'react';

export default function HelpOverlay({ onClose }) {
  return (
    <div className='help-overlay' role='dialog' aria-modal='true'>
      <div className='help-box'>
        <h2>Help — Shortcuts & Tips</h2>
        <ul>
          <li><strong>Space</strong>: Play / Pause</li>
          <li><strong>Left / Right</strong>: Prev / Next frame</li>
          <li><strong>H</strong> or <strong>?</strong>: Toggle this help</li>
          <li><strong>Esc</strong>: Close help</li>
          <li><strong>Click a tile</strong>: Jump to frame</li>
        </ul>
        <h3>Quick Tips</h3>
        <ul>
          <li>Use the timeline tiles to quickly jump between frames.</li>
          <li>Export as a C array or a .h file for direct inclusion in Arduino sketches.</li>
          <li>Use the Send button to upload frames via Web Serial (you'll be asked to confirm).</li>
        </ul>
        <div className="help-content">
          <div className="help-left">
            <h3>Keyboard</h3>
            <ul>
              <li><strong>Space</strong>: Play / Pause</li>
              <li><strong>Left / Right</strong>: Prev / Next frame</li>
              <li><strong>H</strong> or <strong>?</strong>: Toggle this help</li>
              <li><strong>Esc</strong>: Close help</li>
              <li><strong>Click a tile</strong>: Jump to frame</li>
            </ul>
          </div>
          <div className="help-right">
            <h3>Screenshots & GIFs</h3>
            <div className="help-media">
              <div className="media-placeholder">Drop screenshots or GIFs here (or open devtools and paste)</div>
            </div>
            <p className="muted">Add images to the repo under <code>/assets/help/</code> and reference them here if you want inline visuals.</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
