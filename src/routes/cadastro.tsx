import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { Logo } from "@/components/Logo";
import { InviteCommunityCTA } from "@/components/InviteCommunityCTA";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ code: z.string().optional() });

export const Route = createFileRoute("/cadastro")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Criar conta — Eternal" },
      { name: "description", content: "Crie sua conta na comunidade Eternal usando um código de convite." },
      { property: "og:title", content: "Criar conta — Eternal" },
      { property: "og:description", content: "Crie sua conta na comunidade Eternal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignUpPage,
});

const formSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Use ao menos 3 caracteres.")
    .max(20, "Use no máximo 20 caracteres.")
    .regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e _."),
  email: z.string().trim().email("E-mail inválido.").max(255),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres.").max(72),
});

function SignUpPage() {
  const navigate = useNavigate();
  const { code } = Route.useSearch();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    if (!code) {
      setError("Você precisa validar um código de convite antes de criar a conta.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Não foi possível criar a conta.");
      return;
    }

    // Registra o uso do convite e cria o perfil público.
    const { data: redeemed } = await supabase.rpc("redeem_invite_code", { p_code: code });
    if (!redeemed) {
      setLoading(false);
      setError("O código de convite não pôde ser utilizado.");
      return;
    }

    // Cria o perfil; se o nome já existir, o banco escolhe uma variação livre.
    const { error: profileError } = await supabase.rpc("ensure_profile", { p_username: parsed.data.username });
    setLoading(false);

    if (profileError) {
      setError("Conta criada, mas não foi possível finalizar o perfil. Entre novamente.");
      return;
    }
    navigate({ to: "/inicio" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md surface-panel p-5 sm:p-8">
        <Logo className="mb-6" />
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Criar conta · Etapa 2 de 2</p>
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {code ? "Convite validado. Complete seu cadastro." : "Valide um código de convite primeiro."}
        </p>

        {!code ? <div className="mt-6"><InviteCommunityCTA /></div> : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" aria-describedby={error ? "signup-error" : undefined}>
          <Field label="Nome de usuário" htmlFor="username">
            <Input
              id="username"
              autoComplete="username"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </Field>
          <Field label="E-mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Senha" htmlFor="senha" hint="Mínimo de 8 caracteres.">
            <Input
              id="senha"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          {error ? (
            <p id="signup-error" role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm leading-relaxed text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading || !code}>
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        {!code ? (
          <p className="mt-6 text-center text-sm">
            <Link to="/convite" className="rounded-sm text-primary-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Inserir código de convite
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
