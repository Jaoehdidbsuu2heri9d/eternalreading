import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Vídeo curto em loop, sem áudio. Só baixa/toca quando aparece na tela
 * e não toca sozinho para quem pediu menos movimento.
 */
export function BannerVideo({ src, className, poster }: { src: string; className?: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.removeAttribute("src");
    v.load();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        if (!v.src) v.src = src;
        v.play().catch(() => undefined);
      } else v.pause();
    }, { rootMargin: "50px" });
    io.observe(v);
    return () => { io.disconnect(); v.pause(); };
  }, [src]);
  return (
    <video ref={ref} muted loop playsInline preload="none" poster={poster} aria-hidden
      className={cn("h-full w-full object-cover", className)} />
  );
}
