# 3D LED Cube Designer & Animator (8x8x8)

[![Live Web Application](https://img.shields.io/badge/Live_App-3d--led--cube--programmer.netlify.app-ffb347?style=for-the-badge&logo=netlify)](https://3d-led-cube-programmer.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

An interactive, browser-based 3D 8x8x8 LED Cube pattern designer, animation builder, and real-time streaming suite built with **React**, **Three.js**, and **Vite**. 

Designed for **Arduino (Uno/Nano)** and **ESP32** microcontrollers, featuring direct **USB WebSerial** streaming and **Wireless Wi-Fi WebSockets** streaming.

👉 **Try the Live App**: [https://3d-led-cube-programmer.netlify.app/](https://3d-led-cube-programmer.netlify.app/)

---

## ✨ Features

- **Interactive 3D Voxel Editor**: Real-time 3D web preview powered by Three.js with orbit controls, layer-by-layer grid painting, onion skinning, and rectangle fill.
- **Playback timing**: a global delay plus per-frame hold-time overrides, and quick FPS presets (10/15/24/30/60 fps) that just set the delay for you.
- **Microcontroller Support**: Native export and live streaming for both **Arduino (AVR)** and **ESP32** (Xtensa / RISC-V).
- **Dual Streaming Modes**:
  - **USB WebSerial**: Direct plug-and-play streaming from Google Chrome or Microsoft Edge.
  - **Wireless Wi-Fi WebSockets**: Stream 8x8x8 frames wirelessly from your browser to an ESP32 Access Point without any USB cable.
- **Procedural Pattern Generator**:
  - *3D Physics & Effects*: Firework bursts, bouncing 3D balls, expanding spheres/cubes, wave surfaces, spirals, snakes, rain, sparkles, 3D axis sweepers.
- **Text & 3D Glyph marquee**:
  - 4-sided text scrolling marquee with 5x7 font.
  - True 3D center-axis spinning font glyphs & 3D emoticons (Ghost, Pac-Man, Invader, Heart, Arrow, etc.).
- **Audio Reactive Generator**: Record microphone audio and transform frequency spectrum bars into custom 3D animations in real time.
- **Image Converter**: Downsample and binarize any image into an 8x8 voxel slice with configurable thresholding and 3D rotation.
- **Code Exporters**: Generate flash C arrays, standalone C++ header files (`.h`), offline `.ino` sketches, or live relay sketches.
- **Video Recorder**: Record high-framestream `.webm` video clips of your 3D cube animations directly in browser.

---

## ⚡ Quick Start (Local Development)

```powershell
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open in browser (http://localhost:5173)
```

Run test suite:
```powershell
npm test
```

Build production bundle:
```powershell
npm run build
```

---

## 🔌 Hardware Setup & Connection Guide

The 8x8x8 LED Cube board features an onboard driver controller that handles matrix multiplexing. The attached microcontroller (Arduino or ESP32) acts as the communications bridge—either running standalone animations from Flash (`PROGMEM`) or relaying live frames in real time.

```
┌─────────────────────────┐        Serial / Wi-Fi       ┌─────────────────────┐       UART       ┌──────────────────────────────┐
│  LED Cube Designer      │ ───────────────────────────>│   Microcontroller   │ ────────────────>│ Onboard LED Cube Controller  │
│  (Web Browser / App)    │  (WebSerial USB / WebSockets)│  (Arduino / ESP32)  │  (38,400 baud)   │  (8x8x8 Multiplexer Board)   │
└─────────────────────────┘                             └─────────────────────┘                  └──────────────────────────────┘
```

---

### 0. Known Hardware

The controller board built into this specific 8x8x8 cube is marked:

```
STC
15F 2K60S2
28I-PDIP40
1930H0MS47.XD
```

That's an **STC15F2K60S2** — an 8051-core microcontroller from STC (a Chinese MCU vendor), commonly used as the onboard controller in commercial/DIY 8x8x8 LED cube kits. It's a real, separate chip doing the actual matrix multiplexing in its own firmware — **not** something this project's code runs on. This matters because it took a fair amount of debugging to establish: earlier versions of this project assumed the attached Arduino/ESP32 was driving the LEDs directly (bit-banging pins, needing a `displayFrame()` you'd fill in with your wiring) — that assumption was wrong for this hardware, and cost a lot of wasted effort chasing checksum/ACK protocol bugs that didn't need to exist. If you're adapting this project for a **different** cube that genuinely is pin-driven by the microcontroller (shift registers, direct multiplexing), you'll want different sketches than the relay ones described below — the "onboard controller" model here doesn't apply to that kind of build.

---



### 1. Arduino (Uno / Nano / Mega) Setup

#### Option A: Live USB WebSerial Streaming (Recommended for testing)
1. Open the app at [https://3d-led-cube-programmer.netlify.app/](https://3d-led-cube-programmer.netlify.app/).
2. In the **Export** tab, ensure **Arduino (AVR)** is selected, and click **Download Live Relay Sketch** (`live_relay.ino`).
3. Open `live_relay.ino` in the Arduino IDE and flash it to your board.
4. Leave your Arduino connected via USB.
5. In the app, switch to the **Serial** tab, click **Connect USB**, select your Arduino COM port, and click **▶ Start Streaming**.

#### Option B: Standalone Offline Playback (No PC required)
1. Design your animation sequence in the app.
2. In the **Export** tab, click **Download Arduino .ino** (`ANIM.ino`).
3. Open `ANIM.ino` in Arduino IDE and flash it.
4. Disconnect USB; power the Arduino via barrel jack or USB power bank. The cube will continuously cycle your animation!

---

### 2. ESP32 Setup (USB & Wireless Wi-Fi WebSockets)

ESP32 microcontrollers offer 32-bit speed, ample flash memory, and built-in Wi-Fi!

**Wiring note**: On the ESP32, the USB port and the cube's data line are two *separate* hardware UARTs. All ESP32 sketches here (`esp32_wifi_relay.ino`, `esp32_live_relay.ino`, `esp32_webapp_relay.ino`, `ANIM_ESP32.ino`) send cube frame data out **`Serial2`** — **TX2 (GPIO17)** — while `Serial` (the USB port) is reserved for Wi-Fi status messages / the WebSerial link to your PC. Wire the cube's data-in pin to TX2 (through a 3.3V→5V level shifter) and the cube's GND to the ESP32's GND, per the manufacturer's manual. If you see garbled binary characters mixed into the Arduino IDE's Serial Monitor, that's `Serial` debug text — it's expected and separate from the TX2 line actually driving the cube.

#### Option A: Wireless Wi-Fi WebSockets Streaming (No USB cable needed!)
1. In the **Export** tab, select **ESP32 (Wi-Fi/Serial)**.
2. Choose **Host its own network (Access Point)** or **Join my home Wi-Fi (Station)**, and fill in the name/password fields — for Access Point mode these become the network it creates; for Station mode, these are your existing Wi-Fi's credentials.
3. Click **Download ESP32 Wi-Fi Relay Sketch** (`esp32_wifi_relay.ino`).
4. Install the **WebSockets** library by Markus Sattler in the Arduino IDE (*Sketch → Include Library → Manage Libraries → search `WebSockets`*).
5. Flash `esp32_wifi_relay.ino` to your ESP32.
6. Power up your ESP32:
   - **Access Point mode**: it creates its own network (default SSID `LED_Cube_AP` / password `ledcube123`, or whatever you set). Connect your PC/phone to that network, then use `192.168.4.1` in the app.
   - **Station mode**: it joins your existing Wi-Fi and prints the IP address it was assigned to the Arduino IDE's Serial Monitor — use that IP in the app instead.
7. Open the app, go to the **Serial** tab, select **Wi-Fi WebSocket** mode, enter the IP address, click **Connect Wi-Fi**, and click **▶ Start Wi-Fi Stream**!
   - The IP field remembers the last address you successfully connected with (saved in your browser), and auto-fills itself if the page is being served directly from the ESP32 (Option D below) — in most cases you won't need to retype it every time.

#### Option B: USB WebSerial Streaming on ESP32
1. Flash **ESP32 USB Relay Sketch** (`esp32_live_relay.ino`) to your ESP32.
2. Click **Connect USB** in the **Serial** tab, select the ESP32 Serial/CDC port, and start live streaming.

#### Option C: Standalone ESP32 Animation (`ANIM_ESP32.ino`)
1. Click **Download ESP32 .ino** (`ANIM_ESP32.ino`).
2. Flash to your ESP32 to store animations in flash memory (`PROGMEM` via `<pgmspace.h>`).

#### Option D: Self-Hosted Web App (no separate site needed)
The ESP32 can serve this entire website from its own flash storage, so anyone on the network can point a browser at the ESP32's address and get the full designer UI — no internet connection, no hosting this site anywhere else.

1. In the **Export** tab, click **Download ESP32 Self-Hosted Web App Sketch** (`esp32_webapp_relay.ino`). Unlike Options A/C, this sketch doesn't use the Access Point/Station name/password fields — it sets up Wi-Fi interactively via a captive portal instead (steps 6-7 below).
2. Click **⬇ Download Website Files (data/ folder)** right below it — this packages the exact live site you're using right now (its `index.html` plus JS/CSS bundles) into a `.zip`, so you don't need to clone the repo or run `npm run build` yourself. Unzip its *contents* (not the zip file itself) into a folder named exactly `data`, placed next to the `.ino` sketch.
   - **This only works correctly on the deployed production site** (`https://3d-led-cube-programmer.netlify.app/`) or a local `npm run build && npm run preview`. If you click this button while running `npm run dev` (the Vite dev server), the zip will contain dev-only files like `/@vite/client` and `/src/main.jsx` instead of the built, hashed `assets/*.js`/`*.css` bundles — this won't run standalone on the ESP32 and is usually much larger, which can overflow the LittleFS partition (`lfs_write error(-28): File system is full.`). If your uploaded `data/` folder has an `@vite` or `src` folder in it, that's the sign — regenerate the zip from the deployed site or a production build instead.
   - The zip only packages **same-origin** assets (this site's own `assets/*.js`/`*.css`). Third-party resources referenced by absolute URL in `index.html` (Google Fonts, Google Analytics) are intentionally skipped — they'd never actually be served from the ESP32 anyway (the HTML still points the browser straight at the real `fonts.googleapis.com`/`googletagmanager.com`), so bundling them only wastes flash space. If you downloaded the zip before this fix and see stray `/css2` or `/gtag/js` files in your `data/` folder, delete them (or re-download a fresh zip) — they were dead weight contributing to `File system is full` errors.
3. Before compiling, install these libraries via the Arduino IDE's Library Manager (*Sketch → Include Library → Manage Libraries*) — the sketch will fail with a `fatal error: ... No such file or directory` for each one that's missing:
   - **WiFiManager** by tzapu
   - **ESPAsyncWebServer** and its **AsyncTCP** dependency — install the **ESP32Async** org forks specifically (search `ESPAsyncWebServer` / `AsyncTCP`, publisher **ESP32Async**). The older `me-no-dev` originals are unmaintained and fail to compile against modern ESP32 board-package versions (see troubleshooting below).
   - **WebSockets** by Markus Sattler
   - (`ESPmDNS`, `Preferences`, `LittleFS`, and `WiFi` ship with the ESP32 Arduino core, so no separate install is needed for those.)
   Then use the Arduino IDE's "ESP32 Sketch Data Upload" tool to flash the `data/` folder to the board's filesystem separately from the sketch itself.
   - **If you get `error: 'mbedtls_md5_starts_ret' was not declared in this scope'` (in `WebAuthentication.cpp`)**, or **`Multiple libraries were found for "AsyncTCP.h"` / `"ESPAsyncWebServer.h"`**: this means an old, unmaintained copy of `ESPAsyncWebServer`/`AsyncTCP` (e.g. the original `me-no-dev` versions, sometimes installed as `Async_TCP` / `ESP_Async_WebServer`) is present alongside a newer one, and it doesn't compile against current ESP32 core mbedtls APIs. Fix it by opening your Arduino `libraries` folder (*File → Preferences → Sketchbook location*, then the `libraries` subfolder) and **deleting** any old/duplicate `AsyncTCP`, `Async_TCP`, `ESPAsyncWebServer`, or `ESP_Async_WebServer` folders, keeping only the current **ESP32Async** versions of `AsyncTCP` and `ESPAsyncWebServer`. Restart the Arduino IDE and recompile.
4. Flash the sketch, then flash the `data/` folder (step 2). Your board's partition scheme needs at least ~1.5 MB allocated to SPIFFS/LittleFS to fit the site (see **Tools → Partition Scheme**, e.g. "Default 4MB with spiffs"); gzip-compressing the files in `data/` before uploading helps them fit more comfortably and transfer faster.
5. Since the page now loads from the ESP32's own IP, the app's Wi-Fi IP field auto-detects and fills itself in with that same address — no need to type it in separately.
6. **First boot — connecting to your home Wi-Fi:** power up the ESP32. It creates its own hotspot named **`LED Cube Setup`**. Connect a phone or laptop to that hotspot; a captive portal/configuration page should open automatically (or open a browser and go to `192.168.4.1` if it doesn't). Pick your home Wi-Fi network from the list and enter its password.
7. The ESP32 saves those credentials to flash and reboots, joining your home network. It then advertises itself as **`ledcube.local`** via mDNS — open that address in a browser (on a device connected to the *same* Wi-Fi network) to load the designer app. The Serial Monitor (or the Wi-Fi IP field once connected) also shows the assigned IP address as a fallback if `.local` resolution doesn't work on your network.
8. **To reset saved Wi-Fi credentials** (e.g. to switch networks): hold the **GPIO0 / BOOT** button low for 3 seconds while the board is powered on. It wipes the saved network and reboots back into the `LED Cube Setup` hotspot from step 6.
9. **To actually send an animation to the cube, use the Library tab, not the Tools tab.** Once connected, the sidebar shows a **Library** tab — pick **Live Stream** (plays immediately, not saved), **Slot 1**, or **Slot 2** (both persist to flash and auto-replay on power-up, even with no browser connected), then click **Send Frames**. The Tools tab's "Start Wi-Fi Stream" button uses a different, older frame-by-frame protocol built for the plain Wi-Fi/USB Relay sketches (Options A/B above) — the self-hosted app sketch's `handleDualModeMessage` doesn't recognize it and silently discards those packets, which looks like "nothing happens" even though the WebSocket shows connected.

---

## 🔧 ESP32 Hardware Troubleshooting

If you've flashed a sketch and connected over WebSocket/USB but the cube just keeps showing its own factory demo pattern (not your streamed frames), a **📄 Download Wiring & Troubleshooting Guide** button is available right in the app's **Export** tab — it's a plain-text file with the full level-shifter wiring diagram and diagnostic steps, so anyone who lands on the live site (without ever visiting this repo) can still get unstuck. The two most common causes, found while debugging this against real hardware:

1. **Mixing up the ESP32's two UARTs.** `Serial` is the USB port (Wi-Fi status messages, WebSerial link to your PC); `Serial2` (TX2 = GPIO17, RX2 = GPIO16) is the separate hardware UART that actually drives the cube through a level shifter. Every sketch this site generates already keeps these separate — but if you see garbled binary characters mixed into the Arduino IDE's Serial Monitor, that's a sign cube data ended up on the wrong UART.
2. **Breadboard ground rails that aren't bridged.** Most full-size breadboards have the top and bottom power rail strips as two *separate* electrical nets — they don't connect to each other automatically. If the ESP32's GND, the level shifter's GND pin, and the cube's GND wire aren't all on the exact same rail (or bridged together with a jumper), you can get silent failures even though each individual connection looks correct with a meter. This is easy to miss and was the actual root cause the one time this got fully debugged against real hardware — always double check it first if voltage/continuity checks near the chip otherwise look fine.

### LittleFS / Data upload issues

- **`lfs_write error(-28): File system is full.`** during the "ESP32 Sketch Data Upload" / LittleFS upload tool: the `data/` folder is bigger than the flash partition allocated to the filesystem.
  - First check *what's* in `data/` — if it contains an `@vite` folder, a `src/main.jsx` file, or references to `/@vite/client`, you generated the website-files zip from the Vite **dev server** (`npm run dev`) instead of the production build. Regenerate it from the deployed site or a local `npm run build && npm run preview`, delete the old `data/` contents, and re-extract the new zip.
  - Also check for stray `/css2` or `/gtag/js` files — older exports of the zip tool pulled in third-party Google Fonts/Analytics URLs referenced by `index.html`, which are dead weight (the browser still fetches those from the real internet, never from the ESP32). This has been fixed so newer zips only include same-origin assets; delete any such files if present in an older `data/` folder.
  - If the folder is genuinely a production build and still doesn't fit, switch **Tools → Partition Scheme** to one with a larger SPIFFS/LittleFS allocation (e.g. "Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)" or larger, if your board has 4 MB+ flash), and/or gzip-compress the individual files in `data/` before uploading (the ESPAsyncWebServer static handler can serve `.gz` files directly).
- **`Could not open COM5 ... the port is busy or doesn't exist` / `PermissionError(13, 'Access is denied.')`** when the LittleFS uploader tries to flash: another program is holding the serial port open. Close the Arduino IDE's **Serial Monitor**, any other terminal/serial app (PuTTY, screen, etc.), and re-run the upload. If it still fails, unplug/replug the ESP32 and make sure no second Arduino IDE window has the port open.

---

## 📡 Serial Streaming Protocol Details

The LED cube driver protocol operates at **38,400 baud, 8N1**:

1. **Handshake**: When streaming begins, the web app or sketch sends `0xAD` repeatedly (70 bytes) to open communication.
2. **Frame Packet**: Each 8x8x8 frame consists of:
   - Header byte: `0xF2`
   - 64 raw data bytes: `byte[0]` through `byte[63]` representing column bitmasks (LSB = Z layer 0, MSB = Z layer 7).
3. **Looping**: Frames are continuously sent with per-frame delay timing. If the stream stops, the onboard cube controller automatically falls back to its internal factory pattern.

---

## ⌨️ Keyboard Shortcuts & Controls

| Key / Gesture | Action |
| :--- | :--- |
| `Space` | Play / Pause 3D animation preview |
| `Left Arrow` / `Right Arrow` | Step backward / forward through frame timeline |
| `Ctrl + Z` / `Cmd + Z` | Undo last grid paint or timeline change |
| `Ctrl + Shift + Z` / `Cmd + Shift + Z` | Redo change |
| `Click + Drag` | Paint LED cells freehand across grid |
| `Shift + Click + Drag` | Fill rectangle of LED cells |
| `H` or `?` | Toggle Help Overlay |

---

## 🧊 Considered, Not Built: Configurable Cube Size

This app is hard-coded for an 8x8x8 cube — the frame format itself (64 bytes, one byte per column, one bit per height layer) assumes it, and that assumption runs through nearly every file: the grid editor, the 3D preview, every procedural pattern generator, every font glyph, the exporters, and the serial protocol's fixed 64-byte frame size. Making the size configurable (say, 4x4x4 or 16x16x16) isn't a UI-layer feature — it's a data-format change that cascades everywhere, including how a "byte per column" stops working once a cube is taller than 8 layers (you'd need multiple bytes per column instead of one). That's a legitimate direction if you build a different-sized cube someday, but it's disproportionately large scope to fold in alongside smaller feature work — worth treating as its own dedicated project with its own planning, rather than a checkbox item.

---



Distributed under the MIT License. Feel free to adapt and improve!
