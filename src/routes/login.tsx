import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Eternal" },
      { name: "description", content: "Acesse sua conta na comunidade Eternal e continue suas leituras." },
      { property: "og:title", content: "Entrar — Eternal" },
      { property: "og:description", content: "Acesse sua conta na comunidade Eternal." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    navigate({ to: "/inicio" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md surface-panel p-8">
        <Logo className="mb-6" />
        <h1 className="text-2xl font-semibold">Bem-vindo de volta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Entre para continuar suas leituras.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="E-mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha" htmlFor="senha">
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/esqueci-senha" className="text-muted-foreground underline underline-offset-4">
            Esqueci minha senha
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Recebeu um código de convite?{" "}
          <Link to="/convite" className="text-primary-foreground underline underline-offset-4">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
