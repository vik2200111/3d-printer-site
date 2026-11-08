import type { AuthUser } from "@/lib/store";
import { cn } from "@/utils/cn";

interface Props {
  activeTab: "workshop" | "cabinet";
  onTab: (t: "workshop" | "cabinet") => void;
  user: AuthUser | null;
  onLoginClick: () => void;
  onLogout: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
}

export default function TerminalHeader({
  activeTab,
  onTab,
  user,
  onLoginClick,
  onLogout,
  soundMuted,
  onToggleSound,
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#283140] bg-[#0b0d10]/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 animate-pulse-glow bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.9)]" />
          <span className="font-display text-sm font-bold tracking-widest text-[#e6edf3]">
            VOXEL<span className="text-[#39ff14]">//</span>FORGE
          </span>
          <span className="hidden text-[10px] tracking-widest text-[#5b6675] sm:inline">
            v2.4-STATIC
          </span>
        </div>

        <nav className="mx-auto flex items-center gap-1">
          <button
            onClick={() => onTab("workshop")}
            className={cn(
              "voxel-btn px-3 py-1.5 text-[11px] font-bold tracking-widest sm:px-4",
              activeTab === "workshop"
                ? "border border-[#39ff14] bg-[#39ff14]/10 text-[#39ff14]"
                : "border border-[#283140] bg-[#13171e] text-[#8b96a5] hover:text-[#e6edf3]"
            )}
          >
            [ МАСТЕРСКАЯ ]
          </button>
          <button
            onClick={() => onTab("cabinet")}
            className={cn(
              "voxel-btn px-3 py-1.5 text-[11px] font-bold tracking-widest sm:px-4",
              activeTab === "cabinet"
                ? "border border-[#39ff14] bg-[#39ff14]/10 text-[#39ff14]"
                : "border border-[#283140] bg-[#13171e] text-[#8b96a5] hover:text-[#e6edf3]"
            )}
          >
            [ ЛИЧНЫЙ КАБИНЕТ ]
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSound}
            title="Звук"
            className="voxel-btn border border-[#283140] bg-[#13171e] px-2.5 py-1.5 text-[11px] font-bold tracking-widest text-[#8b96a5] hover:text-[#00e5ff]"
          >
            {soundMuted ? "ЗВУК:OFF" : "ЗВУК:ON"}
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden border border-[#283140] bg-[#13171e] px-2.5 py-1.5 text-[11px] tracking-widest text-[#00e5ff] sm:inline">
                OP:{user.username.toUpperCase()}
              </span>
              <button
                onClick={onLogout}
                className="voxel-btn border border-[#283140] bg-[#13171e] px-2.5 py-1.5 text-[11px] font-bold tracking-widest text-[#ff3b30] hover:bg-[#ff3b30]/10"
              >
                ВЫЙТИ
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="voxel-btn-primary px-3 py-1.5 text-[11px] font-bold tracking-widest"
            >
              ВОЙТИ
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
