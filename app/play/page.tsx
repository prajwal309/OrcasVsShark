import Game from "@/components/game/game";

export default async function Play({
  searchParams,
}: {
  searchParams: Promise<{ opponent?: string }>;
}) {
  return (
    <Game openComputerSetup={(await searchParams).opponent === "computer"} />
  );
}
