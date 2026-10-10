import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/eternal-logo.jpeg.asset.json";

/** Marca do Eternal. */
export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn("group inline-flex items-center gap-2", className)}
      aria-label="Eternal — página inicial"
    >
      <span className="relative inline-block h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border sm:h-12 sm:w-12">
        <img src={logoAsset.url} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight text-gradient-eternal sm:text-lg">
        Eternal
      </span>
    </Link>
  );
}
