import { useState } from "react";

/** Trecho oculto até o clique. */
function Spoiler({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <span className="rounded bg-secondary px-1">{children}</span>;
  return (
    <button type="button" onClick={() => setOpen(true)}
      className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-border hover:bg-secondary">
      ⚠️ Spoiler — clique para revelar
    </button>
  );
}

/** Mostra o texto do comentário. Trechos entre ||assim|| viram spoiler; o comentário inteiro pode ser spoiler. */
export function SpoilerText({ text, whole }: { text: string; whole?: boolean }) {
  const parts = text.split(/(\|\|[\s\S]+?\|\|)/g);
  const body = (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => (p.startsWith("||") && p.endsWith("||") && p.length > 4 ? <Spoiler key={i}>{p.slice(2, -2)}</Spoiler> : <span key={i}>{p}</span>))}
    </span>
  );
  return whole ? <Spoiler>{body}</Spoiler> : body;
}
