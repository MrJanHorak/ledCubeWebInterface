import React, { useState } from 'react';

export default function HelpOverlay({
  onClose,
  onOpenExport,
  onDownloadWiringGuide,
  onDownloadSiteFiles,
}) {
  const [activeSection, setActiveSection] = useState('basics');

  const sections = [
    { id: 'basics', label: 'Basics' },
    { id: 'playback', label: 'Playback' },
    { id: 'tools', label: 'Tools' },
    { id: 'export', label: 'Export' },
    { id: 'esp32', label: 'ESP32 Setup' },
    { id: 'troubleshoot', label: 'Troubleshooting' },
  ];

  return (
    <div className='help-overlay' role='dialog' aria-modal='true'>
      <div className='help-box'>
        <h2>Help Hub</h2>
        <p className='muted'>
          Focused guides by topic to keep setup simple and scannable.
        </p>

        <div className='help-tabs' role='tablist' aria-label='Help sections'>
          {sections.map((section) => (
            <button
              key={section.id}
              type='button'
              role='tab'
              aria-selected={activeSection === section.id}
              className={`help-tab${activeSection === section.id ? ' active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className='guide-panel help-hub'>
          {activeSection === 'basics' && (
            <>
              <h3>Site controls (start here)</h3>
              <ol>
                <li>Use the center cube grid to draw one frame at a time.</li>
                <li>Use timeline tiles at the bottom to move between frames.</li>
                <li>Use left accordions (Text/Image/Audio/Patterns) to auto-generate sequences.</li>
                <li>Use Playback tab to manage frames and transitions.</li>
                <li>Use Tools for streaming, Export for files.</li>
              </ol>
              <h3>Keyboard shortcuts</h3>
              <ul>
                <li><strong>Space</strong>: Play/Pause</li>
                <li><strong>Left/Right</strong>: Previous/Next frame</li>
                <li><strong>Ctrl/Cmd + Z</strong>: Undo (<strong>Shift</strong> for Redo)</li>
                <li><strong>H</strong> or <strong>?</strong>: Toggle help hub</li>
                <li><strong>Esc</strong>: Close help hub</li>
              </ul>
            </>
          )}

          {activeSection === 'playback' && (
            <>
              <h3>Playback tab</h3>
              <ul>
                <li><strong>New/Duplicate/Delete</strong> handles frame editing.</li>
                <li><strong>Insert Transition</strong> creates in-between frames.</li>
                <li><strong>Steps + Easing</strong> controls transition smoothness.</li>
              </ul>
              <p className='muted'>
                Use this tab when shaping timing and animation flow.
              </p>
            </>
          )}

          {activeSection === 'tools' && (
            <>
              <h3>Tools tab</h3>
              <ul>
                <li><strong>Transform</strong>: mirror/rotate the current frame.</li>
                <li><strong>Sequence</strong>: reverse or clear animation.</li>
                <li><strong>Presets + Files</strong>: save browser-local presets and JSON imports/exports.</li>
                <li><strong>Live Stream</strong>: send frames over USB or ESP32 Wi-Fi in real time.</li>
              </ul>
              <p className='muted'>
                Use Tools for real-device iteration while editing.
              </p>
            </>
          )}

          {activeSection === 'export' && (
            <>
              <h3>Export tab</h3>
              <ul>
                <li>Generate <strong>C array</strong>, <strong>.h</strong>, and board-specific sketches.</li>
                <li>Pick <strong>Arduino</strong> or <strong>ESP32</strong> before exporting.</li>
                <li>Use <strong>Export Video</strong> for quick sharing.</li>
              </ul>
              <div className='help-actions'>
                <button onClick={onOpenExport}>Open Export Tab</button>
                <button onClick={onDownloadSiteFiles}>
                  Download Website Files (data/ folder)
                </button>
              </div>
            </>
          )}

          {activeSection === 'esp32' && (
            <>
              <h3>ESP32 setup</h3>
              <div className='guide-grid'>
                <div className='guide-card'>
                  <p className='guide-card-title'>Access Point mode</p>
                  <ol>
                    <li>Flash Wi-Fi relay sketch in AP mode.</li>
                    <li>Join ESP32 Wi-Fi from your phone/computer.</li>
                    <li>Connect with IP <code>192.168.4.1</code> in Tools.</li>
                  </ol>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>Station mode</p>
                  <ol>
                    <li>Set home Wi-Fi credentials before export.</li>
                    <li>Flash station sketch.</li>
                    <li>Read assigned IP from Serial Monitor and use it in Tools.</li>
                  </ol>
                </div>
              </div>
              <h3>Self-hosted web app flow</h3>
              <ol>
                <li>Download the self-hosted ESP32 sketch.</li>
                <li>Download website files zip.</li>
                <li>Extract into a folder named <code>data</code> beside the sketch.</li>
                <li>Upload filesystem data, then flash sketch.</li>
              </ol>
              <div className='help-actions'>
                <button onClick={onDownloadSiteFiles}>
                  Download Website Files (data/ folder)
                </button>
              </div>
            </>
          )}

          {activeSection === 'troubleshoot' && (
            <>
              <h3>Troubleshooting and wiring</h3>
              <ul>
                <li>If cube is static, confirm streaming is started.</li>
                <li>If Wi-Fi fails, verify mode/IP matches flashed sketch.</li>
                <li>If filesystem upload fails, folder must be exactly <code>data</code>.</li>
              </ul>
              <h3>Wiring quick map</h3>
              <div className='help-media'>
                <pre className='wiring-snippet'>
{`ESP32 Serial2 TX2 -> Level Shifter HV1 -> Cube RX
ESP32 GND         -> Level Shifter GND -> Cube GND
5V/GND rails must be bridged across breadboard halves`}
                </pre>
              </div>
              <div className='help-actions'>
                <button onClick={onDownloadWiringGuide}>
                  Download Wiring &amp; Troubleshooting Guide
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
