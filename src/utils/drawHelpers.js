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

// Deterministic pseudo-random threshold per (byteIndex, bit), 0..1.
// Same inputs always produce the same threshold, so re-running a transition
// is repeatable, but different LEDs flip at different points in the
// transition instead of all flipping at once.
function ditherThreshold(i, z) {
  const x = Math.sin(i * 12.9898 + z * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const EASINGS = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

export function interpolateFrames(a, b, steps, easing = 'linear') {
  const ease = EASINGS[easing] || EASINGS.linear;
  const res = [];
  for (let s = 1; s <= steps; s++) {
    const t = s / (steps + 1);
    const et = ease(t);
    const frame = new Array(64).fill(0);
    for (let i = 0; i < 64; i++) {
      const va = a[i] || 0;
      const vb = b[i] || 0;
      let out = 0;
      for (let z = 0; z < 8; z++) {
        const onA = (va >> z) & 1;
        const onB = (vb >> z) & 1;
        let bit;
        if (onA === onB) {
          bit = onA;
        } else {
          // hold the original value until this LED's own threshold is
          // crossed, then switch to the target value
          bit = et >= ditherThreshold(i, z) ? onB : onA;
        }
        if (bit) out |= 1 << z;
      }
      frame[i] = out;
    }
    res.push(frame);
  }
  return res;
}
