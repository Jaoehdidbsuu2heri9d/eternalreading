import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Marca do Eternal. */
export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn("group inline-flex items-center gap-2", className)}
      aria-label="Eternal — página inicial"
    >
      <span className="gradient-eternal flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground shadow-glow">
        E
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-gradient-eternal">
        Eternal
      </span>
    </Link>
  );
}
