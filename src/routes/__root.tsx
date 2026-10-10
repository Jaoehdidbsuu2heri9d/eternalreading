import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  type ErrorComponentProps,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Eternal — Leitura e comunidade de manhwas" },
      { name: "description", content: "Comunidade fechada para ler manhwas de scans parceiras." },
            { property: "og:title", content: "Eternal" },
      { property: "og:description", content: "Comunidade fechada para ler manhwas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function GlobalEventTheme({ children }: { children: ReactNode }) {
  const { data: theme } = useQuery({
    queryKey: ["global-event-theme"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any).from("site_event_themes").select("id,name,description,primary_color,secondary_color,accent_color,background_color,banner_url,decoration,effects_intensity,animations_enabled,starts_at,ends_at,status,priority").in("status", ["active", "scheduled"]).order("priority", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []).find((t: any) => (!t.starts_at || t.starts_at <= now) && (!t.ends_at || t.ends_at > now)) ?? null;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
  useEffect(() => {
    const root = document.documentElement;
    const themedProperties = ["--event-primary","--event-secondary","--event-accent","--event-background","--primary","--ring","--accent","--background"];
    if (!theme) {
      themedProperties.forEach((key) => root.style.removeProperty(key));
      root.removeAttribute("data-event-decoration");
      root.removeAttribute("data-event-animations");
      return;
    }
    root.style.setProperty("--event-primary", theme.primary_color);
    root.style.setProperty("--event-secondary", theme.secondary_color);
    root.style.setProperty("--event-accent", theme.accent_color);
    root.style.setProperty("--event-background", theme.background_color);
    // The design system consumes these variables throughout the whole app.
    root.style.setProperty("--primary", theme.primary_color);
    root.style.setProperty("--ring", theme.primary_color);
    root.style.setProperty("--accent", theme.accent_color);
    root.style.setProperty("--background", theme.background_color);
    root.setAttribute("data-event-decoration", theme.decoration);
    root.setAttribute("data-event-animations", String(theme.animations_enabled));
  }, [theme]);
  return <>{theme ? <div role="status" className="relative z-40 flex items-center justify-center gap-2 border-b border-white/10 px-4 py-2 text-center text-xs font-semibold text-white" style={{ background: `linear-gradient(90deg, ${theme.secondary_color}, ${theme.primary_color})` }}><span aria-hidden>{theme.decoration === "snow" ? "❄" : theme.decoration === "hearts" ? "♡" : theme.decoration === "bats" ? "✦" : "✧"}</span>{theme.name}{theme.description ? <span className="hidden font-normal opacity-80 sm:inline">— {theme.description}</span> : null}</div> : null}{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <QueryClientProvider client={queryClient}><GlobalEventTheme><Outlet /></GlobalEventTheme></QueryClientProvider>;
}
