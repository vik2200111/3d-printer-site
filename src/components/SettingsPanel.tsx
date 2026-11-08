import {
  FILAMENT_COLORS,
  FILAMENT_MATERIALS,
  type FilamentMaterial,
} from "@/lib/slicer-math";
import { soundEngine } from "@/lib/sound-engine";
import { cn } from "@/utils/cn";

interface Props {
  smoothing: number;
  onSmoothingChange: (v: number) => void;
  infill: number;
  onInfillChange: (v: number) => void;
  materialId: FilamentMaterial["id"];
  onMaterialChange: (id: FilamentMaterial["id"]) => void;
  colorId: string;
  onColorChange: (id: string) => void;
}

export default function SettingsPanel({
  smoothing,
  onSmoothingChange,
  infill,
  onInfillChange,
  materialId,
  onMaterialChange,
  colorId,
  onColorChange,
}: Props) {
  return (
    <section className="voxel-panel p-4">
      <h3 className="mb-4 text-[11px] font-bold tracking-[0.2em] text-[#39ff14]">
        {"// ПАРАМЕТРЫ СЛАЙСЕРА"}
      </h3>

      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[10px] tracking-widest">
            <span className="text-[#8b96a5]">СГЛАЖИВАНИЕ ПОВЕРХНОСТИ</span>
            <span className="font-mono-tech text-[#00e5ff]">{smoothing}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={smoothing}
            onChange={(e) => {
              const v = Number(e.target.value);
              onSmoothingChange(v);
              soundEngine.playSliderTick(v);
            }}
            className="cyber-slider cyber-slider-cyan"
          />
          <div className="mt-1 flex justify-between text-[9px] text-[#5b6675]">
            <span>ГРАНЁНАЯ</span>
            <span>ULTRA-SMOOTH</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[10px] tracking-widest">
            <span className="text-[#8b96a5]">ЗАПОЛНЕНИЕ (INFILL)</span>
            <span className="font-mono-tech text-[#39ff14]">{infill}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={infill}
            onChange={(e) => {
              const v = Number(e.target.value);
              onInfillChange(v);
              soundEngine.playSliderTick(v);
            }}
            className="cyber-slider"
          />
          <div className="mt-1 flex justify-between text-[9px] text-[#5b6675]">
            <span>10% ЛЁГКАЯ</span>
            <span>100% МОНОЛИТ</span>
          </div>
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-[11px] font-bold tracking-[0.2em] text-[#39ff14]">
        {"// МАТЕРИАЛ ФИЛАМЕНТА"}
      </h3>
      <div className="space-y-1.5">
        {FILAMENT_MATERIALS.map((m) => {
          const isSelected = m.id === materialId;
          return (
            <button
              key={m.id}
              onClick={() => {
                onMaterialChange(m.id);
                soundEngine.playClick();
              }}
              className={cn(
                "voxel-btn w-full border p-2 text-left",
                isSelected
                  ? "border-[#39ff14] bg-[#39ff14]/10"
                  : "border-[#283140] bg-[#0e1218] hover:border-[#00e5ff]/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-[11px] font-bold", isSelected ? "text-[#39ff14]" : "text-[#e6edf3]")}>
                  {m.name}
                </span>
                <span className="font-mono-tech text-[10px] text-[#ffb000]">
                  {m.pricePerGramRub.toFixed(1)} ₽/г
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[9px] tracking-wider text-[#5b6675]">
                <span>{m.tag}</span>
                <span className="font-mono-tech">
                  {m.nozzleTemp}°C / стол {m.bedTemp}°C
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <h3 className="mb-2 mt-6 text-[11px] font-bold tracking-[0.2em] text-[#39ff14]">
        {"// ЦВЕТ ПЛАСТИКА"}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {FILAMENT_COLORS.map((c) => {
          const isSelected = c.id === colorId;
          return (
            <button
              key={c.id}
              onClick={() => {
                onColorChange(c.id);
                soundEngine.playClick();
              }}
              title={c.name}
              className={cn(
                "voxel-btn flex items-center gap-2 border p-2",
                isSelected ? "border-[#e6edf3] bg-[#1a2029]" : "border-[#283140] bg-[#0e1218]"
              )}
            >
              <span
                className="inline-block h-4 w-4 shrink-0 border border-black/60"
                style={{ backgroundColor: c.hex, boxShadow: `0 0 8px ${c.hex}88` }}
              />
              <span className="truncate text-[9px] font-bold tracking-wider text-[#8b96a5]">
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
