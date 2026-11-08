import { useCallback, useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import CostPanel from "@/components/CostPanel";
import PersonalCabinet from "@/components/PersonalCabinet";
import PresetLibrary from "@/components/PresetLibrary";
import SettingsPanel from "@/components/SettingsPanel";
import TerminalFooter from "@/components/TerminalFooter";
import TerminalHeader from "@/components/TerminalHeader";
import Viewport3D from "@/components/Viewport3D";
import { createPresetModel, parseUploaded3DFile, type ProcessedModel } from "@/lib/mesh";
import { soundEngine } from "@/lib/sound-engine";
import {
  FILAMENT_COLORS,
  calculatePrintEstimate,
  type FilamentMaterial,
} from "@/lib/slicer-math";
import {
  applyOrderAction,
  createOrder,
  deleteOrder,
  getOrders,
  getSession,
  logoutUser,
  tickPrinter,
  type AuthUser,
  type Order,
  type OrderAction,
} from "@/lib/store";
import { cn } from "@/utils/cn";

type Tab = "workshop" | "cabinet";
type OrderMode = "AWAITING_PAYMENT" | "MODEL_SELECTED";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("workshop");
  const [model, setModel] = useState<ProcessedModel>(() => createPresetModel("cyber-turbine"));
  const [smoothing, setSmoothing] = useState(35);
  const [infill, setInfill] = useState(30);
  const [materialId, setMaterialId] = useState<FilamentMaterial["id"]>("PLA+");
  const [colorId, setColorId] = useState("phosphor");
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const [soundMuted, setSoundMuted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingOrderMode, setPendingOrderMode] = useState<OrderMode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTicking, setIsTicking] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  // Восстановление сессии и заказов из localStorage при загрузке
  useEffect(() => {
    setSoundMuted(soundEngine.isMuted());
    const session = getSession();
    if (session) {
      setUser(session);
      setOrders(getOrders(session.username));
    }
  }, []);

  // Живая телеметрия: авто-тик принтера, пока есть активные печати
  const hasActivePrintJobs = useMemo(
    () => orders.some((o) => o.status === "QUEUED_PRINTER" || o.status === "PRINTING"),
    [orders]
  );
  useEffect(() => {
    if (!user || !hasActivePrintJobs) return;
    const interval = setInterval(() => {
      setOrders(tickPrinter(user.username));
    }, 3500);
    return () => clearInterval(interval);
  }, [user, hasActivePrintJobs]);

  const estimate = useMemo(
    () =>
      calculatePrintEstimate({
        volumeCm3: model.volumeCm3,
        smoothingPercent: smoothing,
        infillPercent: infill,
        materialId,
        heightMm: model.dims.y,
      }),
    [model, smoothing, infill, materialId]
  );

  const selectedColorHex = useMemo(
    () => FILAMENT_COLORS.find((c) => c.id === colorId)?.hex ?? FILAMENT_COLORS[0].hex,
    [colorId]
  );

  const printingOrder = useMemo(() => orders.find((o) => o.status === "PRINTING"), [orders]);
  const viewportProgress = printingOrder ? printingOrder.progress : 100;

  const handleToggleSound = () => {
    const next = !soundMuted;
    soundEngine.setMuted(next);
    setSoundMuted(next);
  };

  const handleSelectPreset = (presetId: string) => {
    soundEngine.playModelScan();
    const next = createPresetModel(presetId);
    setModel(next);
    showToast("success", `Загружена модель ${next.name}`);
  };

  const handleFile = async (file: File) => {
    setIsLoadingFile(true);
    try {
      const processed = await parseUploaded3DFile(file);
      soundEngine.playModelScan();
      setModel(processed);
      showToast(
        "success",
        `Модель ${processed.name} загружена (${processed.volumeCm3} см³)`
      );
    } catch (err) {
      soundEngine.playError();
      showToast(
        "error",
        err instanceof Error ? err.message : "Не удалось прочитать 3D-файл. Используйте .STL или .OBJ"
      );
    } finally {
      setIsLoadingFile(false);
    }
  };

  const submitOrder = (mode: OrderMode) => {
    if (!user) return;
    setIsSubmitting(true);
    // имитация задержки терминала
    setTimeout(() => {
      const order = createOrder(user.username, {
        modelName: model.name,
        fileFormat: model.format,
        dimensionsMm: model.dimsText,
        volumeCm3: model.volumeCm3,
        heightMm: model.dims.y,
        smoothingPercent: smoothing,
        infillPercent: infill,
        material: materialId,
        colorId,
        initialStatus: mode,
        totalPriceRub: estimate.totalPriceRub,
      });
      setOrders((prev) => [order, ...prev]);
      setIsSubmitting(false);
      soundEngine.playSuccess();
      setActiveTab("cabinet");
      showToast(
        "success",
        mode === "AWAITING_PAYMENT"
          ? `Заказ ${order.orderCode} создан и отправлен на оплату!`
          : `Модель ${order.modelName} сохранена в личном кабинете.`
      );
    }, 350);
  };

  const handleRequestOrder = (mode: OrderMode) => {
    if (!user) {
      setPendingOrderMode(mode);
      setAuthModalOpen(true);
      return;
    }
    submitOrder(mode);
  };

  const handleAuthenticated = (authedUser: AuthUser) => {
    setUser(authedUser);
    setAuthModalOpen(false);
    setOrders(getOrders(authedUser.username));
    if (pendingOrderMode) {
      const mode = pendingOrderMode;
      setPendingOrderMode(null);
      // дождаться setUser — используем напрямую createOrder
      setIsSubmitting(true);
      setTimeout(() => {
        const order = createOrder(authedUser.username, {
          modelName: model.name,
          fileFormat: model.format,
          dimensionsMm: model.dimsText,
          volumeCm3: model.volumeCm3,
          heightMm: model.dims.y,
          smoothingPercent: smoothing,
          infillPercent: infill,
          material: materialId,
          colorId,
          initialStatus: mode,
          totalPriceRub: estimate.totalPriceRub,
        });
        setOrders((prev) => [order, ...prev]);
        setIsSubmitting(false);
        soundEngine.playSuccess();
        setActiveTab("cabinet");
        showToast("success", `Заказ ${order.orderCode} оформлен после авторизации!`);
      }, 350);
    } else {
      setActiveTab("cabinet");
      showToast("success", `Добро пожаловать в терминал, ${authedUser.username}!`);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setOrders([]);
    setActiveTab("workshop");
    soundEngine.playToggle(false);
    showToast("success", "Сеанс оператора завершён.");
  };

  const handleOrderAction = (orderId: number, action: OrderAction) => {
    if (!user) return;
    const updated = applyOrderAction(user.username, orderId, action);
    if (!updated) return;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    if (action === "PAY_ORDER") {
      soundEngine.playSuccess();
      showToast("success", `Оплата подтверждена! Модель передана на 3D-принтер ${updated.printerNode}.`);
    } else if (action === "COMPLETE_NOW") {
      soundEngine.playSuccess();
      showToast("success", `Печать модели ${updated.modelName} завершена!`);
    } else if (action === "START_PRINTING") {
      soundEngine.playSuccess();
      showToast("success", `Печать ${updated.orderCode} запущена на ${updated.printerNode}.`);
    } else {
      soundEngine.playClick();
      showToast("success", `Заказ ${updated.orderCode} отправлен на оплату.`);
    }
  };

  const handleDeleteOrder = (orderId: number) => {
    if (!user) return;
    deleteOrder(user.username, orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    soundEngine.playClick();
    showToast("success", "Заказ удалён из списка.");
  };

  const handleManualTick = () => {
    if (!user) return;
    setIsTicking(true);
    setTimeout(() => {
      setOrders(tickPrinter(user.username, true));
      setIsTicking(false);
      soundEngine.playSuccess();
    }, 300);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TerminalHeader
        activeTab={activeTab}
        onTab={setActiveTab}
        user={user}
        onLoginClick={() => {
          setPendingOrderMode(null);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        soundMuted={soundMuted}
        onToggleSound={handleToggleSound}
      />

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "animate-toast-in fixed right-4 top-16 z-50 max-w-sm border px-4 py-3 text-[11px] font-bold tracking-wider shadow-lg",
            toast.type === "success"
              ? "border-[#39ff14] bg-[#0b0d10] text-[#39ff14] shadow-[0_0_20px_rgba(57,255,20,0.25)]"
              : "border-[#ff3b30] bg-[#0b0d10] text-[#ff3b30] shadow-[0_0_20px_rgba(255,59,48,0.25)]"
          )}
        >
          {toast.type === "success" ? "✓ " : "✕ "}
          {toast.message}
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] flex-1 p-4">
        {activeTab === "workshop" ? (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* LEFT: viewport + presets */}
            <div className="space-y-4 lg:col-span-7">
              <Viewport3D
                model={model}
                colorHex={selectedColorHex}
                smoothing={smoothing}
                progress={viewportProgress}
                printing={!!printingOrder}
                estimate={estimate}
              />
              <PresetLibrary
                model={model}
                onSelectPreset={handleSelectPreset}
                onFile={handleFile}
                isLoadingFile={isLoadingFile}
              />
            </div>

            {/* RIGHT: settings + cost */}
            <div className="space-y-4 lg:col-span-5">
              <SettingsPanel
                smoothing={smoothing}
                onSmoothingChange={setSmoothing}
                infill={infill}
                onInfillChange={setInfill}
                materialId={materialId}
                onMaterialChange={setMaterialId}
                colorId={colorId}
                onColorChange={setColorId}
              />
              <CostPanel estimate={estimate} isSubmitting={isSubmitting} onOrder={handleRequestOrder} />
            </div>
          </div>
        ) : (
          <PersonalCabinet
            user={user}
            orders={orders}
            onAction={handleOrderAction}
            onDelete={handleDeleteOrder}
            onManualTick={handleManualTick}
            isTicking={isTicking}
            onLoginClick={() => {
              setPendingOrderMode(null);
              setAuthModalOpen(true);
            }}
            onGoToWorkshop={() => setActiveTab("workshop")}
          />
        )}
      </main>

      <TerminalFooter />

      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingOrderMode(null);
        }}
        onAuthenticated={handleAuthenticated}
        pendingOrderSummary={
          pendingOrderMode
            ? { modelName: model.name, totalPriceRub: estimate.totalPriceRub }
            : null
        }
      />
    </div>
  );
}
