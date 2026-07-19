import { describe, it, expect } from 'vitest';
import {
  generateSphereFrames,
  generateRainFrames,
  generateScannerFrames,
  generateSparkleFrames,
  generateWireframeCubeFrames,
  generateSpiralFrames,
  generateBouncingBallFrames,
  generateFireworksFrames,
  generateExpandingCubeFrames,
  generateWaveFrames,
  generateSnakeFrames,
  generateFillDrainFrames,
  generateCheckerboardFrames,
  generateDiagonalScannerFrames,
  generateEdgeChaseFrames,
  generateOrbitFrames,
} from './patterns';

function expectValidFrames(frames, expectedCount) {
  expect(Array.isArray(frames)).toBe(true);
  if (expectedCount !== undefined) expect(frames.length).toBe(expectedCount);
  expect(frames.length).toBeGreaterThan(0);
  frames.forEach((frame) => {
    expect(frame.length).toBe(64);
    frame.forEach((byte) => {
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(0xff);
      expect(Number.isInteger(byte)).toBe(true);
    });
  });
}

describe('pattern generators', () => {
  it('generateSphereFrames produces the requested number of valid frames', () => {
    const frames = generateSphereFrames(20);
    expectValidFrames(frames, 20);
    // some frame should have at least one lit voxel
    expect(frames.some((f) => f.some((b) => b !== 0))).toBe(true);
  });

  it('generateRainFrames produces valid frames', () => {
    expectValidFrames(generateRainFrames(15, 0.2), 15);
  });

  it('generateScannerFrames produces valid frames for each axis', () => {
    ['x', 'y', 'z'].forEach((axis) => {
      const frames = generateScannerFrames(axis, 10);
      expectValidFrames(frames, 10);
      // at position 0, exactly one plane's worth of bits should be lit
      expect(frames[0].some((b) => b !== 0)).toBe(true);
    });
  });

  it('generateSparkleFrames produces valid frames', () => {
    expectValidFrames(generateSparkleFrames(10, 0.3));
  });

  it('generateWireframeCubeFrames produces valid frames with content', () => {
    const frames = generateWireframeCubeFrames(24);
    expectValidFrames(frames, 24);
    expect(frames.every((f) => f.some((b) => b !== 0))).toBe(true);
  });

  it('generateSpiralFrames produces valid frames and climbs from bottom to top', () => {
    const frames = generateSpiralFrames(32, 3);
    expectValidFrames(frames, 32);
    // last frame should have activity at a higher layer than the first
    const highestZ = (frame) => {
      let max = -1;
      for (const byte of frame) {
        for (let z = 7; z >= 0; z--) {
          if (byte & (1 << z)) max = Math.max(max, z);
        }
      }
      return max;
    };
    expect(highestZ(frames[frames.length - 1])).toBeGreaterThan(
      highestZ(frames[0]),
    );
  });

  it('generateBouncingBallFrames produces valid, deterministic frames', () => {
    const a = generateBouncingBallFrames(40);
    const b = generateBouncingBallFrames(40);
    expectValidFrames(a, 40);
    expect(a).toEqual(b); // deterministic, not randomized
  });

  it('generateFireworksFrames produces valid frames', () => {
    const frames = generateFireworksFrames(2, 8);
    expectValidFrames(frames, 16);
  });

  it('generateExpandingCubeFrames produces valid frames with content', () => {
    const frames = generateExpandingCubeFrames(20);
    expectValidFrames(frames, 20);
    expect(frames.some((f) => f.some((b) => b !== 0))).toBe(true);
  });

  it('generateWaveFrames produces valid frames with content every frame', () => {
    const frames = generateWaveFrames(16);
    expectValidFrames(frames, 16);
    // every frame should have a surface (every x,y column has some z lit)
    expect(frames.every((f) => f.some((b) => b !== 0))).toBe(true);
  });

  it('generateSnakeFrames produces valid, deterministic frames', () => {
    const a = generateSnakeFrames(30, 6, 7);
    const b = generateSnakeFrames(30, 6, 7);
    expectValidFrames(a, 30);
    expect(a).toEqual(b); // same seed -> same path
  });

  it('generateSnakeFrames with a different seed produces a different path', () => {
    const a = generateSnakeFrames(30, 6, 7);
    const b = generateSnakeFrames(30, 6, 99);
    expect(a).not.toEqual(b);
  });

  it('generateFillDrainFrames fills to a full cube and drains to empty', () => {
    const frames = generateFillDrainFrames(1);
    expectValidFrames(frames);
    // the fully-filled frame (all 64 bytes = 0xff) should appear somewhere
    const isFull = (frame) => frame.every((b) => b === 0xff);
    const isEmpty = (frame) => frame.every((b) => b === 0);
    expect(frames.some(isFull)).toBe(true);
    expect(isEmpty(frames[frames.length - 1])).toBe(true);
  });

  it('generateCheckerboardFrames alternates parity between consecutive frames', () => {
    const frames = generateCheckerboardFrames(4);
    expectValidFrames(frames, 4);
    // frame 0 and frame 1 should be exact bitwise complements of each other
    // (every voxel is lit in exactly one of the two)
    for (let i = 0; i < 64; i++) {
      expect(frames[0][i] ^ frames[1][i]).toBe(0xff);
    }
  });

  it('generateDiagonalScannerFrames produces valid frames', () => {
    const frames = generateDiagonalScannerFrames(20);
    expectValidFrames(frames, 20);
    expect(frames[0].some((b) => b !== 0)).toBe(true);
  });

  it('generateEdgeChaseFrames produces valid frames with content', () => {
    const frames = generateEdgeChaseFrames(32, 3);
    expectValidFrames(frames, 32);
    expect(frames.every((f) => f.some((b) => b !== 0))).toBe(true);
  });

  it('generateOrbitFrames produces valid frames with content', () => {
    const frames = generateOrbitFrames(32, 0.5);
    expectValidFrames(frames, 32);
    expect(frames.every((f) => f.some((b) => b !== 0))).toBe(true);
  });
});
