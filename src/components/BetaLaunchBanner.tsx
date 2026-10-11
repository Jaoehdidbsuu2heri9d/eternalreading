import { CalendarDays, Sparkles } from "lucide-react";

export function BetaLaunchBanner() {
  return (
    <aside
      role="region"
      aria-label="Aviso de lançamento oficial"
      className="relative z-40 w-full border-b border-violet-300/15 bg-gradient-to-r from-[#211333] via-[#291741] to-[#17203a] px-3 py-2.5 text-white sm:px-5"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5 text-center">
        <span className="hidden shrink-0 rounded-full border border-violet-200/20 bg-white/5 px-2 py-1 text-[9px] font-black tracking-[0.16em] text-violet-200 sm:inline-flex">
          BETA
        </span>
        <Sparkles className="h-4 w-4 shrink-0 text-violet-200" aria-hidden />
        <p className="text-[11px] leading-relaxed sm:text-sm">
          A Eternal está em beta! Lançamento oficial em{" "}
          <strong className="font-extrabold text-white">27 de novembro de 2026</strong>.
          <span className="hidden sm:inline"> Obrigado por ajudar a construir nossa comunidade.</span>
        </p>
        <CalendarDays className="hidden h-4 w-4 shrink-0 text-violet-200 sm:block" aria-hidden />
      </div>
    </aside>
  );
}
