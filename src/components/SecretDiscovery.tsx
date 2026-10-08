import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Secret = "hidden_area" | "hidden_element" | "easter_egg";

/** Interação de descoberta; requisitos são verificados exclusivamente pelo banco. */
export function SecretDiscovery({ kind }: { kind: Secret }) {
  const qc = useQueryClient();
  const [discovered, setDiscovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const reveal = async () => {
    if (busy || discovered) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("discover_secret", { p_key: kind });
      if (!error && data) {
        setDiscovered(true);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["achievements"] }),
          qc.invalidateQueries({ queryKey: ["notifications"] }),
          qc.invalidateQueries({ queryKey: ["profile-achievements"] }),
        ]);
      }
    } finally { setBusy(false); }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" aria-label="Examinar detalhe misterioso" disabled={busy}
        title="Tem algo aqui…" onClick={() => { void reveal(); }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/40 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </button>
      {discovered && <span className="text-xs text-primary" role="status">Segredo descoberto!</span>}
    </span>
  );
}
