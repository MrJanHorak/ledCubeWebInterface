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

// Wireless WebSocket helpers for ESP32 devices
export function openWebSocket(url = 'ws://192.168.4.1:81') {
  return new Promise((resolve, reject) => {
    try {
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      socket.onopen = () => resolve(socket);
      socket.onerror = (err) => reject(err);
    } catch (err) {
      reject(err);
    }
  });
}

export function writeToWebSocket(socket, data) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not connected');
  }
  socket.send(data);
}

export function closeWebSocket(socket) {
  if (socket) {
    try {
      socket.close();
    } catch (e) {}
  }
}


// Wraps a ReadableStreamDefaultReader so callers can pull one byte at a time
// with a timeout, WITHOUT ever having more than one reader.read() call
// in flight. This matters: reader.read() queues concurrent calls and
// resolves them strictly in request order. A naive Promise.race([read(),
// timeout]) leaves the raw read() pending forever when it "loses" the
// race, and that abandoned read silently steals the *next* real byte that
// arrives -- every timeout permanently misaligns all subsequent reads.
// Instead, one background loop is the only thing that ever calls
// reader.read(); readByte() just waits on an in-memory queue it fills.
export function createByteReader(reader) {
  const queue = [];
  let waiters = [];
  let streamError = null;
  let streamDone = false;

  function wake() {
    const ws = waiters;
    waiters = [];
    ws.forEach((w) => w());
  }

  (async function pump() {
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          streamDone = true;
          wake();
          return;
        }
        if (value && value.length) {
          for (let i = 0; i < value.length; i++) queue.push(value[i]);
          wake();
        }
      }
    } catch (err) {
      streamError = err;
      wake();
    }
  })();

  return function readByte(timeoutMs = 1500) {
    if (queue.length > 0) return Promise.resolve(queue.shift());
    if (streamError) return Promise.reject(streamError);
    if (streamDone) return Promise.reject(new Error('Serial port closed'));

    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        waiters = waiters.filter((w) => w !== onWake);
        reject(new Error('Serial read timed out'));
      }, timeoutMs);

      function onWake() {
        if (settled) return;
        if (queue.length > 0) {
          settled = true;
          clearTimeout(timer);
          resolve(queue.shift());
        } else if (streamError) {
          settled = true;
          clearTimeout(timer);
          reject(streamError);
        } else if (streamDone) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('Serial port closed'));
        } else {
          waiters.push(onWake);
        }
      }

      waiters.push(onWake);
    });
  };
}
