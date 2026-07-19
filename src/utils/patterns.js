// Procedural animation patterns for the 8x8x8 cube.
// Every generator returns an array of frames; each frame is a 64-length
// array where index = 8*y + x and bit z of that value is the LED at
// depth y, column x, height z -- the same format used everywhere else
// in the app (CubeEditor, exporter, Cube3D).

const SIZE = 8;
const CENTER = 3.5;

function blankFrame() {
  return new Array(64).fill(0);
}

function setVoxel(frame, x, y, z) {
  const fx = Math.round(x);
  const fy = Math.round(y);
  const fz = Math.round(z);
  if (fx >= 0 && fx < SIZE && fy >= 0 && fy < SIZE && fz >= 0 && fz < SIZE) {
    frame[8 * fy + fx] |= 1 << fz;
  }
}

// Expanding-then-contracting hollow sphere shell, centered in the cube.
export function generateSphereFrames(steps = 20) {
  const frames = [];
  const maxR = 5.0;
  const half = Math.floor(steps / 2) || 1;
  for (let s = 0; s < steps; s++) {
    const t = s < half ? s / half : (steps - s) / (steps - half);
    const radius = t * maxR;
    const frame = blankFrame();
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        for (let z = 0; z < SIZE; z++) {
          const dx = x - CENTER;
          const dy = y - CENTER;
          const dz = z - CENTER;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (Math.abs(dist - radius) < 0.8) {
            frame[8 * y + x] |= 1 << z;
          }
        }
      }
    }
    frames.push(frame);
  }
  return frames;
}

// Random columns "fall" from top (z=7) to bottom (z=0), each with a short
// trailing tail so motion reads clearly without brightness/fade.
export function generateRainFrames(numFrames = 30, density = 0.15) {
  const drops = {}; // "x,y" -> current head z
  const frames = [];
  for (let f = 0; f < numFrames; f++) {
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        const key = `${x},${y}`;
        if (!(key in drops) && Math.random() < density) {
          drops[key] = 7;
        }
      }
    }
    const frame = blankFrame();
    for (const key of Object.keys(drops)) {
      const [x, y] = key.split(',').map(Number);
      const head = drops[key];
      for (let t = 0; t < 3; t++) {
        const z = head + t;
        if (z >= 0 && z < SIZE) frame[8 * y + x] |= 1 << z;
      }
      drops[key] = head - 1;
      if (drops[key] < -3) delete drops[key];
    }
    frames.push(frame);
  }
  return frames;
}

// A full plane sweeping through the cube along X, Y, or Z, bouncing
// back and forth between the two faces.
export function generateScannerFrames(axis = 'z', steps = 16) {
  const frames = [];
  const positions = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
  for (let s = 0; s < steps; s++) {
    const pos = positions[s % positions.length];
    const frame = blankFrame();
    if (axis === 'x') {
      for (let y = 0; y < SIZE; y++) frame[8 * y + pos] = 0xff;
    } else if (axis === 'y') {
      for (let x = 0; x < SIZE; x++) frame[8 * pos + x] = 0xff;
    } else {
      for (let i = 0; i < 64; i++) frame[i] = 1 << pos;
    }
    frames.push(frame);
  }
  return frames;
}

// Every voxel independently has a chance to be lit each frame -- a
// twinkling/static-noise background effect.
export function generateSparkleFrames(numFrames = 30, density = 0.12) {
  const frames = [];
  for (let f = 0; f < numFrames; f++) {
    const frame = blankFrame();
    for (let i = 0; i < 64; i++) {
      let byte = 0;
      for (let z = 0; z < SIZE; z++) {
        if (Math.random() < density) byte |= 1 << z;
      }
      frame[i] = byte;
    }
    frames.push(frame);
  }
  return frames;
}

const CUBE_CORNERS = [];
for (const zc of [0, 7]) {
  for (const yc of [0, 7]) {
    for (const xc of [0, 7]) {
      CUBE_CORNERS.push([xc, yc, zc]);
    }
  }
}
const CUBE_EDGES = [];
for (let i = 0; i < CUBE_CORNERS.length; i++) {
  for (let j = i + 1; j < CUBE_CORNERS.length; j++) {
    const a = CUBE_CORNERS[i];
    const b = CUBE_CORNERS[j];
    const diffs =
      (a[0] !== b[0] ? 1 : 0) + (a[1] !== b[1] ? 1 : 0) + (a[2] !== b[2] ? 1 : 0);
    if (diffs === 1) CUBE_EDGES.push([a, b]);
  }
}

// The cube's own 12 edges, spinning around the vertical (Z) axis.
export function generateWireframeCubeFrames(steps = 24) {
  const frames = [];
  const samplesPerEdge = 9;
  for (let s = 0; s < steps; s++) {
    const angle = (s / steps) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const frame = blankFrame();
    for (const [a, b] of CUBE_EDGES) {
      for (let t = 0; t <= samplesPerEdge; t++) {
        const frac = t / samplesPerEdge;
        const px = a[0] + (b[0] - a[0]) * frac;
        const py = a[1] + (b[1] - a[1]) * frac;
        const pz = a[2] + (b[2] - a[2]) * frac;
        const dx = px - CENTER;
        const dy = py - CENTER;
        const rx = dx * cosA - dy * sinA;
        const ry = dx * sinA + dy * cosA;
        setVoxel(frame, CENTER + rx, CENTER + ry, pz);
      }
    }
    frames.push(frame);
  }
  return frames;
}

// A point climbing a helical path from bottom to top, with a short trail.
export function generateSpiralFrames(steps = 32, turns = 3) {
  const frames = [];
  const radius = 3.2;
  const trailLen = 4;
  const path = [];
  for (let s = 0; s < steps; s++) {
    const t = s / Math.max(1, steps - 1);
    const angle = t * Math.PI * 2 * turns;
    const z = t * 7;
    path.push([
      CENTER + radius * Math.cos(angle),
      CENTER + radius * Math.sin(angle),
      z,
    ]);
  }
  for (let s = 0; s < steps; s++) {
    const frame = blankFrame();
    for (let k = Math.max(0, s - trailLen + 1); k <= s; k++) {
      setVoxel(frame, path[k][0], path[k][1], path[k][2]);
    }
    frames.push(frame);
  }
  return frames;
}

// A single voxel bouncing off the cube's walls (deterministic, not
// randomized, so it's repeatable), with a short trail.
export function generateBouncingBallFrames(numFrames = 40) {
  const frames = [];
  const pos = [1.2, 2.3, 0.7];
  const vel = [0.37, 0.29, 0.41]; // irrational-ish ratios avoid short cycles
  const trail = [];
  for (let f = 0; f < numFrames; f++) {
    for (let i = 0; i < 3; i++) {
      pos[i] += vel[i];
      if (pos[i] < 0) {
        pos[i] = -pos[i];
        vel[i] = -vel[i];
      }
      if (pos[i] > 7) {
        pos[i] = 14 - pos[i];
        vel[i] = -vel[i];
      }
    }
    trail.unshift(pos.slice());
    if (trail.length > 3) trail.pop();
    const frame = blankFrame();
    trail.forEach(([x, y, z]) => setVoxel(frame, x, y, z));
    frames.push(frame);
  }
  return frames;
}

const BURST_DIRECTIONS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
].map(([x, y, z]) => {
  const len = Math.sqrt(x * x + y * y + z * z);
  return [x / len, y / len, z / len];
});

// A handful of firework bursts from random points inside the cube,
// expanding outward along 14 fixed directions and fading (by stopping).
export function generateFireworksFrames(bursts = 3, framesPerBurst = 10) {
  const frames = [];
  for (let b = 0; b < bursts; b++) {
    const origin = [
      2 + Math.random() * 4,
      2 + Math.random() * 4,
      2 + Math.random() * 4,
    ];
    const maxRadius = 4.5;
    for (let f = 0; f < framesPerBurst; f++) {
      const t = f / Math.max(1, framesPerBurst - 1);
      const radius = t * maxRadius;
      const frame = blankFrame();
      for (const [dx, dy, dz] of BURST_DIRECTIONS) {
        setVoxel(
          frame,
          origin[0] + dx * radius,
          origin[1] + dy * radius,
          origin[2] + dz * radius,
        );
      }
      frames.push(frame);
    }
  }
  return frames;
}

// Expanding-then-contracting hollow CUBE shell (Chebyshev distance instead
// of Euclidean) -- same pulse as Sphere, square silhouette instead of round.
export function generateExpandingCubeFrames(steps = 20) {
  const frames = [];
  const maxR = 4.2;
  const half = Math.floor(steps / 2) || 1;
  for (let s = 0; s < steps; s++) {
    const t = s < half ? s / half : (steps - s) / (steps - half);
    const radius = t * maxR;
    const frame = blankFrame();
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        for (let z = 0; z < SIZE; z++) {
          const dist = Math.max(
            Math.abs(x - CENTER),
            Math.abs(y - CENTER),
            Math.abs(z - CENTER),
          );
          if (Math.abs(dist - radius) < 0.6) {
            frame[8 * y + x] |= 1 << z;
          }
        }
      }
    }
    frames.push(frame);
  }
  return frames;
}

// A sinusoidal surface undulating across x/y over time, like water.
export function generateWaveFrames(steps = 32) {
  const frames = [];
  const amplitude = 2.5;
  const freq = 0.8;
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * Math.PI * 4; // 2 full cycles across the loop
    const frame = blankFrame();
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        const h =
          CENTER + amplitude * Math.sin(freq * x + freq * y * 0.6 + phase);
        setVoxel(frame, x, y, h);
      }
    }
    frames.push(frame);
  }
  return frames;
}

// Small deterministic PRNG (LCG) so Snake is repeatable, same spirit as
// Bouncing Ball -- no external RNG state, no Math.random().
function makeRng(seed) {
  let s = seed;
  return function next() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const AXIS_DIRECTIONS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

// A connected multi-segment body moving through the cube, turning whenever
// it would hit a wall (or occasionally at random) -- the classic game.
export function generateSnakeFrames(numFrames = 40, length = 6, seed = 7) {
  const frames = [];
  const rand = makeRng(seed);
  let pos = [1, 1, 1];
  let dir = [1, 0, 0];
  const body = [pos.slice()];

  function inBounds(p) {
    return p.every((v) => v >= 0 && v <= 7);
  }

  for (let f = 0; f < numFrames; f++) {
    const next = [pos[0] + dir[0], pos[1] + dir[1], pos[2] + dir[2]];
    if (!inBounds(next) || rand() < 0.15) {
      let chosen = dir;
      for (let tries = 0; tries < 10; tries++) {
        const candidate =
          AXIS_DIRECTIONS[Math.floor(rand() * AXIS_DIRECTIONS.length)];
        const cand = [
          pos[0] + candidate[0],
          pos[1] + candidate[1],
          pos[2] + candidate[2],
        ];
        if (inBounds(cand)) {
          chosen = candidate;
          break;
        }
      }
      dir = chosen;
    }
    pos = [
      Math.min(7, Math.max(0, pos[0] + dir[0])),
      Math.min(7, Math.max(0, pos[1] + dir[1])),
      Math.min(7, Math.max(0, pos[2] + dir[2])),
    ];
    body.unshift(pos.slice());
    if (body.length > length) body.pop();

    const frame = blankFrame();
    body.forEach(([x, y, z]) => setVoxel(frame, x, y, z));
    frames.push(frame);
  }
  return frames;
}

// The cube fills solid from bottom to top like rising liquid, holds, then
// drains back down from the top. Useful as a status/loading indicator too.
export function generateFillDrainFrames(holdFrames = 2) {
  const frames = [];
  for (let z = 0; z < SIZE; z++) {
    const frame = blankFrame();
    for (let zz = 0; zz <= z; zz++) {
      for (let i = 0; i < 64; i++) frame[i] |= 1 << zz;
    }
    frames.push(frame);
  }
  const full = frames[frames.length - 1];
  for (let h = 0; h < holdFrames; h++) frames.push(full.slice());
  for (let z = SIZE - 1; z >= 0; z--) {
    const frame = blankFrame();
    for (let zz = 0; zz < z; zz++) {
      for (let i = 0; i < 64; i++) frame[i] |= 1 << zz;
    }
    frames.push(frame);
  }
  const empty = blankFrame();
  for (let h = 0; h < holdFrames; h++) frames.push(empty.slice());
  return frames;
}

// A 3D checkerboard that inverts every frame -- a hypnotic strobe.
export function generateCheckerboardFrames(numFrames = 20) {
  const frames = [];
  for (let f = 0; f < numFrames; f++) {
    const parity = f % 2;
    const frame = blankFrame();
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        for (let z = 0; z < SIZE; z++) {
          if ((x + y + z) % 2 === parity) {
            frame[8 * y + x] |= 1 << z;
          }
        }
      }
    }
    frames.push(frame);
  }
  return frames;
}

// Same idea as the axis-aligned Scanner, but the plane sweeps along a
// cube diagonal instead -- a different silhouette for very little new code.
export function generateDiagonalScannerFrames(steps = 20) {
  const frames = [];
  const len = Math.sqrt(3);
  const [nx, ny, nz] = [1 / len, 1 / len, 1 / len];
  const maxD = 7 * len;
  const positions = [];
  for (let i = 0; i <= steps; i++) positions.push((i / steps) * maxD);
  for (let i = steps - 1; i >= 1; i--) positions.push((i / steps) * maxD);
  for (let s = 0; s < steps; s++) {
    const d = positions[s % positions.length];
    const frame = blankFrame();
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        for (let z = 0; z < SIZE; z++) {
          const dist = x * nx + y * ny + z * nz;
          if (Math.abs(dist - d) < 0.9) {
            frame[8 * y + x] |= 1 << z;
          }
        }
      }
    }
    frames.push(frame);
  }
  return frames;
}

// All 12 edges light up in sync, each with its own short traveling point
// running from one corner to the other -- a "circuit energizing" effect,
// distinct from Wireframe Cube's whole-shape rotation.
export function generateEdgeChaseFrames(steps = 32, trailLen = 3) {
  const frames = [];
  for (let s = 0; s < steps; s++) {
    const t = s / steps;
    const frame = blankFrame();
    for (const [a, b] of CUBE_EDGES) {
      for (let k = 0; k < trailLen; k++) {
        const frac = (((t - k / steps) % 1) + 1) % 1;
        setVoxel(
          frame,
          a[0] + (b[0] - a[0]) * frac,
          a[1] + (b[1] - a[1]) * frac,
          a[2] + (b[2] - a[2]) * frac,
        );
      }
    }
    frames.push(frame);
  }
  return frames;
}

// A small cluster "satellite" orbiting at a fixed radius around a tilted
// axis through the center -- distinct from Spiral, which climbs vertically.
export function generateOrbitFrames(steps = 32, tilt = 0.5) {
  const frames = [];
  const radius = 3;
  for (let s = 0; s < steps; s++) {
    const angle = (s / steps) * Math.PI * 2;
    const x = CENTER + radius * Math.cos(angle);
    const yFlat = radius * Math.sin(angle);
    const y = CENTER + yFlat * Math.cos(tilt);
    const z = CENTER + yFlat * Math.sin(tilt);
    const frame = blankFrame();
    const cx = Math.round(x);
    const cy = Math.round(y);
    const cz = Math.round(z);
    for (let dx = 0; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = 0; dz <= 1; dz++) {
          setVoxel(frame, cx + dx, cy + dy, cz + dz);
        }
      }
    }
    frames.push(frame);
  }
  return frames;
}
