import React, { useState } from 'react';

export default function HelpOverlay({
  onClose,
  onOpenExport,
  onDownloadWiringGuide,
  onDownloadSiteFiles,
}) {
  const [activeSection, setActiveSection] = useState('basics');

  const sections = [
    { id: 'basics',       label: 'Basics' },
    { id: 'effects',      label: 'Effects' },
    { id: 'playback',     label: 'Playback' },
    { id: 'arduino',      label: 'Arduino' },
    { id: 'esp32',        label: 'ESP32' },
    { id: 'troubleshoot', label: 'Troubleshooting' },
  ];

  return (
    <div className='help-overlay' role='dialog' aria-modal='true'>
      <div className='help-box'>
        <h2>Tips, Tricks & Guides</h2>

        <div className='help-tabs' role='tablist' aria-label='Help sections'>
          {sections.map((s) => (
            <button
              key={s.id}
              type='button'
              role='tab'
              aria-selected={activeSection === s.id}
              className={`help-tab${activeSection === s.id ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className='guide-panel'>

          {activeSection === 'basics' && (
            <>
              <h3>Quick start</h3>
              <div className='guide-grid'>
                <div className='guide-card'>
                  <p className='guide-card-title'>1 · Draw</p>
                  <p className='muted'>Click cells in the cube grid to toggle LEDs. Use the left panel to auto-generate frames.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>2 · Animate</p>
                  <p className='muted'>Add frames via the timeline strip or use Effects to auto-generate sequences.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>3 · Play</p>
                  <p className='muted'>Hit <strong>Space</strong> to preview. Adjust speed in the playback bar.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>4 · Send or Export</p>
                  <p className='muted'>Stream live over USB or Wi-Fi, or export a C-array sketch from the Export tab.</p>
                </div>
              </div>

              <h3>Keyboard shortcuts</h3>
              <table className='guide-card' style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Space',        'Play / Pause'],
                    ['← / →',        'Previous / Next frame'],
                    ['Ctrl+Z',       'Undo'],
                    ['Ctrl+Shift+Z', 'Redo'],
                    ['H  or  ?',     'Toggle Help Hub'],
                    ['Esc',          'Close Help Hub'],
                  ].map(([key, desc]) => (
                    <tr key={key}>
                      <td style={{ padding: '4px 10px 4px 0', whiteSpace: 'nowrap' }}><strong>{key}</strong></td>
                      <td style={{ padding: '4px 0' }} className='muted'>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {activeSection === 'effects' && (
            <>
              <h3>Available effects</h3>
              <div className='guide-grid'>
                {[
                  ['Text Scroll',    'Scrolls typed text across the cube face, column by column.'],
                  ['Spin Glyph',     'Rotates a single character 360° across generated frames.'],
                  ['Spin Emoticon',  'Like Spin Glyph but for emoji-style symbols.'],
                  ['Image Import',   'Converts an uploaded image into LED frames — great for logos or pixel art.'],
                  ['Audio Reactive', 'Maps microphone frequency bands to cube layers in real time.'],
                  ['Patterns',       'Generates geometric sequences. Use Random or pick a named pattern from the list.'],
                ].map(([title, desc]) => (
                  <div key={title} className='guide-card'>
                    <p className='guide-card-title'>{title}</p>
                    <p className='muted'>{desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === 'playback' && (
            <>
              <h3>Frame operations</h3>
              <div className='guide-grid'>
                <div className='guide-card'>
                  <p className='guide-card-title'>New / Duplicate / Delete</p>
                  <p className='muted'>Manage individual frames in the Playback tab or timeline strip.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>Insert Transition</p>
                  <p className='muted'>Auto-generates in-between frames between two keyframes.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>Steps + Easing</p>
                  <p className='muted'>Controls how many interpolated frames are generated and the easing curve applied.</p>
                </div>
              </div>

              <h3>Timing</h3>
              <div className='guide-grid'>
                <div className='guide-card'>
                  <p className='guide-card-title'>Delay ms</p>
                  <p className='muted'>Global hold time per frame in milliseconds.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>FPS preset</p>
                  <p className='muted'>Shortcut to set a common frame rate. Overrides the Delay field.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>Frame Hold</p>
                  <p className='muted'>Per-frame override — leave blank to use the global Delay.</p>
                </div>
              </div>

              <h3>History</h3>
              <ul>
                <li><strong>Ctrl+Z</strong> — undo last frame edit</li>
                <li><strong>Ctrl+Shift+Z</strong> — redo</li>
                <li>History is per-session and clears on page refresh.</li>
              </ul>
            </>
          )}

          {activeSection === 'arduino' && (
            <>
              <h3>Arduino — USB streaming</h3>
              <ol className='step-list'>
                <li>Wire your cube using the diagram below.</li>
                              <h3>Wiring</h3>
              <pre className='wiring-snippet'>
{`Arduino TX1  ──►  Level Shifter HV1  ──►  Cube data RX
Arduino GND  ──►  Level Shifter GND  ──►  Cube GND

Note: 5 V logic from Arduino must be level-shifted
      before connecting to a 3.3 V cube RX pin.`}
              </pre>

              <div className='help-actions'>
                <button onClick={onDownloadWiringGuide}>Download Wiring Guide</button>
              </div>
                <li>Export tab → Arduino → <strong>USB Relay Sketch</strong> → flash it.</li>
                <li>Connect the Arduino to your computer via USB.</li>
                <li>Tools tab → Live Stream → <strong>Connect USB</strong> → <strong>Start Streaming</strong>.</li>
                <li>Frames stream to the cube in real time as you edit.</li>
              </ol>
            </>
          )}

          {activeSection === 'esp32' && (
            <>
              <h3>Choose your setup path</h3>
              <div className='guide-grid'>
                <div className='guide-card'>
                  <p className='guide-card-title'>📶 Wi-Fi Relay — use the hosted site</p>
                  <ol className='step-list'>
                    <li>Export tab → ESP32 → <strong>Wi-Fi Relay Sketch</strong> → flash it.</li>
                    <li>First boot creates a hotspot: <strong>LED Cube Setup</strong>.</li>
                    <li>Join it and enter your home Wi-Fi password in the captive portal.</li>
                    <li>ESP32 reboots and joins your network as <strong>ledcube.local</strong>.</li>
                    <li>Open <code>ledcube.local</code> — the <strong>Library</strong> tab appears automatically.</li>
                  </ol>
                  <p className='muted'>Best for: designing on this site and pushing wirelessly.</p>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>🖥️ Self-Hosted — cube serves the app</p>
                  <ol className='step-list'>
                    <li>Export tab → ESP32 → <strong>Self-Hosted App Sketch</strong> → flash it.</li>
                    <li>Before compiling, install these in the Arduino IDE (<em>Sketch → Include Library → Manage Libraries</em>): <strong>WiFiManager</strong> (by tzapu), <strong>ESPAsyncWebServer</strong> + its <strong>AsyncTCP</strong> dependency (use the <strong>ESP32Async</strong> org forks, not the old unmaintained <code>me-no-dev</code> originals), and <strong>WebSockets</strong> (by Markus Sattler). Missing any one of these causes a <code>fatal error: ... No such file or directory</code> compile error.</li>
                    <li>Export tab → <strong>Website Files</strong> → extract into a <code>data/</code> folder beside the sketch. Generate this zip from the <strong>deployed site</strong> or a production build only — running it from the Vite <code>npm run dev</code> server packages dev-only files (an <code>@vite</code> folder, <code>src/main.jsx</code>) that won't run standalone and are usually too big to fit. Only same-origin assets are packaged; third-party URLs (Google Fonts/Analytics) are skipped since the browser fetches those directly regardless of what's on the ESP32.</li>
                    <li>Arduino IDE → <em>Sketch → Upload SPIFFS / LittleFS Data</em>. If it fails with <code>File system is full</code>, pick a partition scheme with more SPIFFS/LittleFS space (<em>Tools → Partition Scheme</em>) or gzip-compress the files in <code>data/</code> first.</li>
                    <li>Same first-boot Wi-Fi setup as above.</li>
                    <li>Open <code>ledcube.local</code> — the cube serves the full app locally.</li>
                  </ol>
                  <p className='muted'>Best for: offline use, no internet required.</p>
                </div>
              </div>

              <h3>How auto-detection works</h3>
              <ul>
                <li>When the URL ends in <code>.local</code> the app switches to <strong>Dual Mode</strong>.</li>
                <li>The <strong>Library</strong> tab replaces Connect Serial — no manual IP entry needed.</li>
                <li>To reset Wi-Fi credentials: hold the BOOT button for 3 seconds on power-up.</li>
                <li><strong>Use the Library tab to send frames, not the Tools tab.</strong> Tools tab's "Start Wi-Fi Stream" speaks the older frame-by-frame relay protocol (for the Wi-Fi/USB Relay sketches) — the self-hosted app sketch only understands the Library tab's Live Stream / Slot 1 / Slot 2 commands. Slot 1/2 also persist to flash, so the cube keeps playing that animation on power-up even with no browser connected.</li>
              </ul>

              <div className='help-actions'>
                <button onClick={onDownloadSiteFiles}>Download Website Files (data/)</button>
                <button onClick={onOpenExport}>Open Export Tab</button>
              </div>
            </>
          )}

          {activeSection === 'troubleshoot' && (
            <>
              <h3>Common issues</h3>
              <div className='guide-grid'>
                <div className='guide-card'>
                  <p className='guide-card-title'>Arduino</p>
                  <ul>
                    <li>Cube static → confirm streaming started and correct COM port selected.</li>
                    <li>Garbled output → baud rate mismatch; check sketch (default 38400).</li>
                    <li>No COM port → install CH340 / CP2102 drivers for your board.</li>
                    <li>No response → verify level-shifter is wired correctly.</li>
                  </ul>
                </div>
                <div className='guide-card'>
                  <p className='guide-card-title'>ESP32</p>
                  <ul>
                    <li>Hotspot not appearing → hold BOOT button during power-on.</li>
                    <li><code>ledcube.local</code> not found → try the IP shown in Serial Monitor.</li>
                    <li>Library tab missing → URL must contain <code>.local</code>.</li>
                    <li>Cube not lighting up / nothing streams on <code>ledcube.local</code> → make sure you're using the <strong>Library</strong> tab's Live Stream/Slot buttons, not the <strong>Tools</strong> tab's "Start Wi-Fi Stream" — that one uses a different protocol meant for the Wi-Fi/USB Relay sketches, and the self-hosted app sketch silently ignores it.</li>
                    <li>SPIFFS upload fails → folder must be named exactly <code>data</code>.</li>
                    <li>Upload option missing → install the LittleFS upload plugin for your IDE.</li>
                    <li><code>fatal error: WiFiManager.h: No such file or directory</code> (or similar for <code>ESPAsyncWebServer.h</code> / <code>AsyncTCP.h</code> / <code>WebSocketsServer.h</code>) → that library isn't installed yet. Go to <em>Sketch → Include Library → Manage Libraries</em>, search for the missing library, and install it (WiFiManager by tzapu, ESPAsyncWebServer + AsyncTCP from the ESP32Async org, WebSockets by Markus Sattler), then recompile.</li>
                    <li><code>error: 'mbedtls_md5_starts_ret' was not declared</code> in <code>WebAuthentication.cpp</code>, or <code>Multiple libraries were found for "AsyncTCP.h" / "ESPAsyncWebServer.h"</code> → an old, unmaintained copy of these libraries (often the original <code>me-no-dev</code> versions, sometimes named <code>Async_TCP</code> / <code>ESP_Async_WebServer</code>) is installed alongside a newer one and won't compile against current ESP32 core mbedtls APIs. Open your Arduino <code>libraries</code> folder and delete the old/duplicate <code>AsyncTCP</code>, <code>Async_TCP</code>, <code>ESPAsyncWebServer</code>, and <code>ESP_Async_WebServer</code> folders, keeping only the <strong>ESP32Async</strong> versions, then restart the IDE and recompile.</li>
                    <li><code>lfs_write error(-28): File system is full.</code> during data upload → your <code>data/</code> folder is bigger than the LittleFS partition. Check for an <code>@vite</code> folder or <code>src/main.jsx</code> (means the zip came from <code>npm run dev</code> — regenerate it from the deployed site or a <code>npm run build</code> output) and for stray <code>/css2</code> or <code>/gtag/js</code> files from an older export (dead weight — safe to delete, this has been fixed in newer exports). If it's already a clean production build and still too big, pick a larger partition scheme (<em>Tools → Partition Scheme</em>) and/or gzip-compress the files before uploading.</li>
                    <li><code>Could not open COM5 ... the port is busy or doesn't exist</code> / <code>PermissionError(13, 'Access is denied.')</code> during upload → another program has the serial port open. Close the Arduino IDE's Serial Monitor and any other terminal/serial app, then retry; unplug/replug the board if it persists.</li>
                  </ul>
                </div>
              </div>

              <div className='help-actions'>
                <button onClick={onDownloadWiringGuide}>Download Wiring &amp; Troubleshooting Guide</button>
              </div>
            </>
          )}

        </div>

        <div className='help-actions' style={{ justifyContent: 'flex-end', marginBottom: 0 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
