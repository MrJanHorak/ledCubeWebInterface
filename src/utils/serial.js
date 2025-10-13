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
