import { createFileRoute } from "@tanstack/react-router";
import BlockBlast from "@/components/BlockBlast";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Block Blast — Puzzle Game" },
      { name: "description", content: "Play Block Blast! Drag blocks, clear lines, build combos and beat your high score." },
      { property: "og:title", content: "Block Blast — Puzzle Game" },
      { property: "og:description", content: "Drag blocks, clear lines, beat your high score." },
    ],
  }),
  component: Index,
});

function Index() {
  return <BlockBlast />;
}
