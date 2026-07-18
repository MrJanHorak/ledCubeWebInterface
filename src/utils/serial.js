// Minimal Web Serial helpers (uses navigator.serial)
export async function requestPort() {
  if (!('serial' in navigator))
    throw new Error('Web Serial not supported in this browser');
  const port = await navigator.serial.requestPort();
  return port;
}

export async function openPort(port, baud = 38400) {
  await port.open({ baudRate: baud });
  return port;
}

export async function writeToPort(port, data) {
  // data: Uint8Array or ArrayBuffer
  const writer = port.writable.getWriter();
  await writer.write(data);
  writer.releaseLock();
}

export async function closePort(port) {
  if (port && port.readable) {
    try {
      await port.close();
    } catch (e) {}
  }
}

// Wraps a ReadableStreamDefaultReader so callers can pull one byte at a time
// (buffering any extra bytes that arrive in the same chunk), with a timeout.
export function createByteReader(reader) {
  let leftover = new Uint8Array(0);
  return async function readByte(timeoutMs = 1500) {
    if (leftover.length > 0) {
      const b = leftover[0];
      leftover = leftover.slice(1);
      return b;
    }
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Serial read timed out')),
        timeoutMs,
      );
    });
    try {
      const result = await Promise.race([reader.read(), timeout]);
      if (result.done) throw new Error('Serial port closed');
      const chunk = result.value;
      if (!chunk || chunk.length === 0) return readByte(timeoutMs);
      leftover = chunk.slice(1);
      return chunk[0];
    } finally {
      clearTimeout(timeoutId);
    }
  };
}
