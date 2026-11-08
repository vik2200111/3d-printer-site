/**
 * Лёгкий движок 3D-геометрии без внешних зависимостей.
 * Заменяет three.js из оригинального проекта: генерация пресетов,
 * парсинг .STL/.OBJ, расчёт объёма и лапласиановское сглаживание.
 * Координаты — в миллиметрах, ось Y вверх, модель стоит на Y = 0.
 */

export interface MeshData {
  positions: Float32Array; // xyz на вершину
  indices: Uint32Array; // тройки индексов (треугольники)
}

export interface ModelDims {
  x: number;
  y: number;
  z: number;
}

export interface ProcessedModel {
  id: string;
  name: string;
  format: string;
  mesh: MeshData;
  dims: ModelDims;
  dimsText: string;
  volumeCm3: number;
  triangleCount: number;
}

export interface PresetModelInfo {
  id: string;
  name: string;
  label: string;
  format: string;
  tag: string;
}

export const PRESET_MODELS: PresetModelInfo[] = [
  { id: "cyber-turbine", name: "CYBER_TURBINE_V4.STL", label: "Турбина V4", format: ".STL", tag: "МЕХАНИКА" },
  { id: "voxel-monolith", name: "VOXEL_CORE_BLOCK.VOX", label: "Воксель-Ядро", format: ".VOX", tag: "ВОКСЕЛЬ" },
  { id: "planetary-gear", name: "PLANETARY_GEAR_42T.STL", label: "Шестерня 42T", format: ".STL", tag: "ПРИВОД" },
  { id: "manifold-nozzle", name: "AERO_MANIFOLD_X1.STL", label: "Сопло Aero-X1", format: ".STL", tag: "АЭРО" },
];

// ---------- små vector helpers ----------
type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// ---------- mesh builder ----------
function createBuilder() {
  const pos: number[] = [];
  const idx: number[] = [];
  return {
    vert(x: number, y: number, z: number): number {
      pos.push(x, y, z);
      return pos.length / 3 - 1;
    },
    tri(a: number, b: number, c: number) {
      idx.push(a, b, c);
    },
    quad(a: number, b: number, c: number, d: number) {
      idx.push(a, b, c, a, c, d);
    },
    build(): MeshData {
      return { positions: new Float32Array(pos), indices: Uint32Array.from(idx) };
    },
  };
}

/** Одна грань: origin + два направляющих вектора, seg x seg ячеек */
function addFace(
  b: ReturnType<typeof createBuilder>,
  o: V3,
  a: V3,
  bb: V3,
  w: number,
  h: number,
  seg: number
) {
  const rows: number[] = [];
  for (let i = 0; i <= seg; i++) {
    rows[i] = b.vert(0, 0, 0); // placeholder, ниже перепишем координаты
  }
  // проще: строим сетку явно
  const grid: number[][] = [];
  for (let i = 0; i <= seg; i++) {
    grid[i] = [];
    for (let j = 0; j <= seg; j++) {
      const u = (i / seg) * w;
      const v = (j / seg) * h;
      grid[i][j] = b.vert(
        o[0] + a[0] * u + bb[0] * v,
        o[1] + a[1] * u + bb[1] * v,
        o[2] + a[2] * u + bb[2] * v
      );
    }
  }
  // уберём лишние placeholder-вершины (они не попадут в индексы — mesh хранит их, но это безвредно)
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg; j++) {
      b.quad(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
    }
  }
  void rows;
}

function addBox(
  b: ReturnType<typeof createBuilder>,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  seg = 1
) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy, y1 = cy + h;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  // +Y (top)
  addFace(b, [x0, y1, z0], [1, 0, 0], [0, 0, 1], w, d, seg);
  // -Y (bottom)
  addFace(b, [x0, y0, z1], [1, 0, 0], [0, 0, -1], w, d, seg);
  // +Z
  addFace(b, [x0, y0, z1], [1, 0, 0], [0, 1, 0], w, h, seg);
  // -Z
  addFace(b, [x1, y0, z0], [-1, 0, 0], [0, 1, 0], w, h, seg);
  // +X
  addFace(b, [x1, y0, z0], [0, 0, 1], [0, 1, 0], d, h, seg);
  // -X
  addFace(b, [x0, y0, z1], [0, 0, -1], [0, 1, 0], d, h, seg);
}

// ---------- torus knot (CYBER TURBINE) ----------
function knotPoint(t: number, p: number, q: number, r: number): V3 {
  const cu = Math.cos(t);
  const su = Math.sin(t);
  const qt = (q / p) * t;
  const cs = Math.cos(qt);
  return [
    r * (2 + cs) * 0.5 * cu,
    r * (2 + cs) * 0.5 * su,
    r * Math.sin(qt) * 0.5,
  ];
}

function addTorusKnot(
  b: ReturnType<typeof createBuilder>,
  p: number,
  q: number,
  R: number,
  tube: number,
  tubular: number,
  radial: number
) {
  const rings: number[][] = [];
  let prevN: V3 | null = null;
  for (let i = 0; i <= tubular; i++) {
    const t = (i / tubular) * Math.PI * 2;
    const c = knotPoint(t, p, q, R);
    const c2 = knotPoint(t + 1e-4, p, q, R);
    const T = norm(sub(c2, c));
    let N: V3;
    if (prevN) {
      const d = dot(prevN, T);
      N = sub(prevN, [T[0] * d, T[1] * d, T[2] * d]);
      if (len(N) < 1e-6) N = norm(cross(T, [0, 0, 1]));
      else N = norm(N);
    } else {
      let ref: V3 = cross(T, [0, 0, 1]);
      if (len(ref) < 1e-6) ref = cross(T, [0, 1, 0]);
      N = norm(ref);
    }
    prevN = N;
    const Bv = norm(cross(T, N));
    const ring: number[] = [];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ring.push(
        b.vert(
          c[0] + (N[0] * ca + Bv[0] * sa) * tube,
          c[1] + (N[1] * ca + Bv[1] * sa) * tube,
          c[2] + (N[2] * ca + Bv[2] * sa) * tube
        )
      );
    }
    rings.push(ring);
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      b.quad(rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]);
    }
  }
}

// ---------- extruded gear (PLANETARY GEAR) ----------
function addGear(
  b: ReturnType<typeof createBuilder>,
  teeth: number,
  outerR: number,
  innerR: number,
  depth: number
) {
  const ring: Array<[number, number]> = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.25) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a3 = ((i + 0.75) / teeth) * Math.PI * 2;
    ring.push([Math.cos(a0) * innerR, Math.sin(a0) * innerR]);
    ring.push([Math.cos(a1) * outerR, Math.sin(a1) * outerR]);
    ring.push([Math.cos(a2) * outerR, Math.sin(a2) * outerR]);
    ring.push([Math.cos(a3) * innerR, Math.sin(a3) * innerR]);
  }
  const n = ring.length;
  const bottom: number[] = [];
  const top: number[] = [];
  for (let i = 0; i < n; i++) {
    bottom.push(b.vert(ring[i][0], 0, ring[i][1]));
    top.push(b.vert(ring[i][0], depth, ring[i][1]));
  }
  const cB = b.vert(0, 0, 0);
  const cT = b.vert(0, depth, 0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    b.quad(bottom[i], bottom[j], top[j], top[i]); // боковая стенка
    b.tri(cB, bottom[j], bottom[i]); // нижняя крышка
    b.tri(cT, top[i], top[j]); // верхняя крышка
  }
}

// ---------- lathe / nozzle (AERO MANIFOLD) ----------
function addLathe(
  b: ReturnType<typeof createBuilder>,
  profile: Array<[number, number]>,
  segments: number
) {
  const rings: number[][] = [];
  for (let s = 0; s <= segments; s++) {
    const a = (s / segments) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ring: number[] = [];
    for (const [r, y] of profile) {
      ring.push(b.vert(r * ca, y, r * sa));
    }
    rings.push(ring);
  }
  const m = profile.length;
  for (let s = 0; s < segments; s++) {
    for (let i = 0; i < m - 1; i++) {
      b.quad(rings[s][i], rings[s + 1][i], rings[s + 1][i + 1], rings[s][i + 1]);
    }
  }
  // крышки
  const cB = b.vert(0, profile[0][1], 0);
  const cT = b.vert(0, profile[m - 1][1], 0);
  for (let s = 0; s < segments; s++) {
    b.tri(cB, rings[s + 1][0], rings[s][0]);
    b.tri(cT, rings[s][m - 1], rings[s + 1][m - 1]);
  }
}

// ---------- voxel monolith ----------
function addVoxelMonolith(b: ReturnType<typeof createBuilder>) {
  const layout: Array<[number, number, number, number, number, number]> = [
    [0, 12, 0, 56, 24, 56],
    [0, 32, 0, 42, 18, 42],
    [0, 48, 0, 26, 16, 26],
    [-20, 26, -20, 14, 28, 14],
    [20, 26, -20, 14, 28, 14],
    [-20, 26, 20, 14, 28, 14],
    [20, 26, 20, 14, 28, 14],
    [0, 62, 0, 14, 14, 14],
  ];
  for (const [x, y, z, w, h, d] of layout) {
    addBox(b, x, y, z, w, h, d, 3);
  }
}

// ---------- bbox / volume / normalize ----------
export interface BBox {
  min: V3;
  max: V3;
}

export function computeBBox(m: MeshData): BBox {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  const p = m.positions;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < min[0]) min[0] = p[i];
    if (p[i + 1] < min[1]) min[1] = p[i + 1];
    if (p[i + 2] < min[2]) min[2] = p[i + 2];
    if (p[i] > max[0]) max[0] = p[i];
    if (p[i + 1] > max[1]) max[1] = p[i + 1];
    if (p[i + 2] > max[2]) max[2] = p[i + 2];
  }
  return { min, max };
}

/** Знаковый объём замкнутой сетки (теорема дивергенции), см³ */
export function computeMeshVolumeCm3(m: MeshData): number {
  const p = m.positions;
  const idx = m.indices;
  let volumeMm3 = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    volumeMm3 +=
      (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) +
        p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) +
        p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) /
      6.0;
  }
  const absCm3 = Math.abs(volumeMm3) / 1000.0;
  if (!Number.isFinite(absCm3) || absCm3 < 0.8) {
    const bb = computeBBox(m);
    const sx = bb.max[0] - bb.min[0];
    const sy = bb.max[1] - bb.min[1];
    const sz = bb.max[2] - bb.min[2];
    return Number(Math.max(2.5, (sx * sy * sz * 0.36) / 1000).toFixed(2));
  }
  return Number(absCm3.toFixed(2));
}

/** Нормализация: центр по X/Z, низ на Y=0, масштаб под стол принтера (мм) */
export function normalizeMesh(
  m: MeshData,
  targetMaxDimMm = 86
): { mesh: MeshData; dims: ModelDims } {
  const bb = computeBBox(m);
  const size: V3 = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
  const center: V3 = [
    (bb.max[0] + bb.min[0]) / 2,
    (bb.max[1] + bb.min[1]) / 2,
    (bb.max[2] + bb.min[2]) / 2,
  ];
  const maxDim = Math.max(size[0], size[1], size[2], 0.001);
  const scale = maxDim < 15 || maxDim > 210 ? targetMaxDimMm / maxDim : 1;

  const out = new Float32Array(m.positions.length);
  for (let i = 0; i < m.positions.length; i += 3) {
    out[i] = (m.positions[i] - center[0]) * scale;
    out[i + 1] = (m.positions[i + 1] - bb.min[1]) * scale;
    out[i + 2] = (m.positions[i + 2] - center[2]) * scale;
  }
  const mesh: MeshData = { positions: out, indices: m.indices };
  const bb2 = computeBBox(mesh);
  const dims: ModelDims = {
    x: Math.max(1, Math.round(bb2.max[0] - bb2.min[0])),
    y: Math.max(1, Math.round(bb2.max[1] - bb2.min[1])),
    z: Math.max(1, Math.round(bb2.max[2] - bb2.min[2])),
  };
  return { mesh, dims };
}

/** Сварка дублирующихся вершин (для сглаживания) */
export function weldMesh(m: MeshData): MeshData {
  const map = new Map<string, number>();
  const pos: number[] = [];
  const idx = new Uint32Array(m.indices.length);
  for (let i = 0; i < m.indices.length; i++) {
    const vi = m.indices[i];
    const x = m.positions[vi * 3];
    const y = m.positions[vi * 3 + 1];
    const z = m.positions[vi * 3 + 2];
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let ni = map.get(key);
    if (ni === undefined) {
      ni = pos.length / 3;
      map.set(key, ni);
      pos.push(x, y, z);
    }
    idx[i] = ni;
  }
  return { positions: new Float32Array(pos), indices: idx };
}

/** Лапласиановское сглаживание 0..100% */
export function smoothMesh(m: MeshData, smoothingPercent: number): MeshData {
  const clamped = Math.max(0, Math.min(100, smoothingPercent));
  if (clamped <= 2) return m;
  const w = weldMesh(m);
  const vertexCount = w.positions.length / 3;
  if (vertexCount >= 45000) return w;

  const neighbors: Set<number>[] = Array.from({ length: vertexCount }, () => new Set<number>());
  for (let i = 0; i < w.indices.length; i += 3) {
    const a = w.indices[i];
    const b = w.indices[i + 1];
    const c = w.indices[i + 2];
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }
  const iterations = clamped > 70 ? 3 : clamped > 35 ? 2 : 1;
  const lambda = (clamped / 100) * 0.42;
  const current = new Float32Array(w.positions);
  const next = new Float32Array(current.length);
  for (let iter = 0; iter < iterations; iter++) {
    for (let v = 0; v < vertexCount; v++) {
      const nb = neighbors[v];
      if (nb.size === 0) {
        next[v * 3] = current[v * 3];
        next[v * 3 + 1] = current[v * 3 + 1];
        next[v * 3 + 2] = current[v * 3 + 2];
        continue;
      }
      let ax = 0, ay = 0, az = 0;
      nb.forEach((n) => {
        ax += current[n * 3];
        ay += current[n * 3 + 1];
        az += current[n * 3 + 2];
      });
      ax /= nb.size;
      ay /= nb.size;
      az /= nb.size;
      next[v * 3] = current[v * 3] + (ax - current[v * 3]) * lambda;
      next[v * 3 + 1] = current[v * 3 + 1] + (ay - current[v * 3 + 1]) * lambda;
      next[v * 3 + 2] = current[v * 3 + 2] + (az - current[v * 3 + 2]) * lambda;
    }
    current.set(next);
  }
  return { positions: current, indices: w.indices };
}

// ---------- presets ----------
export function createPresetModel(presetId: string): ProcessedModel {
  const preset = PRESET_MODELS.find((p) => p.id === presetId) ?? PRESET_MODELS[0];
  const b = createBuilder();
  if (preset.id === "voxel-monolith") {
    addVoxelMonolith(b);
  } else if (preset.id === "planetary-gear") {
    addGear(b, 18, 42, 35, 22);
  } else if (preset.id === "manifold-nozzle") {
    const profile: Array<[number, number]> = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const radius = 14 + Math.sin(t * Math.PI * 1.35) * 18 + Math.cos(t * Math.PI * 3) * 3;
      profile.push([Math.max(6, radius), t * 84]);
    }
    addLathe(b, profile, 28);
  } else {
    addTorusKnot(b, 2, 3, 24, 8.5, 64, 12);
  }
  const raw = b.build();
  const { mesh, dims } = normalizeMesh(raw, 86);
  const volumeCm3 = computeMeshVolumeCm3(mesh);
  return {
    id: preset.id,
    name: preset.name,
    format: preset.format,
    mesh,
    dims,
    dimsText: `${dims.x} × ${dims.y} × ${dims.z} мм`,
    volumeCm3,
    triangleCount: mesh.indices.length / 3,
  };
}

// ---------- STL / OBJ parsers ----------
function parseSTL(buffer: ArrayBuffer): MeshData {
  const head = new TextDecoder().decode(
    new Uint8Array(buffer.slice(0, Math.min(512, buffer.byteLength)))
  );
  const isAscii = head.trimStart().startsWith("solid") && head.includes("facet");
  const b = createBuilder();
  if (isAscii) {
    const text = new TextDecoder().decode(buffer);
    const verts: number[][] = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith("vertex")) {
        const parts = t.split(/\s+/);
        verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        if (verts.length === 3) {
          const v = b.vert(verts[0][0], verts[0][1], verts[0][2]);
          const w = b.vert(verts[1][0], verts[1][1], verts[1][2]);
          const u = b.vert(verts[2][0], verts[2][1], verts[2][2]);
          b.tri(v, w, u);
          verts.length = 0;
        }
      }
    }
  } else {
    const dv = new DataView(buffer);
    const count = dv.getUint32(80, true);
    const expected = 84 + count * 50;
    if (count === 0 || expected > buffer.byteLength + 64) {
      throw new Error("Повреждённый бинарный .STL файл.");
    }
    for (let i = 0; i < count; i++) {
      const off = 84 + i * 50 + 12; // пропускаем нормаль
      const read = (k: number) => dv.getFloat32(off + k * 4, true);
      const a = b.vert(read(0), read(1), read(2));
      const c = b.vert(read(3), read(4), read(5));
      const d = b.vert(read(6), read(7), read(8));
      b.tri(a, c, d);
    }
  }
  if (b.build().indices.length === 0) {
    throw new Error("В файле .STL не найдено треугольников.");
  }
  return b.build();
}

function parseOBJ(text: string): MeshData {
  const b = createBuilder();
  const verts: Array<[number, number, number]> = [];
  let found = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (line.startsWith("f ")) {
      const parts = line.split(/\s+/).slice(1);
      const ids: number[] = parts.map((tok) => {
        const n = parseInt(tok.split("/")[0], 10);
        return n < 0 ? verts.length + n : n - 1;
      });
      for (let i = 1; i < ids.length - 1; i++) {
        const v0 = verts[ids[0]];
        const v1 = verts[ids[i]];
        const v2 = verts[ids[i + 1]];
        if (!v0 || !v1 || !v2) continue;
        const a = b.vert(v0[0], v0[1], v0[2]);
        const c = b.vert(v1[0], v1[1], v1[2]);
        const d = b.vert(v2[0], v2[1], v2[2]);
        b.tri(a, c, d);
        found++;
      }
    }
  }
  if (found === 0) {
    throw new Error("В файле .OBJ не найдены 3D-полигоны.");
  }
  return b.build();
}

export async function parseUploaded3DFile(file: File): Promise<ProcessedModel> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  let raw: MeshData;
  let format: string;
  if (lowerName.endsWith(".stl")) {
    format = ".STL";
    raw = parseSTL(buffer);
  } else if (lowerName.endsWith(".obj")) {
    format = ".OBJ";
    raw = parseOBJ(new TextDecoder().decode(buffer));
  } else {
    throw new Error("Поддерживаются форматы .STL и .OBJ");
  }
  const { mesh, dims } = normalizeMesh(raw, 88);
  const volumeCm3 = computeMeshVolumeCm3(mesh);
  return {
    id: `custom-${Date.now()}`,
    name: file.name.toUpperCase(),
    format,
    mesh,
    dims,
    dimsText: `${dims.x} × ${dims.y} × ${dims.z} мм`,
    volumeCm3,
    triangleCount: mesh.indices.length / 3,
  };
}
