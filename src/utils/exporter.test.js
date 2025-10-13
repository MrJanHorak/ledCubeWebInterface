import { describe, it, expect } from 'vitest';
import { framesToCArray } from './exporter';

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
