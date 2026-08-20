import { describe, it, expect } from 'vitest';
import {
  framesToCArray,
  generateGlyphFrames,
  generateTextFrames,
  renderImageToFace,
  generateImageFrames,
  generateESP32Sketch,
  generateESP32LiveRelaySketch,
  generateESP32WiFiRelaySketch,
  generateESP32WebAppSketch,
  generateWiringGuide,
} from './exporter';

const sampleFrame = new Array(64).fill(0).map((_, i) => i % 256);

describe('framesToCArray', () => {
  it('generates a C array string containing the frame bytes', () => {
    const frames = [sampleFrame];
    const out = framesToCArray(frames, 'TEST');
    expect(typeof out).toBe('string');
    expect(out).toContain('const byte TEST');
    // ensure some bytes appear
    expect(out).toMatch(/0x00|0x01|0x02/);
  });

  it('handles empty frames array gracefully', () => {
    const out = framesToCArray([], 'EMPTY');
    expect(typeof out).toBe('string');
    expect(out).toContain('// no frames');
  });
});

describe('ESP32 sketch generators', () => {
  it('generates valid ESP32 flash sketch with pgmspace.h', () => {
    const out = generateESP32Sketch('TEST', [sampleFrame]);
    expect(out).toContain('#include <pgmspace.h>');
    expect(out).toContain('const byte TEST[1][64] PROGMEM = {');
    expect(out).toContain('Serial2.begin(38400, SERIAL_8N1, 16, 17);');
  });

  it('generates valid ESP32 live relay sketch', () => {
    const out = generateESP32LiveRelaySketch();
    expect(out).toContain('Live Relay Sketch for ESP32');
    expect(out).toContain('Serial.begin(38400);');
    expect(out).toContain('Serial2.begin(38400, SERIAL_8N1, 16, 17);');
  });

  it('generates a Wi-Fi relay sketch using WiFiManager captive-portal setup (no hardcoded credentials)', () => {
    const out = generateESP32WiFiRelaySketch();
    expect(out).toContain('#include <WiFi.h>');
    expect(out).toContain('#include <WiFiManager.h>');
    expect(out).toContain('#include <WebSocketsServer.h>');
    expect(out).toContain('#include <ESPmDNS.h>');
    expect(out).toContain('WebSocketsServer webSocket(81);');
    // No SSID/password baked into the sketch -- WiFiManager prompts for
    // credentials via a captive portal on first boot instead.
    expect(out).not.toContain('const char* ssid');
    expect(out).not.toContain('const char* password');
  });

  it('resolves via mDNS at ledcube.local instead of a fixed AP IP', () => {
    const out = generateESP32WiFiRelaySketch();
    expect(out).toContain('MDNS_HOSTNAME "ledcube"');
    expect(out).toContain('ledcube.local');
  });

  it('generates a wiring & troubleshooting guide covering the two known gotchas', () => {
    const out = generateWiringGuide();
    expect(typeof out).toBe('string');
    expect(out).toContain('Serial2');
    expect(out).toContain('SN74AHCT125N');
    expect(out).toContain('breadboard');
    expect(out.toLowerCase()).toContain('ground rail');
    expect(out).toContain('0xAD');
    expect(out).toContain('0xF2');
  });
});


describe('generateGlyphFrames (3D icon set)', () => {
  const icons = [
    'ARROW_UP', 'ARROW_DOWN', 'ARROW_LEFT', 'ARROW_RIGHT',
    'SPADE', 'DIAMOND', 'CLUB',
    'SNOWFLAKE', 'TREE', 'PUMPKIN',
    'GHOST', 'PACMAN', 'INVADER',
  ];

  icons.forEach((icon) => {
    it(`renders ${icon} without throwing and produces lit voxels`, () => {
      const frames = generateGlyphFrames(icon, 6, '3d');
      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBe(6);
      frames.forEach((frame) => {
        expect(frame.length).toBe(64);
        frame.forEach((byte) => {
          expect(byte).toBeGreaterThanOrEqual(0);
          expect(byte).toBeLessThanOrEqual(0xff);
        });
      });
      // at least one frame should have something lit -- catches a typo'd
      // bitmap that accidentally renders as all-zero
      expect(frames.some((f) => f.some((b) => b !== 0))).toBe(true);
    });
  });
});

describe('renderImageToFace / generateImageFrames', () => {
  it('places bits on the front face at the expected byte indices', () => {
    // light column x=0 fully (all z bits), everything else off
    const columns = [0xff, 0, 0, 0, 0, 0, 0, 0];
    const frame = renderImageToFace(columns, 2);
    expect(frame.length).toBe(64);
    // front face: y=7 -> index 8*7+x ; thickness 2 also lights y=6
    expect(frame[8 * 7 + 0]).toBe(0xff);
    expect(frame[8 * 6 + 0]).toBe(0xff);
    // nothing else should be lit
    const total = frame.reduce((s, b) => s + b, 0);
    expect(total).toBe(0xff + 0xff);
  });

  it('thickness=1 only lights a single depth layer', () => {
    const columns = [0xff, 0, 0, 0, 0, 0, 0, 0];
    const frame = renderImageToFace(columns, 1);
    expect(frame[8 * 7 + 0]).toBe(0xff);
    expect(frame[8 * 6 + 0]).toBe(0);
  });

  it('generateImageFrames returns a single frame when spin is false', () => {
    const columns = [0xff, 0, 0, 0, 0, 0, 0, 0];
    const frames = generateImageFrames(columns, 6, false);
    expect(frames.length).toBe(1);
  });

  it('generateImageFrames returns `steps` frames when spinning, all valid', () => {
    const columns = [0x0f, 0x0f, 0, 0, 0, 0xf0, 0xf0, 0];
    const frames = generateImageFrames(columns, 6, true);
    expect(frames.length).toBe(6);
    frames.forEach((frame) => {
      expect(frame.length).toBe(64);
      frame.forEach((b) => {
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(0xff);
      });
    });
    // the shape should actually move as it spins -- not every frame identical
    expect(frames[0]).not.toEqual(frames[1]);
  });
});

describe('lowercase and cursive font support', () => {
  it('generateTextFrames renders lowercase text differently from its uppercase form (standard font)', () => {
    const lower = generateTextFrames('hello', 1, 'ltr', 'standard');
    const upper = generateTextFrames('HELLO', 1, 'ltr', 'standard');
    expect(lower.length).toBeGreaterThan(0);
    expect(upper.length).toBeGreaterThan(0);
    // same length (same number of characters/columns) but different glyph
    // shapes, since lowercase and uppercase 'h/e/l/l/o' differ in FONT5x7
    expect(lower.length).toBe(upper.length);
    expect(lower).not.toEqual(upper);
  });

  it('generateTextFrames accepts the cursive font and produces valid frames', () => {
    const frames = generateTextFrames('Hello', 1, 'ltr', 'cursive');
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame) => {
      expect(frame.length).toBe(64);
      frame.forEach((b) => {
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(0xff);
      });
    });
  });

  it('standard and cursive fonts render the same text differently', () => {
    const standard = generateTextFrames('abc', 1, 'ltr', 'standard');
    const cursive = generateTextFrames('abc', 1, 'ltr', 'cursive');
    expect(standard.length).toBe(cursive.length);
    expect(standard).not.toEqual(cursive);
  });

  it('an unsupported symbol in the smaller cursive punctuation set falls back to blank instead of throwing', () => {
    expect(() => generateTextFrames('a#b', 1, 'ltr', 'cursive')).not.toThrow();
  });

  it('generateGlyphFrames (flat mode) renders lowercase and uppercase differently', () => {
    const lower = generateGlyphFrames('a', 4, 'flat', 'standard');
    const upper = generateGlyphFrames('A', 4, 'flat', 'standard');
    expect(lower.length).toBe(upper.length);
    expect(lower[0]).not.toEqual(upper[0]);
  });

  it('generateGlyphFrames (flat mode) supports the cursive font', () => {
    const frames = generateGlyphFrames('a', 4, 'flat', 'cursive');
    expect(frames.length).toBe(4);
    expect(frames[0].some((b) => b !== 0)).toBe(true);
  });

  it('generateGlyphFrames (3D mode) still works when given a lowercase letter (falls back to uppercase)', () => {
    const frames = generateGlyphFrames('a', 6, '3d', 'standard');
    expect(frames.length).toBe(6);
    expect(frames.some((f) => f.some((b) => b !== 0))).toBe(true);
  });
});

describe('generateESP32WebAppSketch', () => {
  it('serves the built site from LittleFS, runs the WebSocket relay, and uses WiFiManager', () => {
    const out = generateESP32WebAppSketch();
    expect(out).toContain('#include <LittleFS.h>');
    expect(out).toContain('#include <ESPAsyncWebServer.h>');
    expect(out).toContain('#include <WiFiManager.h>');
    expect(out).toContain('LittleFS.begin(true)');
    expect(out).toContain('WebSocketsServer webSocket(81);');
    // No hardcoded credentials -- set up via captive portal on first boot
    expect(out).not.toContain('const char* ssid');
  });

  it('sends the 0xAD open-communication handshake once at boot', () => {
    // The cube ignores 0xF2 frame packets (including auto-replayed NVS
    // slots) until it has received this handshake -- without it, streamed
    // frames are silently dropped by the cube even though the sketch
    // receives and parses them correctly.
    const out = generateESP32WebAppSketch();
    const setupBody = out.slice(out.indexOf('void setup()'), out.indexOf('void loop()'));
    expect(setupBody).toMatch(/for\s*\(.*i.*<\s*70.*\)\s*Serial2\.write\(0xAD\);/);
  });

  it('supports resetting saved Wi-Fi credentials via a held GPIO0 press', () => {
    const out = generateESP32WebAppSketch();
    expect(out).toContain('RESET_PIN     0');
    expect(out).toContain('wm.resetSettings();');
  });
});
