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

#### Option B: USB WebSerial Streaming on ESP32
1. Flash **ESP32 USB Relay Sketch** (`esp32_live_relay.ino`) to your ESP32.
2. Click **Connect USB** in the **Serial** tab, select the ESP32 Serial/CDC port, and start live streaming.

#### Option C: Standalone ESP32 Animation (`ANIM_ESP32.ino`)
1. Click **Download ESP32 .ino** (`ANIM_ESP32.ino`).
2. Flash to your ESP32 to store animations in flash memory (`PROGMEM` via `<pgmspace.h>`).

#### Option D: Self-Hosted Web App (no separate site needed)
The ESP32 can serve this entire website from its own flash storage, so anyone on the network can point a browser at the ESP32's address and get the full designer UI — no internet connection, no hosting this site anywhere else.

1. In the **Export** tab, set up the same Access Point/Station and name/password fields as Option A, then click **Download ESP32 Self-Hosted Web App Sketch** (`esp32_webapp_relay.ino`).
2. Follow the setup steps in that file's header comment: install `ESPAsyncWebServer` and its `AsyncTCP` dependency, build this site (`npm run build`), copy the contents of the resulting `dist/` folder into a `data/` folder next to the sketch, and use the Arduino IDE's "ESP32 Sketch Data Upload" tool to flash that folder to the board's filesystem separately from the sketch itself.
3. **This one is a starting point, not a guaranteed-working final sketch** — it wasn't possible to test it against real hardware while building it. The two things most likely to need adjusting for your exact setup: the ESPAsyncWebServer library's exact API (there have been a couple of maintained forks over time), and your board's partition scheme — many boards' *default* scheme only allocates a small filesystem partition meant for simple config files, not a several-hundred-KB web app; you'll likely need to pick a partition scheme with a larger SPIFFS/LittleFS allocation, and gzip-compressing the `dist/` files before uploading is worth doing both to fit more comfortably and transfer faster.

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
