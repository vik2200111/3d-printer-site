import { useRef, useState } from "react";
import { PRESET_MODELS, type ProcessedModel } from "@/lib/mesh";
import { cn } from "@/utils/cn";

interface Props {
  model: ProcessedModel;
  onSelectPreset: (id: string) => void;
  onFile: (f: File) => void;
  isLoadingFile: boolean;
}

export default function PresetLibrary({ model, onSelectPreset, onFile, isLoadingFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <section className="voxel-panel p-4">
      <h3 className="mb-3 text-[11px] font-bold tracking-[0.2em] text-[#39ff14]">
      {"// ТЕСТОВЫЕ 3D-МОДЕЛИ И БЫСТРАЯ ЗАГРУЗКА"}
      </h3>
      <p className="mb-3 text-[10px] tracking-wider text-[#5b6675]">
        Выберите готовый образец или загрузите свой .STL / .OBJ
      </p>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PRESET_MODELS.map((preset) => {
          const isSelected = model.id === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              className={cn(
                "voxel-btn border p-2.5 text-left",
                isSelected
                  ? "voxel-panel-accent border-[#39ff14]"
                  : "border-[#283140] bg-[#0e1218] hover:border-[#00e5ff]/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[9px] font-bold tracking-widest",
                    isSelected ? "text-[#39ff14]" : "text-[#00e5ff]"
                  )}
                >
                  {preset.tag}
                </span>
                {isSelected && <span className="text-[9px] text-[#39ff14]">● SEL</span>}
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-[#e6edf3]">{preset.label}</div>
              <div className="mt-0.5 truncate text-[9px] text-[#5b6675]">{preset.name}</div>
            </button>
          );
        })}
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "voxel-btn mt-2 flex cursor-pointer items-center justify-center gap-3 border-2 border-dashed p-4 text-center",
          dragOver
            ? "border-[#39ff14] bg-[#39ff14]/10"
            : "border-[#2b3545] bg-[#0e1218] hover:border-[#39ff14]/60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".stl,.obj"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {isLoadingFile ? (
          <span className="text-[11px] font-bold tracking-widest text-[#00e5ff]">
            СКАНИРОВАНИЕ МЕШа...<span className="animate-blink">▮</span>
          </span>
        ) : (
          <>
            <span className="text-lg text-[#39ff14]">⇪</span>
            <span className="text-[11px] font-bold tracking-widest text-[#8b96a5]">
              ЗАГРУЗИТЬ .STL / .OBJ — КЛИК ИЛИ ПЕРЕТАЩИТЕ ФАЙЛ
            </span>
          </>
        )}
      </div>
    </section>
  );
}
