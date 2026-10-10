import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/atividade")({
  beforeLoad: () => {
    throw redirect({ to: "/inicio" });
  },
});
