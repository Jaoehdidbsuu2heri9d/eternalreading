import { ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Official invitation help shared by the existing registration screens. */
export function InviteCommunityCTA() {
  return (
    <div className="space-y-3">
      <p id="invite-community-help" className="text-sm leading-relaxed text-muted-foreground">
        Ainda não tem um código? Entre na nossa comunidade do WhatsApp para saber como conseguir o seu e continuar o cadastro.
      </p>
      <Button asChild className="gradient-eternal h-auto min-h-12 w-full whitespace-normal rounded-xl px-4 py-3 text-left leading-relaxed text-primary-foreground glow-ring hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <a href="https://chat.whatsapp.com/KLxOu6ustUPLk2aMkwWsAA" target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">Entrar na comunidade do WhatsApp para conseguir meu código</span>
          <ExternalLink aria-hidden className="shrink-0" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </Button>
    </div>
  );
}