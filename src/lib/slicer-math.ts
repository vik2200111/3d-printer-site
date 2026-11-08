export interface FilamentMaterial {
  id: "PLA+" | "PETG" | "ABS" | "TPU" | "PA-CF";
  name: string;
  tag: string;
  densityGPerCm3: number;
  pricePerGramRub: number;
  nozzleTemp: number;
  bedTemp: number;
  description: string;
}

export interface FilamentColor {
  id: string;
  name: string;
  hex: string;
  emissive?: string;
}

export const FILAMENT_MATERIALS: FilamentMaterial[] = [
  {
    id: "PLA+",
    name: "PLA+ Cyber Pro",
    tag: "СТАНДАРТ // ТОЧНОСТЬ",
    densityGPerCm3: 1.24,
    pricePerGramRub: 5.2,
    nozzleTemp: 215,
    bedTemp: 60,
    description: "Идеальная геометрия, высокая жёсткость и матовая поверхность.",
  },
  {
    id: "PETG",
    name: "PETG Industrial",
    tag: "ПРОЧНОСТЬ // ВЛАГОСТОЙКОСТЬ",
    densityGPerCm3: 1.27,
    pricePerGramRub: 6.1,
    nozzleTemp: 240,
    bedTemp: 80,
    description: "Ударопрочный инженерный пластик для функциональных деталей.",
  },
  {
    id: "ABS",
    name: "ABS-X Thermo",
    tag: "ТЕРМОСТОЙКОСТЬ ДО 95°C",
    densityGPerCm3: 1.04,
    pricePerGramRub: 5.8,
    nozzleTemp: 250,
    bedTemp: 100,
    description: "Лёгкий и термостойкий корпус для механических узлов.",
  },
  {
    id: "TPU",
    name: "TPU 95A Flex",
    tag: "ГИБКИЙ ЭЛАСТОМЕР",
    densityGPerCm3: 1.21,
    pricePerGramRub: 8.2,
    nozzleTemp: 228,
    bedTemp: 50,
    description: "Гибкий износостойкий материал для демпферов и прокладок.",
  },
  {
    id: "PA-CF",
    name: "PA12-CF Carbon",
    tag: "УГЛЕВОЛОКНО // PRO",
    densityGPerCm3: 1.32,
    pricePerGramRub: 12.5,
    nozzleTemp: 285,
    bedTemp: 95,
    description: "Армированный карбоном нейлон с максимальной прочностью.",
  },
];

export const FILAMENT_COLORS: FilamentColor[] = [
  { id: "phosphor", name: "Phosphor Lime", hex: "#39FF14", emissive: "#0c2b05" },
  { id: "obsidian", name: "Obsidian Matte", hex: "#2D3440", emissive: "#050709" },
  { id: "cyber-cyan", name: "Cyber Cyan", hex: "#00E5FF", emissive: "#03262e" },
  { id: "signal-amber", name: "Signal Amber", hex: "#FFB000", emissive: "#291b00" },
  { id: "titanium", name: "Titanium White", hex: "#E2E8F0", emissive: "#11161d" },
  { id: "crimson", name: "Reactor Crimson", hex: "#FF3B30", emissive: "#2b0806" },
];

export interface PrintCalculationInput {
  volumeCm3: number;
  smoothingPercent: number; // 0 - 100
  infillPercent: number; // 10 - 100
  materialId: FilamentMaterial["id"];
  heightMm?: number;
}

export interface PrintCalculationResult {
  material: FilamentMaterial;
  layerHeightMm: number;
  effectiveVolumeCm3: number;
  filamentWeightGrams: number;
  filamentLengthMeters: number;
  filamentCostRub: number;
  machinePrepRub: number;
  basePriceRub: number;
  markupPercent: number;
  markupRub: number;
  totalPriceRub: number;
  estimatedMinutes: number;
  estimatedTimeFormatted: string;
  totalLayers: number;
}

export function calculatePrintEstimate(
  input: PrintCalculationInput
): PrintCalculationResult {
  const material =
    FILAMENT_MATERIALS.find((m) => m.id === input.materialId) ??
    FILAMENT_MATERIALS[0];

  const volumeCm3 = Math.max(0.5, input.volumeCm3);
  const smoothing = Math.min(100, Math.max(0, input.smoothingPercent));
  const infill = Math.min(100, Math.max(10, input.infillPercent));

  // Outer perimeter shell takes ~22-30% of volume depending on smoothing/wall passes
  const shellRatio = 0.22 + (smoothing / 100) * 0.08;
  const effectiveVolumeCm3 = Number(
    (volumeCm3 * (shellRatio + (1 - shellRatio) * (infill / 100))).toFixed(2)
  );

  // Weight in grams
  const filamentWeightGrams = Number(
    Math.max(1.8, effectiveVolumeCm3 * material.densityGPerCm3).toFixed(1)
  );

  // Standard 1.75mm filament cross-section = 2.405 mm^2 -> 1 cm^3 = 0.4158 m
  const filamentLengthMeters = Number((effectiveVolumeCm3 * 0.416).toFixed(1));

  // Costs in RUB
  const filamentCostRub = Math.round(
    filamentWeightGrams * material.pricePerGramRub
  );
  const machinePrepRub = 75;
  const basePriceRub = filamentCostRub + machinePrepRub;

  // +20% markup on top as requested
  const markupPercent = 20;
  const markupRub = Math.round(basePriceRub * (markupPercent / 100));
  const totalPriceRub = basePriceRub + markupRub;

  // Layer height scales inversely with smoothing (0.28mm draft -> 0.12mm ultra smooth)
  const layerHeightMm = Number((0.28 - (smoothing / 100) * 0.16).toFixed(2));
  const modelHeight = Math.max(10, input.heightMm ?? 42);
  const totalLayers = Math.max(25, Math.round(modelHeight / layerHeightMm));

  // Estimated duration in minutes
  const estimatedMinutes = Math.max(
    18,
    Math.round(effectiveVolumeCm3 * (2.3 + (smoothing / 100) * 1.8) + 15)
  );

  return {
    material,
    layerHeightMm,
    effectiveVolumeCm3,
    filamentWeightGrams,
    filamentLengthMeters,
    filamentCostRub,
    machinePrepRub,
    basePriceRub,
    markupPercent,
    markupRub,
    totalPriceRub,
    estimatedMinutes,
    estimatedTimeFormatted: formatMinutesRu(estimatedMinutes),
    totalLayers,
  };
}

export function formatMinutesRu(totalMinutes: number): string {
  const mins = Math.max(1, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m.toString().padStart(2, "0")} мин`;
}

export type OrderStatusKey =
  | "MODEL_SELECTED"
  | "AWAITING_PAYMENT"
  | "QUEUED_PRINTER"
  | "PRINTING"
  | "COMPLETED";

export interface OrderStageMeta {
  key: OrderStatusKey;
  step: number;
  label: string;
  shortLabel: string;
  description: string;
  badgeColor: "cyan" | "amber" | "lime" | "emerald";
}

export const ORDER_STAGES: OrderStageMeta[] = [
  {
    key: "MODEL_SELECTED",
    step: 1,
    label: "Модель выбрана",
    shortLabel: "ВЫБРАНА",
    description: "Геометрия проверена, G-Code профиль сформирован",
    badgeColor: "cyan",
  },
  {
    key: "AWAITING_PAYMENT",
    step: 2,
    label: "Отправлена на оплату",
    shortLabel: "К ОПЛАТЕ",
    description: "Сформирован счёт с учётом филамента + 20%",
    badgeColor: "amber",
  },
  {
    key: "QUEUED_PRINTER",
    step: 3,
    label: "В очереди на принтер",
    shortLabel: "В ОЧЕРЕДИ",
    description: "Оплата подтверждена, прогрев стола и экструдера",
    badgeColor: "cyan",
  },
  {
    key: "PRINTING",
    step: 4,
    label: "Печатается на 3D-принтере",
    shortLabel: "ПЕЧАТЬ",
    description: "Идёт послойная экструзия в реальном времени",
    badgeColor: "lime",
  },
  {
    key: "COMPLETED",
    step: 5,
    label: "Готово // Снято со стола",
    shortLabel: "ГОТОВО",
    description: "Модель полностью напечатана и прошла контроль",
    badgeColor: "emerald",
  },
];

export function getOrderStageMeta(status: string): OrderStageMeta {
  return ORDER_STAGES.find((s) => s.key === status) ?? ORDER_STAGES[1];
}
