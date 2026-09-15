import { cn } from "@/lib/utils";

type Tone = "default" | "primary" | "success" | "muted" | "eternal";

const tones: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/20 text-primary-foreground ring-1 ring-primary/40",
  success: "bg-success/15 text-success",
  muted: "bg-muted text-muted-foreground",
  eternal: "gradient-eternal text-primary-foreground",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
