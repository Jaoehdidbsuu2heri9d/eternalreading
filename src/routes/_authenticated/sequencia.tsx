import { createFileRoute } from "@tanstack/react-router";

import { DragonSequenceWidget } from "@/components/DragonSequenceWidget";

export const Route = createFileRoute("/_authenticated/sequencia")({
  head: () => ({
    meta: [
      { title: "Dragãozinho da Sequência — Eternal Reading" },
      {
        name: "description",
        content: "Cuide do seu Dragãozinho Eternal completando um capítulo por dia e ganhando pontos de sequência.",
      },
    ],
  }),
  component: SequencePage,
});

function SequencePage() {
  return <DragonSequenceWidget />;
}
