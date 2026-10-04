import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Eternal" },
      { name: "description", content: "Crie uma senha nova para sua conta Eternal." },
      { property: "og:title", content: "Redefinir senha — Eternal" },
      { property: "og:description", content: "Crie uma senha nova para sua conta Eternal." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    // O link do e-mail abre uma sessão de recuperação; só liberamos o
    // formulário quando ela existe.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setReady((prev) => prev ?? Boolean(data.session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não são iguais.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Não foi possível salvar a senha nova. Peça um novo link e tente de novo.");
      return;
    }
    navigate({ to: "/inicio" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md surface-panel p-8">
        <Logo className="mb-6" />
        <h1 className="text-2xl font-semibold">Criar senha nova</h1>

        {ready === false ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              Este link é inválido ou já expirou. Peça um novo link de redefinição.
            </p>
            <Link
              to="/esqueci-senha"
              className="block text-center text-sm text-primary-foreground underline underline-offset-4"
            >
              Pedir novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Senha nova" htmlFor="senha">
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Repetir senha nova" htmlFor="confirmar">
              <Input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading || ready !== true}>
              {loading ? "Salvando..." : "Salvar senha nova"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
