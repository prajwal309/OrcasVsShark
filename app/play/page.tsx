import Game from "@/components/game/game";

export const metadata = { title: "Play Orcas vs Sharks" };

export default async function Play({
  searchParams,
}: {
  searchParams: Promise<{ opponent?: string }>;
}) {
  return (
    <Game openComputerSetup={(await searchParams).opponent === "computer"} />
  );
}
