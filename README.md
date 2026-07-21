LED Cube Designer (8x8x8)

This is a small React + Vite app to design frames for an 8x8x8 LED cube and export them as C arrays, header files, or Arduino sketches. It also includes a 3D preview and a Web Serial upload flow for compatible browsers.

Quick Start (Windows PowerShell)

1. Install dependencies:

```powershell
npm install
```

2. Run dev server:

```powershell
npm run dev
```

3. Open the printed URL (usually http://localhost:5173) in your browser (Chrome or Edge recommended for Web Serial).

Run tests:

```powershell
npm test
```

Overview — how to use

- Grid editing: The main editor edits the current 8x8 layer. Layers are presented as 1..8 (human-friendly). Use the layer controls to pick a layer and click cells to toggle LED columns, or **click-and-drag across cells to paint several at once** — the value of the first cell you click is applied to every cell you drag over, and it commits as a single undo step on release. "Layer 1" corresponds to the front face in the 3D preview; Layer 8 is the back.
- Layer tools: **All On** / **Clear Layer** fill or clear the selected layer in one click. **Copy Layer** / **Paste Layer** copy a layer's pattern and drop it onto a different depth (or a different frame — the clipboard persists as you navigate).
- Undo/Redo: every edit (cell paint, layer/frame clear or paste, transforms, transitions, loading a file or preset) is undoable. Use the **Undo** / **Redo** buttons in the playback bar, or `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on macOS). Undo history is kept in memory only (up to 50 steps) and resets on page reload.
- Onion skinning: toggle **Onion skin** under the 3D preview to see faint ghost LEDs — cyan for cells about to turn on in the next frame, magenta for cells that were on in the previous frame — useful while hand-animating.
- Frames & Timeline: Add, duplicate, delete frames and build an animation using the timeline tiles. Click tiles to jump to a frame. **Copy Frame** / **Paste Frame** copy a whole frame's pattern and overwrite an existing frame elsewhere in the timeline (distinct from Duplicate, which inserts a new frame next to the current one). **Reverse Frame Order** (Tools tab) flips the whole sequence.
- Playback direction: the **Forward / Reverse** button next to Play flips which way playback steps through frames, without altering the frame data itself.
- Transitions: **Insert Transition** generates in-between frames between the current frame and the next one. Each differing LED gets its own deterministic "dissolve" point within the transition (rather than every LED flipping at once), and the **Easing** dropdown (Linear / Ease In / Ease Out / Ease In-Out) controls the overall pacing of when those dissolve points land.
- Text & Glyph animation: Type text and **Scroll Text** to generate a scrolling marquee across 1–4 sides of the cube. **Spin Glyph** renders a single character and spins it (flat rotation or a true 3D center spin). The icon dropdown (used by **Spin Selected Icon**) covers emoticons, arrows, card suits, a seasonal set (snowflake/tree/pumpkin), and a retro set (ghost/Pac-Man/invader). By default these **add their frames to the end of the current timeline**, so you can chain a text scroll, a glyph spin, and an icon spin into one animation — uncheck "Add to end of timeline" above them to go back to the old behavior of replacing the whole timeline instead. **Clear All Frames** (Tools tab, Sequence section) resets to a single blank frame when you want a fresh start.
- Patterns (left column, below Text & Glyph Animation): procedural animations that don't come from a font. First batch: **Sphere** (expanding/contracting round shell), **Rain** (falling columns), **Scanner** (a plane sweeping the cube on the X/Y/Z axis you pick, bouncing back and forth), **Sparkle** (random twinkle), **Wireframe Cube** (the cube's own edges, spinning), **Spiral** (a point climbing a helix), **Bouncing Ball** (a single voxel bouncing off the walls, deterministic/repeatable), and **Fireworks** (a few bursts expanding outward from random points). Second batch: **Expanding Cube** (same pulse as Sphere, square shell instead of round), **Wave** (a sinusoidal surface undulating across x/y over time), **Snake** (a connected multi-segment body that turns at walls, deterministic per seed), **Fill / Drain** (the cube fills solid from bottom to top like rising liquid, then drains back down), **Checkerboard** (a 3D checkerboard that inverts every frame), **Diagonal Scanner** (like Scanner, but the plane sweeps along a cube diagonal), **Edge Chase** (all 12 edges light up in sync, each with a short point traveling corner to corner), and **Orbit** (a small cluster circling at a fixed height on a tilted axis). All of these respect the append/replace toggle above them, same as everything else in that panel.
- There's no hard cap on how many frames you can chain together — the editor, undo history, JSON export, and Web Serial send all work the same regardless of length. The one real-world ceiling is hardware flash memory if you're baking the animation into a sketch (`.h` export or `ANIM.ino`): each frame is 64 bytes, and a typical Arduino Uno/Nano has 32KB of flash total (shared with your own code), which is roughly a few hundred frames before it won't fit. The app shows a soft warning past ~300 total frames, but doesn't block you — the streaming Receiver Sketch approach (Send over serial) doesn't have this limit at all, since frames are sent live rather than stored on the board.
- Editing the grid: click-and-drag paints several cells with one value (freehand). **Hold Shift and drag to fill a rectangle** instead — it recomputes live as you drag, so shrinking the box back correctly un-paints cells it briefly covered. Both work with touch as well as mouse (touch dragging resolves whatever cell is currently under your finger, not just the one you first tapped).
- **Randomize** (Patterns panel): fires off one of the patterns above with randomized parameters, for quick fun or a demo — respects the append/replace toggle like everything else here.
- **Import Image** (left column): pick a picture, and it's downsampled to 8×8, thresholded to on/off (adjustable threshold slider), and placed on the front face — optionally spinning, the same way Spin Glyph's flat mode works. Good for quick logos/silhouettes without hand-drawing pixel-by-pixel.
- **Audio Reactive** (left column): records your microphone for a few seconds and bakes it into a per-column bar-chart animation (frequency spectrum → bar heights), which then behaves like any other animation — fully editable, undoable, exportable. Needs microphone permission; recording can be stopped early.
- **Per-frame timing**: the playback bar has a "Frame hold (ms)" field next to the global Delay — it overrides just the currently-viewed frame's hold time (e.g. a longer pause on a title card), leaving every other frame on the global Delay. "Use Default" clears the override. These per-frame overrides round-trip through JSON save/load and Presets, and are covered by Undo/Redo. **They are not currently reflected in exported Arduino sketches or the Web Serial Send protocol** — both still use a single fixed timing; this is a known gap, not an oversight.
- **Autosave**: the current animation (frames, per-frame timing, and the global delay) is silently saved to this browser's `localStorage` as you work and restored automatically if you reload or reopen the tab — separate from the named Presets system and from JSON file export. It's a local safety net, not a backup — clearing browser data removes it.
- **Export Video** (Export tab → Share): records one full loop of the 3D preview as a downloadable `.webm` video, for sharing what you built without needing the physical cube on camera. Browser support for `canvas.captureStream()`/`MediaRecorder` varies — this works reliably in Chrome/Edge; other browsers may not support it.
- Transform tools (Tools tab): Mirror the current frame on the X, Y, or Z axis, or rotate it 90° around Z.
- Presets (Tools tab): Save the current animation (frames + delay) as a named preset in this browser's `localStorage`, then reload or delete it later. Presets are local to the browser/device — they aren't synced or shared, and are separate from the `.json` file export below.
- Files (Tools tab): Save the current animation to a `.json` file, or load one back in. Unlike presets, this produces a portable file you can back up or hand to someone else. The saved format is `{ frames, delays }` (including any per-frame timing overrides); older files that are just a plain array of frames still load fine, with all delays defaulting to the global setting.
- Playback: Use Play/Pause to preview your animation in the browser. Adjust the frame delay (ms), or step frame-by-frame with the ◀ / ▶ buttons.
- Export (Export tab): Export as a C array (copy to clipboard), download a `.h` file, download a simple Arduino `.ino` sketch template, or download a streaming receiver sketch (checksum/ACK protocol) for a device that receives frames live over serial.
- Web Serial Upload: Connect to an Arduino-compatible device via the Web Serial API (Chrome/Edge). Click Connect, then Send — the app will ask for confirmation. **Disconnect** releases the port. If the device is unplugged mid-session, the app detects it and resets the connection state automatically.
  - **"Send" requires your board to currently be running the Receiver Sketch** (Export tab → Receiver Sketch), not your regular animation sketch — it's a live listener, not a way to flash new firmware. If your board has a different sketch flashed, Send has nothing to talk to.
  - The Receiver Sketch's `displayFrame()` function is a placeholder; you need to fill it in with whatever code already drives your specific cube's wiring (the same logic your working animation sketch uses), since this tool has no way to know your hardware.
  - The upload sequence is:
    - Open command: 70 bytes of `0xAD` (start)
    - For each frame: `0xF2`, then 64 bytes of frame data, then 1 checksum byte (sum of the 64 bytes, mod 256) — the app reads back `0xAA` (ACK) / `0xFF` (NACK) per frame and reports a clear error if a frame isn't acknowledged, instead of silently claiming success. Each frame gets up to 3 attempts before the send is aborted, and any stale bytes left over from a previous failed send are flushed before a new one starts.
    - **If you regenerated/reflashed the Receiver Sketch before this update, re-download and reflash it.** The sketch used to send the ACK *before* calling `displayFrame()`, which let the website fire the next frame while the board was still busy rendering — on boards with only a 64-byte serial RX buffer, that could silently drop bytes and cause sporadic "checksum rejected" errors on otherwise-correct frames. It now displays first, then ACKs, so the sender gets correct backpressure.
    - If instead frame 1 specifically times out with **no response at all**, that's usually a different issue: opening a serial port from a browser toggles the DTR line, which auto-resets most Arduino Uno/Nano-style boards. Connect now waits ~2 seconds after opening the port before it's usable, to ride out that reset — if a board still needs longer, Disconnect, wait a bit, then Connect and Send again.
    - There was also a deeper bug in the read-timeout logic itself: timing out a read used to leave the underlying serial read still pending in the background ("zombie" reads), and each one would silently steal a future byte meant for a later attempt — so retries made things *worse*, not better, and a Send could end up completely unable to receive anything after enough timeouts. Fixed so a timeout only stops local waiting; it no longer leaves anything dangling on the stream.
    - Close command: 70 bytes of `0xED` (end)

Appearance

- Light/dark theme: toggle with the ☀️/🌙 button in the header. The choice is remembered (`localStorage`) and otherwise follows your OS preference on first visit. The header bar itself stays dark in both themes, like a fixed instrument bezel.

Help overlay & shortcuts

- Open the help overlay with the `?` button in the header, or by pressing `H` / `?` on your keyboard.
- Close the overlay with `Esc`.
- Key shortcuts (ignored while typing in a text field): `Space` toggles Play/Pause, `Left`/`Right` arrows navigate frames.

UI notes

- The app uses a non-blocking toast system for notifications (copy success, load errors, serial status, clipboard actions), so you won't get blocking `alert()` popups.
- Undo/Redo covers most destructive actions now (see above). It does not cover navigation (which frame/layer you're viewing), playback state, or presets/localStorage writes — deleting a preset, for instance, is not undoable.
- If you want visual help media (screenshots or GIFs), add them to `/assets/help/` and reference them in the overlay (the overlay includes a placeholder).

Export format details

- `framesToCArray` generates a C snippet in this shape:

```
// Generated by LED Cube Designer
#define NAME_FRAME_COUNT N
const byte NAME[N][64] = { ... };
```

- Frame mapping used by the exporter: index = 8\*y + x and bits represent the vertical (z) layers.

Arduino example

1. Save or copy the exported `.h` file (for example `MY_ANIMATION.h`) into your sketch folder.
2. Include and play frames in your sketch:

```cpp
#include "MY_ANIMATION.h"

void loop(){
	for(int i=0;i<MY_ANIMATION_FRAME_COUNT;i++){
		// funPrintCube is your cube driver function; adapt as needed
		funPrintCube((byte*)MY_ANIMATION[i]);
		delay(300);
	}
}
```

Developer notes

- Tests: run `npm test` (Vitest) to validate exporter utilities.
- Build artifacts (`dist/`, `out.css`, `out.js`) are gitignored — don't commit them. Run `npm run build` to regenerate `dist/` when you need it.
- Adding debug logs: the app intentionally avoids console spamming; if you want dev logs, a small debug wrapper that toggles logging via an environment flag would be a reasonable addition.

Where to put help assets

- Add screenshot/GIF assets under `assets/help/` (create the folder). The help overlay includes a placeholder and a short note on how to reference these files.

License & disclaimers

- This project is a personal/experimental tool — adapt and improve as needed. No warranties.
