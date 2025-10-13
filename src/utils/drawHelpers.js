// Helpers for manipulating frames (frames are arrays of 64 bytes: index = 8*y + x; bits = z)

export function mirrorX(frame) {
  const out = new Array(64).fill(0);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      out[8 * y + (7 - x)] = frame[8 * y + x];
    }
  return out;
}

export function mirrorY(frame) {
  const out = new Array(64).fill(0);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      out[8 * (7 - y) + x] = frame[8 * y + x];
    }
  return out;
}

export function mirrorZ(frame) {
  const out = new Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    const b = frame[i] || 0;
    let nb = 0;
    for (let z = 0; z < 8; z++) if (b & (1 << z)) nb |= 1 << (7 - z);
    out[i] = nb;
  }
  return out;
}

export function rotateZ90(frame) {
  // rotate around Z axis (i.e., rotate XY plane 90deg clockwise)
  const out = new Array(64).fill(0);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const src = frame[8 * y + x] || 0;
      // new coords: x' = 7 - y, y' = x
      out[8 * x + (7 - y)] = src;
    }
  return out;
}

export function interpolateFrames(a, b, steps) {
  // simple linear interpolation per bit per column: choose nearest step by threshold
  const res = [];
  for (let s = 1; s <= steps; s++) {
    const t = s / (steps + 1);
    const frame = new Array(64).fill(0);
    for (let i = 0; i < 64; i++) {
      const va = a[i] || 0;
      const vb = b[i] || 0;
      let out = 0;
      for (let z = 0; z < 8; z++) {
        const onA = (va >> z) & 1;
        const onB = (vb >> z) & 1;
        const val = onA * (1 - t) + onB * t;
        if (val >= 0.5) out |= 1 << z;
      }
      frame[i] = out;
    }
    res.push(frame);
  }
  return res;
}
