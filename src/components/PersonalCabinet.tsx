import {
  FILAMENT_COLORS,
  FILAMENT_MATERIALS,
  ORDER_STAGES,
  getOrderStageMeta,
} from "@/lib/slicer-math";
import type { AuthUser, Order, OrderAction } from "@/lib/store";
import { cn } from "@/utils/cn";

interface Props {
  user: AuthUser | null;
  orders: Order[];
  onAction: (orderId: number, action: OrderAction) => void;
  onDelete: (orderId: number) => void;
  onManualTick: () => void;
  isTicking: boolean;
  onLoginClick: () => void;
  onGoToWorkshop: () => void;
}

const badgeStyles: Record<string, string> = {
  cyan: "border-[#00e5ff] text-[#00e5ff]",
  amber: "border-[#ffb000] text-[#ffb000]",
  lime: "border-[#39ff14] text-[#39ff14]",
  emerald: "border-[#2bd576] text-[#2bd576]",
};

function OrderCard({
  order,
  onAction,
  onDelete,
}: {
  order: Order;
  onAction: (orderId: number, action: OrderAction) => void;
  onDelete: (orderId: number) => void;
}) {
  const stage = getOrderStageMeta(order.status);
  const material = FILAMENT_MATERIALS.find((m) => m.id === order.material);
  const color = FILAMENT_COLORS.find((c) => c.id === order.colorId);
  const created = new Date(order.createdAt).toLocaleString("ru-RU");

  return (
    <article className="voxel-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono-tech text-sm font-extrabold text-[#00e5ff]">{order.orderCode}</span>
          <span
            className={cn(
              "border px-2 py-0.5 text-[9px] font-bold tracking-widest",
              badgeStyles[stage.badgeColor]
            )}
          >
            {stage.shortLabel}
          </span>
          {order.status === "PRINTING" && (
            <span className="animate-pulse-glow text-[10px] font-bold tracking-widest text-[#39ff14]">
              ● {order.printerNode}
            </span>
          )}
          {order.status !== "PRINTING" && (
            <span className="text-[10px] tracking-widest text-[#5b6675]">{order.printerNode}</span>
          )}
        </div>
        <span className="text-[10px] tracking-wider text-[#5b6675]">{created}</span>
      </div>

      <div className="mt-3 grid gap-1 text-[11px] sm:grid-cols-2">
        <div>
          <span className="text-[#5b6675]">МОДЕЛЬ: </span>
          <span className="font-bold text-[#e6edf3]">{order.modelName}</span>
          <span className="text-[#5b6675]"> {order.fileFormat}</span>
        </div>
        <div>
          <span className="text-[#5b6675]">ГАБАРИТЫ: </span>
          <span className="font-mono-tech text-[#e6edf3]">{order.dimensionsMm}</span>
        </div>
        <div>
          <span className="text-[#5b6675]">ОБЪЁМ: </span>
          <span className="font-mono-tech text-[#e6edf3]">{order.volumeCm3} см³</span>
          <span className="text-[#5b6675]"> // ЗАПОЛНЕНИЕ {order.infillPercent}% // СГЛАЖИВАНИЕ {order.smoothingPercent}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#5b6675]">МАТЕРИАЛ: </span>
          <span className="text-[#e6edf3]">{material?.name ?? order.material}</span>
          <span
            className="inline-block h-3 w-3 border border-black/60"
            style={{ backgroundColor: color?.hex ?? "#39ff14" }}
            title={color?.name}
          />
          <span className="text-[#8b96a5]">{color?.name}</span>
        </div>
        <div>
          <span className="text-[#5b6675]">СТОИМОСТЬ: </span>
          <span className="font-mono-tech font-extrabold text-[#39ff14]">{order.totalPriceRub} ₽</span>
        </div>
      </div>

      {/* stage stepper */}
      <div className="mt-4 flex items-center">
        {ORDER_STAGES.map((st, i) => {
          const active = st.step <= stage.step;
          return (
            <div key={st.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center border text-[9px] font-bold",
                    active
                      ? st.key === order.status
                        ? "border-[#39ff14] bg-[#39ff14] text-[#080a0d]"
                        : "border-[#2bd576] text-[#2bd576]"
                      : "border-[#283140] text-[#5b6675]"
                  )}
                  title={st.description}
                >
                  {st.step}
                </span>
                <span
                  className={cn(
                    "hidden text-[8px] font-bold tracking-widest md:block",
                    active ? "text-[#e6edf3]" : "text-[#5b6675]"
                  )}
                >
                  {st.shortLabel}
                </span>
              </div>
              {i < ORDER_STAGES.length - 1 && (
                <div className={cn("mx-1 mb-4 h-px flex-1", active && st.step < stage.step ? "bg-[#2bd576]" : "bg-[#283140]")} />
              )}
            </div>
          );
        })}
      </div>

      {order.status === "PRINTING" && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[9px] tracking-widest text-[#8b96a5]">
            <span>ПРОГРЕСС ПЕЧАТИ</span>
            <span className="font-mono-tech text-[#39ff14]">{order.progress}%</span>
          </div>
          <div className="voxel-inset h-2.5">
            <div
              className="h-full bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.7)] transition-all duration-500"
              style={{ width: `${order.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {order.status === "MODEL_SELECTED" && (
          <button
            onClick={() => onAction(order.id, "SEND_TO_PAYMENT")}
            className="voxel-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest"
          >
            ОТПРАВИТЬ НА ОПЛАТУ
          </button>
        )}
        {order.status === "AWAITING_PAYMENT" && (
          <button
            onClick={() => onAction(order.id, "PAY_ORDER")}
            className="voxel-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest"
          >
            ОПЛАТИТЬ {order.totalPriceRub} ₽
          </button>
        )}
        {order.status === "QUEUED_PRINTER" && (
          <button
            onClick={() => onAction(order.id, "START_PRINTING")}
            className="voxel-btn-primary px-3 py-2 text-[10px] font-bold tracking-widest"
          >
            ЗАПУСТИТЬ ПЕЧАТЬ
          </button>
        )}
        {order.status === "PRINTING" && (
          <button
            onClick={() => onAction(order.id, "COMPLETE_NOW")}
            className="voxel-btn border border-[#ffb000] bg-[#ffb000]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#ffb000] hover:bg-[#ffb000]/20"
          >
            ЗАВЕРШИТЬ СЕЙЧАС
          </button>
        )}
        {order.status !== "COMPLETED" && (
          <button
            onClick={() => onDelete(order.id)}
            className="voxel-btn border border-[#283140] bg-[#13171e] px-3 py-2 text-[10px] font-bold tracking-widest text-[#ff3b30] hover:bg-[#ff3b30]/10"
          >
            УДАЛИТЬ
          </button>
        )}
        {order.status === "COMPLETED" && (
          <span className="px-3 py-2 text-[10px] font-bold tracking-widest text-[#2bd576]">
            ✓ ГОТОВО — МОДЕЛЬ СНЯТА СО СТОЛА
          </span>
        )}
      </div>
    </article>
  );
}

export default function PersonalCabinet({
  user,
  orders,
  onAction,
  onDelete,
  onManualTick,
  isTicking,
  onLoginClick,
  onGoToWorkshop,
}: Props) {
  const activeCount = orders.filter(
    (o) => o.status === "PRINTING" || o.status === "QUEUED_PRINTER"
  ).length;

  if (!user) {
    return (
      <section className="voxel-panel flex flex-col items-center gap-4 p-10 text-center">
        <h2 className="text-sm font-bold tracking-[0.2em] text-[#e6edf3]">
          ЛИЧНЫЙ КАБИНЕТ — ТРЕБУЕТСЯ АВТОРИЗАЦИЯ
        </h2>
        <p className="max-w-md text-[11px] leading-relaxed tracking-wider text-[#8b96a5]">
          Войдите или зарегистрируйте оператора, чтобы сохранять заказы и следить за печатью.
          В демо-режиме данные хранятся локально в вашем браузере (localStorage).
        </p>
        <div className="flex gap-2">
          <button onClick={onLoginClick} className="voxel-btn-primary px-5 py-2.5 text-[11px] font-bold tracking-widest">
            ВОЙТИ / РЕГИСТРАЦИЯ
          </button>
          <button
            onClick={onGoToWorkshop}
            className="voxel-btn border border-[#00e5ff] bg-[#00e5ff]/10 px-5 py-2.5 text-[11px] font-bold tracking-widest text-[#00e5ff]"
          >
            В МАСТЕРСКУЮ
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="voxel-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-bold tracking-[0.2em] text-[#e6edf3]">
            ЗАКАЗЫ ОПЕРАТОРА <span className="text-[#00e5ff]">{user.username.toUpperCase()}</span>
          </h2>
          <p className="mt-1 text-[10px] tracking-wider text-[#5b6675]">
            ВСЕГО: {orders.length} // АКТИВНЫХ ПЕЧАТЕЙ:{" "}
            <span className={cn("font-bold", activeCount > 0 && "animate-pulse-glow text-[#39ff14]")}>
              {activeCount}
            </span>{" "}
            // АВТО-ТИК КАЖДЫЕ 3.5с
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onManualTick}
            disabled={isTicking || activeCount === 0}
            className="voxel-btn border border-[#ffb000] bg-[#ffb000]/10 px-4 py-2 text-[10px] font-bold tracking-widest text-[#ffb000] hover:bg-[#ffb000]/20 disabled:opacity-40"
          >
            ⚡ TICK ПРИНТЕРА (УСКОРИТЬ)
          </button>
          <button
            onClick={onGoToWorkshop}
            className="voxel-btn-primary px-4 py-2 text-[10px] font-bold tracking-widest"
          >
            + НОВЫЙ ЗАКАЗ
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="voxel-panel p-10 text-center">
          <p className="text-[12px] font-bold tracking-widest text-[#8b96a5]">
            ЗАКАЗОВ НЕТ — ЗАГРУЗИТЕ МОДЕЛЬ В МАСТЕРСКОЙ
          </p>
          <button
            onClick={onGoToWorkshop}
            className="voxel-btn-primary mt-4 px-5 py-2.5 text-[11px] font-bold tracking-widest"
          >
            В МАСТЕРСКУЮ
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onAction={onAction} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}
