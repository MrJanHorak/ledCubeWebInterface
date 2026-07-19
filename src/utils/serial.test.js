import { describe, it, expect, vi } from 'vitest';
import { createByteReader } from './serial';

// A minimal fake ReadableStreamDefaultReader: read() resolves with queued
// chunks (or waits, if none are queued yet, until one is pushed via
// `pushLater`). This lets tests control exactly when bytes "arrive".
function createFakeReader() {
  const pending = [];
  const pendingResolvers = [];

  return {
    read() {
      if (pending.length > 0) {
        return Promise.resolve({ value: pending.shift(), done: false });
      }
      return new Promise((resolve) => {
        pendingResolvers.push(resolve);
      });
    },
    push(bytes) {
      const value = new Uint8Array(bytes);
      if (pendingResolvers.length > 0) {
        pendingResolvers.shift()({ value, done: false });
      } else {
        pending.push(value);
      }
    },
  };
}

describe('createByteReader', () => {
  it('delivers bytes from a single chunk one at a time, in order', async () => {
    const fake = createFakeReader();
    const readByte = createByteReader(fake);
    fake.push([0xaa, 0xbb, 0xcc]);
    expect(await readByte(100)).toBe(0xaa);
    expect(await readByte(100)).toBe(0xbb);
    expect(await readByte(100)).toBe(0xcc);
  });

  it('rejects on timeout when nothing arrives', async () => {
    const fake = createFakeReader();
    const readByte = createByteReader(fake);
    await expect(readByte(20)).rejects.toThrow(/timed out/);
  });

  it('a byte that arrives after a timeout is not lost, and does not get misattributed to a stale caller (no zombie reads)', async () => {
    const fake = createFakeReader();
    const readByte = createByteReader(fake);

    // First call times out -- nothing has arrived yet.
    await expect(readByte(20)).rejects.toThrow(/timed out/);

    // The real byte for that attempt shows up late.
    fake.push([0x42]);

    // A fresh readByte() call must see this byte -- with the old
    // Promise.race-based implementation, the timed-out read() was still
    // pending and would silently swallow this byte, leaving the caller
    // hanging (or worse, misaligning a *subsequent* byte onto this call).
    expect(await readByte(200)).toBe(0x42);
  });

  it('never delivers the same byte twice even across several timeouts', async () => {
    const fake = createFakeReader();
    const readByte = createByteReader(fake);

    await expect(readByte(15)).rejects.toThrow(/timed out/);
    await expect(readByte(15)).rejects.toThrow(/timed out/);
    await expect(readByte(15)).rejects.toThrow(/timed out/);

    fake.push([0x01, 0x02]);
    expect(await readByte(100)).toBe(0x01);
    expect(await readByte(100)).toBe(0x02);
  });
});
