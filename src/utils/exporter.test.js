import { describe, it, expect } from 'vitest';
import { framesToCArray, generateGlyphFrames } from './exporter';

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
