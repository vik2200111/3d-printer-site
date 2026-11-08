import type { PrintCalculationResult } from "@/lib/slicer-math";
import { cn } from "@/utils/cn";

interface Props {
  estimate: PrintCalculationResult;
  isSubmitting: boolean;
  onOrder: (mode: "AWAITING_PAYMENT" | "MODEL_SELECTED") => void;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-[#232a36] py-1.5 text-[11px]">
      <span className="tracking-wider text-[#8b96a5]">{label}</span>
      <span className={cn("font-mono-tech font-bold", accent ? "text-[#39ff14]" : "text-[#e6edf3]")}>
        {value}
      </span>
    </div>
  );
}

export default function CostPanel({ estimate, isSubmitting, onOrder }: Props) {
  return (
    <section className="voxel-panel-accent p-4">
      <h3 className="mb-3 text-[11px] font-bold tracking-[0.2em] text-[#39ff14]">
        {"// КАЛЬКУЛЯТОР СТОИМОСТИ (+20%)"}
      </h3>

      <div className="voxel-inset p-3">
        <Row label="Эффективный объём" value={`${estimate.effectiveVolumeCm3} см³`} />
        <Row label="Вес филамента" value={`${estimate.filamentWeightGrams} г`} />
        <Row label="Длина филамента" value={`${estimate.filamentLengthMeters} м`} />
        <Row label="Высота слоя" value={`${estimate.layerHeightMm} мм`} />
        <Row label="Слоёв всего" value={`${estimate.totalLayers}`} />
        <Row label="Время печати" value={estimate.estimatedTimeFormatted} />
        <Row label="Стоимость пластика" value={`${estimate.filamentCostRub} ₽`} />
        <Row label="Подготовка станка" value={`${estimate.machinePrepRub} ₽`} />
        <Row
          label={`Наценка сервиса +${estimate.markupPercent}%`}
          value={`${estimate.markupRub} ₽`}
          accent
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-[#e6edf3]">ИТОГО:</span>
          <span className="font-mono-tech text-xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">
            {estimate.totalPriceRub} ₽
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <button
          disabled={isSubmitting}
          onClick={() => onOrder("AWAITING_PAYMENT")}
          className="voxel-btn-primary w-full px-4 py-3 text-[12px] font-extrabold tracking-[0.15em] disabled:opacity-50"
        >
          ▶ ОТПРАВИТЬ ЗАКАЗ НА ОПЛАТУ
        </button>
        <button
          disabled={isSubmitting}
          onClick={() => onOrder("MODEL_SELECTED")}
          className="voxel-btn w-full border border-[#00e5ff] bg-[#00e5ff]/10 px-4 py-2.5 text-[11px] font-bold tracking-[0.15em] text-[#00e5ff] hover:bg-[#00e5ff]/20 disabled:opacity-50"
        >
          СОХРАНИТЬ МОДЕЛЬ В КАБИНЕТЕ
        </button>
      </div>
    </section>
  );
}
