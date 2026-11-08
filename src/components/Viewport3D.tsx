import { useEffect, useMemo, useRef } from "react";
import { smoothMesh, type ProcessedModel } from "@/lib/mesh";
import type { PrintCalculationResult } from "@/lib/slicer-math";
import { cn } from "@/utils/cn";

interface Props {
  model: ProcessedModel | null;
  colorHex: string;
  smoothing: number;
  progress: number; // 0..100 — какая часть модели уже "напечатана"
  printing: boolean;
  estimate: PrintCalculationResult | null;
}

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
const BED_HALF = 110; // половина стола принтера, мм
const FRAME_H = 240; // высота рамы, мм

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export default function Viewport3D({ model, colorHex, smoothing, progress, printing, estimate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef(0.6);
  const dragRef = useRef<{ active: boolean; x: number }>({ active: false, x: 0 });
  const propsRef = useRef({ model, colorHex, progress, printing, estimate });
  propsRef.current = { model, colorHex, progress, printing, estimate };

  const displayMesh = useMemo(
    () => (model ? smoothMesh(model.mesh, smoothing) : null),
    [model, smoothing]
  );
  const meshRef = useRef(displayMesh);
  meshRef.current = displayMesh;

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = box.clientWidth;
      const h = box.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const draw = () => {
      const { model: m, colorHex: color, progress: prog, printing: isPrinting } = propsRef.current;
      const mesh = meshRef.current;
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w === 0 || h === 0) return;

      ctx.fillStyle = "#07090c";
      ctx.fillRect(0, 0, w, h);

      const s = Math.min(w, h) / 460;
      const cx = w / 2;
      const cy = h * 0.68;
      const rot = rotRef.current;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      const project = (x: number, y: number, z: number): [number, number] => {
        const xr = x * cosR + z * sinR;
        const zr = -x * sinR + z * cosR;
        return [cx + (xr - zr) * COS30 * s, cy + (xr + zr) * SIN30 * s - y * s];
      };

      const edge = (a: [number, number, number], b: [number, number, number], style: string, lw = 1) => {
        const pa = project(a[0], a[1], a[2]);
        const pb = project(b[0], b[1], b[2]);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.stroke();
      };

      // --- каркас принтера ---
      ctx.lineWidth = 1;
      for (let i = -BED_HALF; i <= BED_HALF; i += 22) {
        edge([i, 0, -BED_HALF], [i, 0, BED_HALF], "rgba(57,255,20,0.10)");
        edge([-BED_HALF, 0, i], [BED_HALF, 0, i], "rgba(57,255,20,0.10)");
      }
      const corners: Array<[number, number, number]> = [
        [-BED_HALF, 0, -BED_HALF],
        [BED_HALF, 0, -BED_HALF],
        [BED_HALF, 0, BED_HALF],
        [-BED_HALF, 0, BED_HALF],
      ];
      for (const c of corners) edge(c, [c[0], FRAME_H, c[2]], "rgba(57,255,20,0.30)");
      edge([-BED_HALF, FRAME_H, -BED_HALF], [BED_HALF, FRAME_H, -BED_HALF], "rgba(57,255,20,0.30)");
      edge([BED_HALF, FRAME_H, -BED_HALF], [BED_HALF, FRAME_H, BED_HALF], "rgba(57,255,20,0.30)");
      edge([BED_HALF, FRAME_H, BED_HALF], [-BED_HALF, FRAME_H, BED_HALF], "rgba(57,255,20,0.30)");
      edge([-BED_HALF, FRAME_H, BED_HALF], [-BED_HALF, FRAME_H, -BED_HALF], "rgba(57,255,20,0.30)");
      // стол (cyan)
      edge(corners[0], corners[1], "rgba(0,229,255,0.55)", 1.5);
      edge(corners[1], corners[2], "rgba(0,229,255,0.55)", 1.5);
      edge(corners[2], corners[3], "rgba(0,229,255,0.55)", 1.5);
      edge(corners[3], corners[0], "rgba(0,229,255,0.55)", 1.5);

      // --- модель ---
      if (m && mesh) {
        const printY = (prog / 100) * m.dims.y;
        const p = mesh.positions;
        const idx = mesh.indices;
        const total = idx.length / 3;
        const stride = Math.max(1, Math.ceil(total / 5200));
        const [cr, cg, cb] = hexToRgb(color);
        const L = [-0.45, 0.85, 0.35];
        const Ll = Math.hypot(L[0], L[1], L[2]);

        interface Tri {
          pts: [number, number][];
          depth: number;
          cy: number;
          inten: number;
        }
        const tris: Tri[] = [];
        for (let t = 0; t < total; t += stride) {
          const i0 = idx[t * 3] * 3;
          const i1 = idx[t * 3 + 1] * 3;
          const i2 = idx[t * 3 + 2] * 3;
          const rv: Array<[number, number, number]> = [
            [p[i0] * cosR + p[i0 + 2] * sinR, p[i0 + 1], -p[i0] * sinR + p[i0 + 2] * cosR],
            [p[i1] * cosR + p[i1 + 2] * sinR, p[i1 + 1], -p[i1] * sinR + p[i1 + 2] * cosR],
            [p[i2] * cosR + p[i2 + 2] * sinR, p[i2 + 1], -p[i2] * sinR + p[i2 + 2] * cosR],
          ];
          const depth =
            (rv[0][0] + rv[1][0] + rv[2][0] + rv[0][2] + rv[1][2] + rv[2][2]) / 3 +
            ((rv[0][1] + rv[1][1] + rv[2][1]) / 3) * 0.5;
          const cy = (rv[0][1] + rv[1][1] + rv[2][1]) / 3;
          const u: [number, number, number] = [rv[1][0] - rv[0][0], rv[1][1] - rv[0][1], rv[1][2] - rv[0][2]];
          const v: [number, number, number] = [rv[2][0] - rv[0][0], rv[2][1] - rv[0][1], rv[2][2] - rv[0][2]];
          const nx = u[1] * v[2] - u[2] * v[1];
          const ny = u[2] * v[0] - u[0] * v[2];
          const nz = u[0] * v[1] - u[1] * v[0];
          const nl = Math.hypot(nx, ny, nz) || 1;
          const inten = 0.22 + 0.78 * Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / (nl * Ll));
          tris.push({
            pts: rv.map(([x, y, z]) => project(x, y, z)),
            depth,
            cy,
            inten,
          });
        }
        tris.sort((a, b) => a.depth - b.depth);
        for (let i = tris.length - 1; i >= 0; i--) {
          const tr = tris[i];
          const printed = tr.cy <= printY + 0.001;
          ctx.beginPath();
          ctx.moveTo(tr.pts[0][0], tr.pts[0][1]);
          ctx.lineTo(tr.pts[1][0], tr.pts[1][1]);
          ctx.lineTo(tr.pts[2][0], tr.pts[2][1]);
          ctx.closePath();
          if (printed) {
            ctx.fillStyle = `rgb(${Math.min(255, cr * tr.inten) | 0},${Math.min(255, cg * tr.inten) | 0},${Math.min(255, cb * tr.inten) | 0})`;
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          } else {
            ctx.strokeStyle = rgba(color, 0.22);
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }

        // --- сканирующий луч и каретка при печати ---
        const gy = isPrinting ? Math.min(FRAME_H - 8, 8 + printY) : FRAME_H - 8;
        if (isPrinting && prog < 100) {
          const y = printY;
          const x0 = -m.dims.x / 2;
          const x1 = m.dims.x / 2;
          const z0 = -m.dims.z / 2;
          const z1 = m.dims.z / 2;
          ctx.save();
          ctx.strokeStyle = "rgba(57,255,20,0.95)";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "rgba(57,255,20,0.9)";
          ctx.shadowBlur = 10;
          const ring: Array<[number, number, number]> = [
            [x0, y, z0],
            [x1, y, z0],
            [x1, y, z1],
            [x0, y, z1],
            [x0, y, z0],
          ];
          ctx.beginPath();
          ring.forEach((pt, i) => {
            const pr = project(pt[0], pt[1], pt[2]);
            if (i === 0) ctx.moveTo(pr[0], pr[1]);
            else ctx.lineTo(pr[0], pr[1]);
          });
          ctx.stroke();
          ctx.restore();
        }
        // gantry bar + nozzle
        edge([-BED_HALF - 8, gy, 0], [BED_HALF + 8, gy, 0], "rgba(0,229,255,0.9)", 3);
        const n1 = project(-7, gy, 0);
        const n2 = project(7, gy, 0);
        const n3 = project(0, gy - 10, 0);
        ctx.beginPath();
        ctx.moveTo(n1[0], n1[1]);
        ctx.lineTo(n2[0], n2[1]);
        ctx.lineTo(n3[0], n3[1]);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,229,255,0.95)";
        ctx.fill();
      }
    };

    let raf = 0;
    const loop = () => {
      if (!dragRef.current.active) rotRef.current += 0.004;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const totalLayers = estimate?.totalLayers ?? 0;
  const currentLayer = Math.round((progress / 100) * totalLayers);

  return (
    <section className="voxel-panel flex min-h-[380px] flex-col overflow-hidden lg:min-h-[460px]">
      <div className="flex items-center justify-between border-b border-[#283140] px-4 py-2">
        <h3 className="text-[11px] font-bold tracking-[0.2em] text-[#39ff14]">
          {"// 3D-VIEWPORT // ПРЯМОУГОЛЬНАЯ ИЗОМЕТРИЯ"}
        </h3>
        <span
          className={cn(
            "text-[10px] font-bold tracking-widest",
            printing ? "animate-pulse-glow text-[#39ff14]" : "text-[#00e5ff]"
          )}
        >
          {printing ? "● ПЕЧАТЬ ИДЁТ" : "○ ПРЕДПРОСМОТР"}
        </span>
      </div>

      <div ref={boxRef} className="relative h-[380px] flex-1 lg:h-[460px]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            dragRef.current = { active: true, x: e.clientX };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragRef.current.active) {
              rotRef.current += (e.clientX - dragRef.current.x) * 0.012;
              dragRef.current.x = e.clientX;
            }
          }}
          onPointerUp={() => {
            dragRef.current.active = false;
          }}
        />
        <div className="crt-scanlines absolute inset-0" />

        {/* HUD */}
        <div className="pointer-events-none absolute left-3 top-3 space-y-1 text-[10px] tracking-wider">
          {model ? (
            <>
              <div className="font-bold text-[#e6edf3]">{model.name}</div>
              <div className="text-[#8b96a5]">ГАБАРИТЫ: {model.dimsText}</div>
              <div className="text-[#8b96a5]">
                ТРЕУГОЛЬНИКОВ: <span className="font-mono-tech text-[#00e5ff]">{model.triangleCount}</span>
              </div>
              <div className="text-[#8b96a5]">
                ОБЪЁМ: <span className="font-mono-tech text-[#00e5ff]">{model.volumeCm3} см³</span>
              </div>
            </>
          ) : (
            <div className="text-[#ff3b30]">НЕТ МОДЕЛИ — ВЫБЕРИТЕ ПРЕСЕТ</div>
          )}
        </div>

        <div className="pointer-events-none absolute right-3 top-3 space-y-1 text-right text-[10px] tracking-wider">
          {estimate && (
            <>
              <div className="text-[#8b96a5]">
                СЛОЙ: <span className="font-mono-tech text-[#39ff14]">{currentLayer}/{totalLayers}</span> ({estimate.layerHeightMm} мм)
              </div>
              <div className="text-[#8b96a5]">
                СОПЛО: <span className="font-mono-tech text-[#ffb000]">{estimate.material.nozzleTemp}°C</span> / СТОЛ:{" "}
                <span className="font-mono-tech text-[#ffb000]">{estimate.material.bedTemp}°C</span>
              </div>
            </>
          )}
          <div className="pt-1">
            <div className="mb-1 flex justify-between text-[9px] tracking-widest text-[#8b96a5]">
              <span>ПРОГРЕСС</span>
              <span className="font-mono-tech text-[#39ff14]">{Math.round(progress)}%</span>
            </div>
            <div className="voxel-inset h-2 w-36">
              <div
                className="h-full bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.7)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 text-[9px] tracking-widest text-[#5b6675]">
          [DRAG] — ВРАЩЕНИЕ МОДЕЛИ
        </div>
        <div
          className={cn(
            "pointer-events-none absolute bottom-3 right-3 text-[9px] font-bold tracking-widest",
            printing ? "animate-pulse-glow text-[#39ff14]" : "text-[#5b6675]"
          )}
        >
          {printing ? "ЭКСТРУЗИЯ АКТИВНА" : "ГОТОВ К ПЕЧАТИ"}
        </div>
      </div>
    </section>
  );
}
