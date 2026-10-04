import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Esqueci minha senha — Eternal" },
      { name: "description", content: "Receba um link por e-mail para criar uma senha nova na Eternal." },
      { property: "og:title", content: "Esqueci minha senha — Eternal" },
      { property: "og:description", content: "Receba um link por e-mail para criar uma senha nova na Eternal." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (resetError) {
      setError("Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md surface-panel p-8">
        <Logo className="mb-6" />
        <h1 className="text-2xl font-semibold">Esqueci minha senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o e-mail da sua conta e enviaremos um link para criar uma senha nova.
        </p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              Se esse e-mail estiver cadastrado, você receberá o link em alguns minutos. Confira
              também a caixa de spam.
            </p>
            <Link to="/login" className="block text-center text-sm text-primary-foreground underline underline-offset-4">
              Voltar para o login
            </Link>
          </div>
        ) : (
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

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Lembrou a senha?{" "}
              <Link to="/login" className="text-primary-foreground underline underline-offset-4">
                Entrar
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
