import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Navbar } from "../src/components/Navbar";
import { MobileNav } from "../src/components/MobileNav";
import { AchievementsPage, type Achievement } from "../src/routes/_authenticated/conquistas";
import "../src/styles.css";

const make = (id: string, name: string, progress: number, goal: number, rarity: string, secret = false): Achievement => ({
  id, name, description: secret ? "Algumas histórias só aparecem para quem procura." : "Conquista de teste para visualizar o layout.",
  unlock_text: "Nova conquista!", icon: "trophy", category: secret ? "secreta" : "leitura",
  rarity, xp_reward: secret ? 0 : 250, coin_reward: secret ? 0 : 100,
  title_reward: null, cosmetic_name: null, is_secret: secret, hint: secret ? "Observe os detalhes." : null,
  goal, progress, unlocked_at: progress >= goal && !secret ? new Date().toISOString() : null,
  featured: false, owners_pct: 12.5,
});
const preview: Achievement[] = [
  make("first", "Primeiro Capítulo", 1, 1, "comum"),
  make("curious", "Leitor Curioso", 8, 10, "incomum"),
  make("legend", "Lenda da Leitura", 400, 1000, "mitico"),
  make("secret", "Conquista Secreta", 0, 0, "secreto", true),
  make("marathon", "Maratonista", 20, 20, "epico"),
];
const rootRoute = createRootRoute({ component: () => (
  <><Navbar profile={null} /><main className="min-h-screen pb-24 md:pb-0"><Outlet /></main><MobileNav username="tester" /></>
)});
const pages = [
  createRoute({ getParentRoute: () => rootRoute, path: "/conquistas", component: () => <AchievementsPage previewData={preview} /> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/inicio", component: () => <h1>Início</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/explorar", component: () => <h1>Explorar</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/favoritos", component: () => <h1>Favoritos</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/atualizacoes", component: () => <h1>Atualizações</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/ranking", component: () => <h1>Ranking</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/historico", component: () => <h1>Histórico</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/atividade", component: () => <h1>Atividade</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/scans", component: () => <h1>Scans</h1> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/perfil/$username", component: () => <h1>Perfil</h1> }),
];
window.history.replaceState({}, "", "/conquistas");
const router = createRouter({ routeTree: rootRoute.addChildren(pages), context: {} });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>,
);
