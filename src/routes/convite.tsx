import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/convite")({
  head: () => ({
    meta: [
      { title: "Convite — Eternal" },
      {
        name: "description",
        content: "Digite seu código de convite para entrar na comunidade fechada Eternal.",
      },
      { property: "og:title", content: "Convite — Eternal" },
      { property: "og:description", content: "Comunidade fechada de leitura, só com convite." },
    ],
  }),
  component: InvitePage,
});

const MAX_ATTEMPTS = 5;

function InvitePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Proteção simples contra tentativas repetidas de adivinhar o código.
  const attempts = useRef(0);
  const [blockedUntil, setBlockedUntil] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Date.now() < blockedUntil) {
      setError("Muitas tentativas. Aguarde um minuto antes de tentar novamente.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("validate_invite_code", { p_code: code });
    setLoading(false);

    if (rpcError || !data) {
      attempts.current += 1;
      if (attempts.current >= MAX_ATTEMPTS) {
        setBlockedUntil(Date.now() + 60_000);
        attempts.current = 0;
      }
      setError("Código inválido, expirado ou já utilizado.");
      return;
    }
    navigate({ to: "/cadastro", search: { code: code.trim() } });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md surface-panel p-8">
        <Logo className="mb-6" />
        <span className="gradient-eternal mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground">
          <KeyRound className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold">Comunidade fechada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O Eternal é acessível apenas com convite. Digite o código que você recebeu.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Código de convite" htmlFor="codigo" hint="Não compartilhe seu código com terceiros.">
            <Input
              id="codigo"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX"
              className="uppercase tracking-widest"
            />
          </Field>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verificando..." : "Validar código"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary-foreground underline underline-offset-4">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
