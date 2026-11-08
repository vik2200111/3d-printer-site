import { useState } from "react";
import { loginUser, registerUser, type AuthUser } from "@/lib/store";
import { soundEngine } from "@/lib/sound-engine";
import { cn } from "@/utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
  pendingOrderSummary: { modelName: string; totalPriceRub: number } | null;
}

export default function AuthModal({ open, onClose, onAuthenticated, pendingOrderSummary }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = () => {
    setBusy(true);
    setError(null);
    setTimeout(() => {
      const res =
        mode === "login" ? loginUser(username, password) : registerUser(username, password);
      setBusy(false);
      if (res.ok) {
        soundEngine.playSuccess();
        onAuthenticated(res.user);
        setUsername("");
        setPassword("");
        setError(null);
      } else {
        soundEngine.playError();
        setError(res.error);
      }
    }, 250);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="voxel-panel-accent w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-[0.2em] text-[#39ff14]">
            {mode === "login" ? "// ВХОД ОПЕРАТОРА" : "// РЕГИСТРАЦИЯ ОПЕРАТОРА"}
          </h2>
          <button
            onClick={onClose}
            className="voxel-btn border border-[#283140] bg-[#13171e] px-2 py-1 text-[10px] font-bold text-[#ff3b30]"
          >
            ✕
          </button>
        </div>

        {pendingOrderSummary && (
          <div className="mb-4 border border-[#ffb000]/50 bg-[#ffb000]/10 p-2.5 text-[10px] tracking-wider text-[#ffb000]">
            ПОСЛЕ ВХОДА БУДЕТ ОФОРМЛЕН ЗАКАЗ: {pendingOrderSummary.modelName} —{" "}
            <span className="font-mono-tech font-bold">{pendingOrderSummary.totalPriceRub} ₽</span>
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={cn(
              "voxel-btn flex-1 border px-3 py-2 text-[10px] font-bold tracking-widest",
              mode === "login"
                ? "border-[#39ff14] bg-[#39ff14]/10 text-[#39ff14]"
                : "border-[#283140] bg-[#13171e] text-[#8b96a5]"
            )}
          >
            ВХОД
          </button>
          <button
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={cn(
              "voxel-btn flex-1 border px-3 py-2 text-[10px] font-bold tracking-widest",
              mode === "register"
                ? "border-[#39ff14] bg-[#39ff14]/10 text-[#39ff14]"
                : "border-[#283140] bg-[#13171e] text-[#8b96a5]"
            )}
          >
            РЕГИСТРАЦИЯ
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] tracking-widest text-[#8b96a5]">
              ИМЯ ОПЕРАТОРА
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="voxel-inset w-full px-3 py-2.5 text-[12px] tracking-wider text-[#e6edf3] outline-none focus:border-[#39ff14]"
              placeholder="например: operator_7"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] tracking-widest text-[#8b96a5]">ПАРОЛЬ</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="voxel-inset w-full px-3 py-2.5 text-[12px] tracking-wider text-[#e6edf3] outline-none focus:border-[#39ff14]"
              placeholder="••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div className="border border-[#ff3b30]/60 bg-[#ff3b30]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#ff3b30]">
              ⚠ {error}
            </div>
          )}

          <button
            disabled={busy}
            onClick={submit}
            className="voxel-btn-primary w-full px-4 py-3 text-[12px] font-extrabold tracking-[0.15em] disabled:opacity-50"
          >
            {busy ? "ПРОВЕРКА..." : mode === "login" ? "ВОЙТИ В ТЕРМИНАЛ" : "СОЗДАТЬ АККАУНТ"}
          </button>

          <p className="text-center text-[9px] leading-relaxed tracking-wider text-[#5b6675]">
            ДЕМО-РЕЖИМ: учётные записи хранятся в localStorage браузера,
            <br />
            без сервера и базы данных — идеально для статического хостинга.
          </p>
        </div>
      </div>
    </div>
  );
}
