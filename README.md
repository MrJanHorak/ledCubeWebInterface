# 3D LED Cube Designer & Animator (8x8x8)

[![Live Web Application](https://img.shields.io/badge/Live_App-3d--led--cube--programmer.netlify.app-ffb347?style=for-the-badge&logo=netlify)](https://3d-led-cube-programmer.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

An interactive, browser-based 3D 8x8x8 LED Cube pattern designer, animation builder, and real-time streaming suite built with **React**, **Three.js**, and **Vite**. 

Designed for **Arduino (Uno/Nano)** and **ESP32** microcontrollers, featuring direct **USB WebSerial** streaming and **Wireless Wi-Fi WebSockets** streaming.

👉 **Try the Live App**: [https://3d-led-cube-programmer.netlify.app/](https://3d-led-cube-programmer.netlify.app/)

---

## ✨ Features

- **Interactive 3D Voxel Editor**: Real-time 3D web preview powered by Three.js with orbit controls, layer-by-layer grid painting, onion skinning, and rectangle fill.
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
1. In the **Export** tab, select **ESP32 (Wi-Fi/Serial)** and click **Download ESP32 Wi-Fi Relay Sketch** (`esp32_wifi_relay.ino`).
2. Install the **WebSockets** library by Markus Sattler in the Arduino IDE (*Sketch → Include Library → Manage Libraries → search `WebSockets`*).
3. Flash `esp32_wifi_relay.ino` to your ESP32.
4. Power up your ESP32. It will create a Wi-Fi Access Point:
   - **SSID**: `LED_Cube_AP`
   - **Password**: `ledcube123`
5. Connect your PC / laptop / smartphone Wi-Fi to `LED_Cube_AP`.
6. Open [https://3d-led-cube-programmer.netlify.app/](https://3d-led-cube-programmer.netlify.app/), go to the **Serial** tab, select **Wi-Fi WebSocket** mode, enter `192.168.4.1`, click **Connect Wi-Fi**, and click **▶ Start Wi-Fi Stream**!

#### Option B: USB WebSerial Streaming on ESP32
1. Flash **ESP32 USB Relay Sketch** (`esp32_live_relay.ino`) to your ESP32.
2. Click **Connect USB** in the **Serial** tab, select the ESP32 Serial/CDC port, and start live streaming.

#### Option C: Standalone ESP32 Animation (`ANIM_ESP32.ino`)
1. Click **Download ESP32 .ino** (`ANIM_ESP32.ino`).
2. Flash to your ESP32 to store animations in flash memory (`PROGMEM` via `<pgmspace.h>`).

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

## 📄 License

Distributed under the MIT License. Feel free to adapt and improve!
