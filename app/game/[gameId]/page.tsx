import { notFound } from "next/navigation";
import { OnlineRoom } from "@/components/game/online-room";
import { roomCodeSchema } from "@/lib/multiplayer/protocol";

export const metadata = { title: "Orcas vs Sharks Online Room" };

export default async function RoomPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const code = roomCodeSchema.safeParse((await params).gameId.toUpperCase());
  if (!code.success) notFound();
  return <OnlineRoom code={code.data} />;
}
