export default function TerminalFooter() {
  return (
    <footer className="border-t border-[#283140] bg-[#0b0d10]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10px] tracking-widest text-[#5b6675]">
        <span>
          СИСТЕМА ГОТОВА <span className="animate-blink text-[#39ff14]">▮</span>
        </span>
        <span className="hidden md:inline">
          РЕЖИМ: STATIC-DEMO // ДАННЫЕ ХРАНЯТСЯ В LOCALSTORAGE // СЕРВЕР НЕ ТРЕБУЕТСЯ
        </span>
        <span>
          NODE-07 <span className="text-[#39ff14]">ONLINE</span> // ПЛАТФОРМА: RENDER.COM
        </span>
      </div>
    </footer>
  );
}
