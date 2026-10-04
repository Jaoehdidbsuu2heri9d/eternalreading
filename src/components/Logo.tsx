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
      <img src={logoAsset.url} alt="" className="h-12 w-10 shrink-0 object-contain" />
      <span className="font-display text-lg font-semibold tracking-tight text-gradient-eternal">
        Eternal
      </span>
    </Link>
  );
}
