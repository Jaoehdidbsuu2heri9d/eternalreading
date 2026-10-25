import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMMUNITY_URL = "https://chat.whatsapp.com/KLxOu6ustUPLk2aMkwWsAA";

/** Official invitation help shared by the existing registration screens. */
export function InviteCommunityCTA() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(COMMUNITY_URL);
      setCopyState("copied");
    } catch {
      // Older browsers or embedded previews may deny Clipboard API access.
      const input = document.createElement("textarea");
      input.value = COMMUNITY_URL;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      const previousFocus = document.activeElement;
      document.body.appendChild(input);
      input.select();
      try {
        setCopyState(document.execCommand("copy") ? "copied" : "error");
      } catch {
        setCopyState("error");
      } finally {
        input.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
      }
    }
  }

  return (
    <div className="space-y-3">
      <p id="invite-community-help" className="text-sm leading-relaxed text-muted-foreground">
        Ainda não tem um código? Entre na nossa comunidade do WhatsApp para saber como conseguir o seu e continuar o cadastro.
      </p>
      <Button asChild className="gradient-eternal h-auto min-h-12 w-full whitespace-normal rounded-xl px-4 py-3 text-left leading-relaxed text-primary-foreground glow-ring hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">Entrar na comunidade do WhatsApp para conseguir meu código</span>
          <ExternalLink aria-hidden className="shrink-0" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </Button>
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Link oficial da comunidade</p>
        <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="block break-all rounded-sm text-xs leading-relaxed text-muted-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {COMMUNITY_URL}
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        <Button type="button" variant="outline" size="sm" onClick={copyLink} className="gap-2">
          {copyState === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copyState === "copied" ? "Link copiado" : "Copiar link"}
        </Button>
        <p role="status" aria-live="polite" aria-atomic="true" className="min-h-4 text-xs text-muted-foreground">
          {copyState === "copied" ? "Link copiado para a área de transferência." : copyState === "error" ? "Não foi possível copiar. Selecione e copie o endereço acima." : ""}
        </p>
      </div>
    </div>
  );
}