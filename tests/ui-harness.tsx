import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Navbar } from "../src/components/Navbar";
import { MobileNav } from "../src/components/MobileNav";
import { AchievementsPage, type Achievement } from "../src/routes/_authenticated/conquistas";
import { HallDaFamaPage, type Supporter, type SupporterLevel } from "../src/routes/_authenticated/hall-da-fama";
import "../src/styles.css";

const make = (id: string, name: string, progress: number, goal: number, rarity: string, secret = false): Achievement => ({
  id, name, description: secret ? "Algumas histórias só aparecem para quem procura." : "Conquista de teste para visualizar o layout.",
  unlock_text: "Nova conquista!", icon: "trophy", category: secret ? "secreta" : "leitura",
  rarity, xp_reward: secret ? 0 : 250, coin_reward: secret ? 0 : 100,
  title_reward: null, cosmetic_name: null, extra_reward: null, is_secret: secret, hint: secret ? "Observe os detalhes." : null,
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

const hallLevels: SupporterLevel[] = [
  { id: "a", slug: "apoiador", name: "Apoiador", description: "Primeiros passos.", color: "#BFA382", icon: "heart", minimum_cents: 500, sort: 1, active: true },
  { id: "b", slug: "guardiao", name: "Guardião", description: "Apoio constante.", color: "#72B6D2", icon: "shield", minimum_cents: 5000, sort: 2, active: true },
  { id: "c", slug: "lendario", name: "Lendário", description: "Muito especial.", color: "#A997F5", icon: "star", minimum_cents: 20000, sort: 3, active: true },
  { id: "d", slug: "eterno", name: "Eterno", description: "Reconhecimento máximo.", color: "#E4B84C", icon: "crown", minimum_cents: 50000, sort: 4, active: true },
];
const hallPeople: Supporter[] = [
  {position:1,user_id:"11111111-1111-4111-8111-111111111111",username:"amora",display_name:"Amora",avatar_url:null,avatar_path:null,level_slug:"eterno",level_name:"Eterno",level_color:"#E4B84C",level_icon:"crown",donation_count:3},
  {position:2,user_id:"22222222-2222-4222-8222-222222222222",username:"davi",display_name:"Davi",avatar_url:null,avatar_path:null,level_slug:"lendario",level_name:"Lendário",level_color:"#A997F5",level_icon:"star",donation_count:2},
  {position:3,user_id:"33333333-3333-4333-8333-333333333333",username:"luana",display_name:"Luana",avatar_url:null,avatar_path:null,level_slug:"guardiao",level_name:"Guardião",level_color:"#72B6D2",level_icon:"shield",donation_count:1},
];

const rootRoute = createRootRoute({ component: () => (
  <><Navbar profile={null} /><main className="min-h-screen pb-24 md:pb-0"><Outlet /></main><MobileNav username="tester" /></>
)});
const pages = [
  createRoute({ getParentRoute: () => rootRoute, path: "/conquistas", component: () => <AchievementsPage previewData={preview} /> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/hall-da-fama", component: () => <HallDaFamaPage previewData={hallPeople} previewLevels={hallLevels} /> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/apoiar", component: () => <h1>Minhas contribuições</h1> }),
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
