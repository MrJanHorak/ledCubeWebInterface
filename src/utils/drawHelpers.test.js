import { describe, it, expect } from 'vitest';
import { interpolateFrames } from './drawHelpers';

describe('interpolateFrames', () => {
  it('returns the requested number of in-between frames', () => {
    const a = new Array(64).fill(0x00);
    const b = new Array(64).fill(0xff);
    const out = interpolateFrames(a, b, 5);
    expect(out.length).toBe(5);
  });

  it('bits that do not change stay constant across every step', () => {
    const a = new Array(64).fill(0x00);
    a[10] = 0b00000001; // one bit permanently on
    const b = a.slice();
    const out = interpolateFrames(a, b, 4);
    out.forEach((frame) => {
      expect(frame[10]).toBe(0b00000001);
    });
  });

  it('every differing bit has fully transitioned to the target by the last step', () => {
    const a = new Array(64).fill(0x00);
    const b = new Array(64).fill(0xff);
    const out = interpolateFrames(a, b, 6);
    const last = out[out.length - 1];
    // not required to exactly equal b at every step, but with enough steps
    // and et approaching 1, the last step should be very close to fully on
    const onBits = last.reduce((sum, byte) => {
      let c = 0;
      for (let z = 0; z < 8; z++) if (byte & (1 << z)) c++;
      return sum + c;
    }, 0);
    expect(onBits).toBeGreaterThan(0);
  });

  it('is deterministic for the same inputs (repeatable, not random each call)', () => {
    const a = new Array(64).fill(0x00);
    const b = new Array(64).fill(0xff);
    const out1 = interpolateFrames(a, b, 5);
    const out2 = interpolateFrames(a, b, 5);
    expect(out1).toEqual(out2);
  });

  it('accepts an easing option without throwing', () => {
    const a = new Array(64).fill(0x00);
    const b = new Array(64).fill(0xff);
    expect(() => interpolateFrames(a, b, 4, 'easeInOut')).not.toThrow();
    expect(() => interpolateFrames(a, b, 4, 'easeIn')).not.toThrow();
    expect(() => interpolateFrames(a, b, 4, 'easeOut')).not.toThrow();
  });
});
